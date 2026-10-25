import * as FileSystem from 'expo-file-system/legacy';
import {
  isCloudAuthError,
  isSupabaseConfigured,
  supabase,
} from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

/** Decode base64 → ArrayBuffer without relying on atob (Hermes-safe). */
function base64ToArrayBuffer(base64) {
  const cleaned = String(base64).replace(/[\r\n\s]/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i += 1) lookup[chars.charCodeAt(i)] = i;

  let bufferLength = cleaned.length * 0.75;
  if (cleaned.endsWith('==')) bufferLength -= 2;
  else if (cleaned.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const encoded1 = lookup[cleaned.charCodeAt(i)];
    const encoded2 = lookup[cleaned.charCodeAt(i + 1)];
    const encoded3 = lookup[cleaned.charCodeAt(i + 2)];
    const encoded4 = lookup[cleaned.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (cleaned.charAt(i + 2) !== '=') {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (cleaned.charAt(i + 3) !== '=') {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  return bytes.buffer;
}

function normalizeLocalUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  if (uri.startsWith('emulator-mock://')) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
    return uri;
  }
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

export function isRemoteHttpsUri(uri) {
  return typeof uri === 'string' && /^https:\/\//i.test(uri.trim());
}

/**
 * Prefer remote HTTPS playback URLs over temporary file:// URIs.
 */
export function resolvePlayableVideoUri(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    const t = source.trim();
    return t.length > 0 ? t : null;
  }

  const candidates = [
    source.publicCloudUrl,
    source.remoteVideoUri,
    source.videoUrl,
    source.video_url,
    source.videoUri,
    source.recordedVideoUri,
    source.uri,
    source.localVideoUri,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && isRemoteHttpsUri(c)) return c.trim();
  }
  for (const c of candidates) {
    if (typeof c === 'string' && /^http:\/\//i.test(c.trim())) return c.trim();
  }
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

/**
 * Copy camera temp clips into app document storage so POST still works after review.
 */
export async function persistLocalVideoUri(localUri) {
  const uri = normalizeLocalUri(localUri);
  if (!uri || uri.startsWith('emulator-mock://')) return uri;
  if (!FileSystem.documentDirectory) return uri;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error(`Local video file not found at ${uri}`);
    }

    if (uri.includes('/battle_clips/')) return uri;

    const dir = `${FileSystem.documentDirectory}battle_clips`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}/clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.warn('[upload] persistLocalVideoUri failed:', err?.message || err);
    throw err;
  }
}

/**
 * Convert a local Expo/RN file URI into a Blob suitable for supabase-js Storage.
 * Primary path: fetch(uri) → blob() (required on React Native).
 */
export async function localUriToBlob(localUri) {
  const uri = normalizeLocalUri(localUri);
  if (!uri) throw new Error('Missing local video URI for upload');
  if (uri.startsWith('emulator-mock://')) {
    throw new Error('Cannot upload emulator mock clip to cloud storage');
  }

  // content:// / ph:// → copy to a stable file:// first
  let readableUri = uri;
  if (uri.startsWith('content://') || uri.startsWith('ph://')) {
    readableUri = await persistLocalVideoUri(uri);
  }

  const response = await fetch(readableUri);
  if (!response.ok) {
    throw new Error(
      `Failed to read local video (${response.status}). URI may be invalid or expired.`
    );
  }
  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Local video blob is empty');
  }
  return blob;
}

/** @deprecated Prefer localUriToBlob — kept for callers that still need ArrayBuffer. */
export async function readLocalVideoBytes(localUri) {
  const blob = await localUriToBlob(localUri);
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  // Fallback: base64 decode via FileSystem
  const uri = normalizeLocalUri(localUri);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`Local video file not found at ${uri}`);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error('Local video file is empty');
  return base64ToArrayBuffer(base64);
}

/**
 * Build a Storage body from a local URI. Tries blob → arrayBuffer → base64.
 * Returns null on failure (never throws).
 */
async function buildUploadBody(uri) {
  // 1) fetch → blob (preferred RN path)
  try {
    const response = await fetch(uri);
    if (response?.ok) {
      const blob = await response.blob();
      if (blob && blob.size > 0) return { body: blob, via: 'blob' };
      // Some RN builds return empty blobs — fall through to arrayBuffer
      if (typeof response.arrayBuffer === 'function') {
        const ab = await response.arrayBuffer();
        if (ab && ab.byteLength > 0) return { body: ab, via: 'arrayBuffer' };
      }
    }
  } catch (err) {
    console.warn('[upload] fetch/blob failed:', err?.message || err);
  }

  // 2) Fresh fetch → arrayBuffer
  try {
    const response = await fetch(uri);
    if (response?.ok && typeof response.arrayBuffer === 'function') {
      const ab = await response.arrayBuffer();
      if (ab && ab.byteLength > 0) return { body: ab, via: 'arrayBuffer' };
    }
  } catch (err) {
    console.warn('[upload] fetch/arrayBuffer failed:', err?.message || err);
  }

  // 3) Expo FileSystem base64 → ArrayBuffer
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info?.exists) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) {
        return { body: base64ToArrayBuffer(base64), via: 'base64' };
      }
    }
  } catch (err) {
    console.warn('[upload] FileSystem base64 failed:', err?.message || err);
  }

  return null;
}

/**
 * Bulletproof anonymous upload to public `bawaalvideos` bucket.
 * - No getSession / canAttemptCloudUpload / auth gates
 * - Never throws — returns public HTTPS URL string or null
 *
 * @param {string} localUri
 * @returns {Promise<string|null>}
 */
export async function uploadVideoToSupabase(localUri) {
  try {
    if (!localUri || typeof localUri !== 'string') {
      console.warn('[upload] uploadVideoToSupabase: missing localUri');
      return null;
    }

    if (!isSupabaseConfigured()) {
      console.warn('[upload] uploadVideoToSupabase: Supabase not configured');
      return null;
    }

    // Already remote — nothing to upload
    if (isRemoteHttpsUri(localUri)) {
      return localUri.trim();
    }

    let uri = normalizeLocalUri(localUri) || localUri;
    try {
      if (uri.startsWith('content://') || uri.startsWith('ph://')) {
        uri = (await persistLocalVideoUri(uri)) || uri;
      } else if (uri.startsWith('file://') || uri.startsWith('/')) {
        uri = (await persistLocalVideoUri(uri)) || uri;
      }
    } catch (persistErr) {
      console.warn(
        '[upload] persist skipped, using original URI:',
        persistErr?.message || persistErr
      );
    }

    const filePath = `battles/${Date.now()}_video.mp4`;
    const prepared = await buildUploadBody(uri);
    if (!prepared?.body) {
      console.warn('[upload] Could not read local video body');
      return null;
    }

    const { error } = await supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .upload(filePath, prepared.body, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn(
        '[upload] storage.upload failed:',
        error.message || error,
        `(via ${prepared.via})`
      );
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl =
      typeof publicUrlData?.publicUrl === 'string'
        ? publicUrlData.publicUrl.trim()
        : '';

    if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
      console.warn('[upload] getPublicUrl returned empty/invalid URL');
      return null;
    }

    return publicUrl;
  } catch (err) {
    // Absolute last resort — never crash the post flow
    console.warn('[upload] uploadVideoToSupabase caught:', err?.message || err);
    return null;
  }
}

/**
 * Upload wrapper used by PostCreationSheet / battle flows.
 * Never throws. Prefer remote HTTPS; fall back to local URI metadata.
 *
 * @returns {{ publicUrl: string|null, localUri: string, skipped: boolean, reason?: string, error?: string, path?: string }}
 */
export const uploadBattleVideo = async (localUri) => {
  let stableUri = normalizeLocalUri(localUri) || localUri || '';
  try {
    const persisted = await persistLocalVideoUri(localUri);
    if (persisted) stableUri = persisted;
  } catch (err) {
    console.warn('[upload] Could not persist clip — using original URI:', err?.message || err);
  }

  const localFallback = (reason, error) => ({
    publicUrl: null,
    localUri: stableUri,
    skipped: true,
    reason,
    error: error ? String(error?.message || error) : undefined,
  });

  if (isRemoteHttpsUri(stableUri)) {
    return {
      publicUrl: stableUri.trim(),
      localUri: stableUri,
      skipped: false,
      reason: 'already-remote',
    };
  }

  if (!stableUri) {
    return localFallback('missing-uri');
  }

  try {
    const publicUrl = await uploadVideoToSupabase(stableUri);
    if (typeof publicUrl === 'string' && publicUrl.length > 0) {
      return {
        publicUrl,
        localUri: stableUri,
        skipped: false,
        path: publicUrl.split('/').slice(-2).join('/'),
      };
    }
    return localFallback('storage-error', 'uploadVideoToSupabase returned null');
  } catch (err) {
    // Should never happen — uploadVideoToSupabase swallows errors — but belt & suspenders
    console.warn('[upload] uploadBattleVideo outer catch:', err?.message || err);
    return localFallback('storage-error', err);
  }
};

/** Alias matching BAWAAL product naming */
export const uploadBawaalVideo = uploadBattleVideo;

export { normalizeLocalUri, isCloudAuthError };
