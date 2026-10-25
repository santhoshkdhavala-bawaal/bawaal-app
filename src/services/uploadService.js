import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError } from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

function getEnvSupabaseUrl() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return typeof url === 'string' ? url.replace(/\/$/, '').trim() : '';
}

function getEnvAnonKey() {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

function normalizeLocalUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  if (uri.startsWith('emulator-mock://')) return uri;
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://')
  ) {
    return uri;
  }
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

function makeObjectFileName(fileName) {
  const raw =
    typeof fileName === 'string' && fileName.trim().length > 0
      ? fileName.trim()
      : `video_${Date.now()}.mp4`;
  return raw.replace(/[^\w.\-]+/g, '_');
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

function buildPublicUrl(supabaseUrl, safeName) {
  return `${supabaseUrl}/storage/v1/object/public/bawaalvideos/battles/${safeName}`;
}

function buildUploadUrl(supabaseUrl, safeName) {
  return `${supabaseUrl}/storage/v1/object/bawaalvideos/battles/${safeName}`;
}

function authHeaders(anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'x-upsert': 'true',
  };
}

/**
 * Preferred path on Android/iOS: native binary upload.
 * Avoids RN `fetch(fileUri)` / blob reads that throw "Failed to fetch".
 * Supabase Storage expects the raw file bytes as the request body.
 */
async function uploadViaFileSystemBinary(uploadUrl, fileUri, anonKey) {
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      ...authHeaders(anonKey),
      'Content-Type': 'video/mp4',
    },
  });

  if (result.status < 200 || result.status >= 300) {
    console.error(
      'REST_UPLOAD_ERROR (binary):',
      result.status,
      result.body
    );
    throw new Error(
      result.body || `Storage binary upload failed with status ${result.status}`
    );
  }

  return true;
}

/**
 * React Native FormData upload (multipart).
 * Do NOT set Content-Type — fetch sets the multipart boundary.
 */
async function uploadViaFormData(uploadUrl, fileUri, safeName, anonKey) {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: safeName || `video_${Date.now()}.mp4`,
    type: 'video/mp4',
  });

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...authHeaders(anonKey),
      // Content-Type intentionally omitted for multipart boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(
      'REST_UPLOAD_ERROR (formData):',
      response.status,
      response.statusText,
      errText
    );
    throw new Error(
      errText || `Storage FormData upload failed with status ${response.status}`
    );
  }

  return true;
}

/**
 * Upload a local video to Supabase Storage (`bawaalvideos/battles/{fileName}`).
 *
 * 1) Persist to a stable `file://` path when possible
 * 2) Native FileSystem binary upload (Android-safe)
 * 3) Fall back to RN FormData if binary path fails
 *
 * @param {string} videoUri
 * @param {string} [fileName]
 * @returns {Promise<string|null>} public HTTPS URL or null (caller must abort post)
 */
export async function uploadVideoToSupabase(videoUri, fileName) {
  try {
    console.log('START_UPLOAD: videoUri ->', videoUri);

    const SUPABASE_URL = getEnvSupabaseUrl();
    const ANON_KEY = getEnvAnonKey();

    if (!SUPABASE_URL || !ANON_KEY) {
      console.error(
        'REST_UPLOAD_ERROR: missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY'
      );
      return null;
    }

    const resolvedUri = normalizeLocalUri(videoUri) || videoUri;
    if (!resolvedUri || typeof resolvedUri !== 'string') {
      console.error('REST_UPLOAD_ERROR: missing videoUri');
      return null;
    }

    if (isRemoteHttpsUri(resolvedUri)) {
      console.log('UPLOAD_SKIP: already remote HTTPS');
      return resolvedUri.trim();
    }

    const safeName = makeObjectFileName(fileName);
    const uploadUrl = buildUploadUrl(SUPABASE_URL, safeName);
    const publicUrl = buildPublicUrl(SUPABASE_URL, safeName);

    console.log('UPLOAD_REST_URL:', uploadUrl);
    console.log(
      'UPLOAD_KEY_PREFIX:',
      ANON_KEY.slice(0, 18) + '…',
      '(len=' + ANON_KEY.length + ')'
    );

    // Stable file:// URI — content:// / camera temp paths break some Android uploads
    let fileUri = resolvedUri;
    try {
      const persisted = await persistLocalVideoUri(resolvedUri);
      if (typeof persisted === 'string' && persisted.length > 0) {
        fileUri = persisted;
      }
    } catch (persistErr) {
      console.warn(
        '[upload] persist skipped, using original URI:',
        persistErr?.message || persistErr
      );
    }
    console.log('UPLOAD_FILE_URI:', fileUri);

    // 1) Native binary (correct for Supabase Storage, avoids "Failed to fetch")
    try {
      await uploadViaFileSystemBinary(uploadUrl, fileUri, ANON_KEY);
      console.log('PUBLIC_URL (binary):', publicUrl);
      return publicUrl;
    } catch (binaryErr) {
      console.warn(
        '[upload] binary upload failed, trying FormData:',
        binaryErr?.message || binaryErr
      );
    }

    // 2) RN FormData fallback
    await uploadViaFormData(uploadUrl, fileUri, safeName, ANON_KEY);
    console.log('PUBLIC_URL (formData):', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('UPLOAD_CATCH_ERROR:', err);
    return null;
  }
}

/**
 * Thin wrapper for PostCreationSheet / battle flows.
 * Never throws. When publicUrl is null, callers must NOT create a feed post.
 *
 * @returns {{ publicUrl: string|null, localUri: string, skipped: boolean, reason?: string, error?: string }}
 */
export const uploadBattleVideo = async (localUri) => {
  const stableUri = normalizeLocalUri(localUri) || localUri || '';

  if (isRemoteHttpsUri(stableUri)) {
    return {
      publicUrl: stableUri.trim(),
      localUri: stableUri,
      skipped: false,
      reason: 'already-remote',
    };
  }

  if (!stableUri) {
    return {
      publicUrl: null,
      localUri: '',
      skipped: true,
      reason: 'missing-uri',
    };
  }

  const publicUrl = await uploadVideoToSupabase(
    stableUri,
    `video_${Date.now()}.mp4`
  );
  if (typeof publicUrl === 'string' && publicUrl.length > 0) {
    return {
      publicUrl,
      localUri: stableUri,
      skipped: false,
    };
  }

  return {
    publicUrl: null,
    localUri: stableUri,
    skipped: true,
    reason: 'storage-error',
  };
};

/** Alias matching BAWAAL product naming */
export const uploadBawaalVideo = uploadBattleVideo;

export { normalizeLocalUri, isCloudAuthError };
