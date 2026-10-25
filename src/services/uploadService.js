import * as FileSystem from 'expo-file-system/legacy';
import {
  canAttemptCloudUpload,
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

export async function readLocalVideoBytes(localUri) {
  const uri = normalizeLocalUri(localUri);
  if (!uri) throw new Error('Missing local video URI for upload');
  if (uri.startsWith('emulator-mock://')) {
    throw new Error('Cannot upload emulator mock clip to cloud storage');
  }

  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error(`Local video file not found at ${uri}`);
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error('Local video file is empty');
    return base64ToArrayBuffer(base64);
  }

  if (uri.startsWith('content://') || uri.startsWith('ph://')) {
    const stable = await persistLocalVideoUri(uri);
    return readLocalVideoBytes(stable);
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(
        `Failed to read video (${response.status}). URI may be invalid or expired.`
      );
    }
    return response.arrayBuffer();
  }

  throw new Error(`Unsupported video URI scheme: ${uri.slice(0, 32)}`);
}

/**
 * Upload a recorded clip to Supabase Storage bucket `bawaalvideos`.
 * Path: battles/{timestamp}_video.mp4
 *
 * On auth/storage/offline failure returns local file:// fallback — never throws
 * for network/storage errors.
 *
 * @returns {{ publicUrl: string|null, localUri: string, skipped: boolean, reason?: string, error?: string, path?: string }}
 */
export const uploadBattleVideo = async (localUri) => {
  let stableUri = normalizeLocalUri(localUri);
  try {
    stableUri = await persistLocalVideoUri(localUri);
  } catch (err) {
    console.warn('[upload] Could not persist clip — using original URI:', err?.message || err);
    stableUri = normalizeLocalUri(localUri) || localUri;
  }

  const localFallback = (reason, error) => ({
    publicUrl: null,
    localUri: stableUri,
    skipped: true,
    reason,
    error: error ? String(error?.message || error) : undefined,
  });

  // Already a remote HTTPS URL — no re-upload needed
  if (isRemoteHttpsUri(stableUri)) {
    return {
      publicUrl: stableUri.trim(),
      localUri: stableUri,
      skipped: false,
      reason: 'already-remote',
    };
  }

  if (!isSupabaseConfigured()) {
    return localFallback('not-configured');
  }

  try {
    const canCloud = await canAttemptCloudUpload();
    if (!canCloud) {
      return localFallback('auth-unavailable');
    }

    const objectPath = `battles/${Date.now()}_video.mp4`;
    const arrayBuffer = await readLocalVideoBytes(stableUri);

    const { error } = await supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .upload(objectPath, arrayBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn('[upload] Storage upload failed:', error.message || error);
      return localFallback('storage-error', error);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .getPublicUrl(objectPath);

    if (!publicUrlData?.publicUrl) {
      return localFallback('no-public-url');
    }

    return {
      publicUrl: publicUrlData.publicUrl,
      localUri: stableUri,
      skipped: false,
      path: objectPath,
    };
  } catch (err) {
    console.warn('[upload] Unexpected upload error:', err?.message || err);
    return localFallback(
      isCloudAuthError(err) ? 'auth-unavailable' : 'storage-error',
      err
    );
  }
};

/** Alias matching BAWAAL product naming */
export const uploadBawaalVideo = uploadBattleVideo;

export { normalizeLocalUri, isCloudAuthError };
