import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError } from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

/** Reject uploads smaller than this — empty/corrupt streams cause black playback. */
const MIN_VIDEO_BYTES = 1024;

function getEnvSupabaseUrl() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return typeof url === 'string' ? url.replace(/\/$/, '').trim() : '';
}

function getEnvAnonKey() {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

/**
 * Sanitize local video URIs for Android / iOS before upload.
 * Bare absolute paths on Android must be prefixed with `file://`.
 */
export function sanitizeVideoUriForUpload(videoUri) {
  if (!videoUri || typeof videoUri !== 'string') return null;
  const trimmed = videoUri.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://') ||
    trimmed.startsWith('emulator-mock://') ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return trimmed;
  }

  // Android often returns paths like /data/... without a scheme
  if (
    Platform.OS === 'android' &&
    !trimmed.startsWith('file://') &&
    !trimmed.startsWith('content://')
  ) {
    return trimmed.startsWith('/') ? `file://${trimmed}` : `file:///${trimmed}`;
  }

  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

function normalizeLocalUri(uri) {
  return sanitizeVideoUriForUpload(uri);
}

function makeObjectFileName(fileName) {
  const raw =
    typeof fileName === 'string' && fileName.trim().length > 0
      ? fileName.trim()
      : `video_${Date.now()}.mp4`;
  // Always keep .mp4 so Storage / CDN serve video/mp4
  const cleaned = raw.replace(/[^\w.\-]+/g, '_');
  return cleaned.toLowerCase().endsWith('.mp4') ? cleaned : `${cleaned}.mp4`;
}

export function isRemoteHttpsUri(uri) {
  return typeof uri === 'string' && /^https:\/\//i.test(uri.trim());
}

/**
 * Force the exact public bucket URL shape required for playback:
 * `${SUPABASE_URL}/storage/v1/object/public/bawaalvideos/battles/${fileName}`
 *
 * Fixes missing `/public/` (audio may play via redirect; video/Android crashes).
 */
export function ensurePublicBawaalVideoUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  let uri = raw.trim();
  if (!uri || uri === 'null' || uri === 'undefined') return null;

  const base = getEnvSupabaseUrl();

  // Local device URIs — leave alone
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  ) {
    return uri;
  }

  // Insert /public/ when Storage object URL omits it
  if (uri.includes('/storage/v1/object/') && uri.includes('bawaalvideos')) {
    uri = uri
      .replace(
        '/storage/v1/object/bawaalvideos/',
        '/storage/v1/object/public/bawaalvideos/'
      )
      .replace(
        '/storage/v1/object/sign/bawaalvideos/',
        '/storage/v1/object/public/bawaalvideos/'
      )
      .replace(
        '/storage/v1/object/authenticated/bawaalvideos/',
        '/storage/v1/object/public/bawaalvideos/'
      );
    // Collapse accidental double public
    uri = uri.replace(
      '/storage/v1/object/public/public/bawaalvideos/',
      '/storage/v1/object/public/bawaalvideos/'
    );
  }

  // Absolute http(s) after repair
  if (/^https?:\/\//i.test(uri)) {
    const rebuilt = uri.match(
      /^(https?:\/\/[^/?#]+)\/storage\/v1\/object\/(?:public\/)?bawaalvideos\/(.+?)(?:\?.*)?$/i
    );
    if (rebuilt) {
      return `${rebuilt[1]}/storage/v1/object/public/bawaalvideos/${rebuilt[2]}`;
    }
    return uri;
  }

  if (!base) return null;

  if (uri.startsWith('/storage/v1/object/public/bawaalvideos/')) {
    return `${base}${uri}`;
  }
  if (uri.startsWith('/storage/v1/object/bawaalvideos/')) {
    return `${base}${uri.replace(
      '/storage/v1/object/bawaalvideos/',
      '/storage/v1/object/public/bawaalvideos/'
    )}`;
  }
  if (uri.startsWith('storage/v1/object/public/bawaalvideos/')) {
    return `${base}/${uri}`;
  }

  const cleaned = uri.replace(/^\//, '');
  if (cleaned.startsWith('bawaalvideos/')) {
    return `${base}/storage/v1/object/public/${cleaned}`;
  }
  if (cleaned.startsWith('battles/')) {
    return `${base}/storage/v1/object/public/bawaalvideos/${cleaned}`;
  }
  // Bare filename → battles/<file>
  if (/^[\w.\-]+\.mp4$/i.test(cleaned)) {
    return `${base}/storage/v1/object/public/bawaalvideos/battles/${cleaned}`;
  }

  return null;
}

/** @deprecated Use ensurePublicBawaalVideoUrl — kept as stable alias for feed helpers */
export function toPublicFeedVideoUrl(raw) {
  return ensurePublicBawaalVideoUrl(raw);
}

/**
 * Prefer remote HTTPS playback URLs over temporary file:// URIs.
 * Always normalize Supabase Storage paths to `/object/public/bawaalvideos/...`.
 */
export function resolvePlayableVideoUri(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    return ensurePublicBawaalVideoUrl(source.trim()) || source.trim() || null;
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
    if (typeof c === 'string' && isRemoteHttpsUri(c)) {
      return ensurePublicBawaalVideoUrl(c) || c.trim();
    }
  }
  for (const c of candidates) {
    if (typeof c === 'string' && /^http:\/\//i.test(c.trim())) {
      return ensurePublicBawaalVideoUrl(c) || c.trim();
    }
  }
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return ensurePublicBawaalVideoUrl(c) || c.trim();
    }
  }
  return null;
}

/**
 * Copy camera temp clips into app document storage so POST still works after review.
 */
export async function persistLocalVideoUri(localUri) {
  const uri = sanitizeVideoUriForUpload(localUri);
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
 * Ensure the local file exists and is large enough to be a real video (not empty stream).
 */
async function assertUploadableVideoFile(fileUri) {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || info.isDirectory) {
    throw new Error(`Video file missing before upload: ${fileUri}`);
  }
  const size = typeof info.size === 'number' ? info.size : 0;
  console.log('UPLOAD_FILE_SIZE:', size, 'uri=', fileUri);
  if (size < MIN_VIDEO_BYTES) {
    throw new Error(
      `Video file too small (${size} bytes) — refusing empty/corrupt upload`
    );
  }
  return size;
}

function buildPublicUrl(supabaseUrl, safeName) {
  return `${supabaseUrl}/storage/v1/object/public/bawaalvideos/battles/${safeName}`;
}

function buildUploadUrl(supabaseUrl, safeName) {
  return `${supabaseUrl}/storage/v1/object/bawaalvideos/battles/${safeName}`;
}

/**
 * Native binary upload ONLY.
 *
 * Supabase Storage `/object/{bucket}/{path}` expects the raw file bytes with
 * `Content-Type: video/mp4`. Multipart FormData wraps the file in boundary
 * markers and produces black/corrupt playback in players.
 */
async function uploadViaFileSystemBinary(uploadUrl, fileUri, anonKey) {
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true',
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

  console.log('BINARY_UPLOAD_OK: status=', result.status);
  return true;
}

/**
 * Upload a local video to Supabase Storage (`bawaalvideos/battles/{fileName}`).
 *
 * - Sanitizes Android URIs (`file://` prefix)
 * - Persists to a stable path and verifies non-empty size
 * - Uploads raw MP4 bytes with `Content-Type: video/mp4` (never multipart)
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

    const resolvedUri = sanitizeVideoUriForUpload(videoUri);
    if (!resolvedUri) {
      console.error('REST_UPLOAD_ERROR: missing videoUri');
      return null;
    }

    if (isRemoteHttpsUri(resolvedUri)) {
      const publicExisting =
        ensurePublicBawaalVideoUrl(resolvedUri) || resolvedUri.trim();
      console.log('UPLOAD_SKIP: already remote HTTPS ->', publicExisting);
      return publicExisting;
    }

    const safeName = makeObjectFileName(fileName);
    const uploadUrl = buildUploadUrl(SUPABASE_URL, safeName);
    // Exact public playback URL (must include /public/)
    const publicUrl =
      ensurePublicBawaalVideoUrl(buildPublicUrl(SUPABASE_URL, safeName)) ||
      buildPublicUrl(SUPABASE_URL, safeName);

    console.log('UPLOAD_REST_URL:', uploadUrl);
    console.log(
      'UPLOAD_KEY_PREFIX:',
      ANON_KEY.slice(0, 18) + '…',
      '(len=' + ANON_KEY.length + ')'
    );

    // Stable file:// path — content:// / bare Android paths cause empty streams
    let fileUri = resolvedUri;
    try {
      const persisted = await persistLocalVideoUri(resolvedUri);
      if (typeof persisted === 'string' && persisted.length > 0) {
        fileUri = sanitizeVideoUriForUpload(persisted) || persisted;
      }
    } catch (persistErr) {
      console.warn(
        '[upload] persist skipped, using sanitized URI:',
        persistErr?.message || persistErr
      );
      fileUri = sanitizeVideoUriForUpload(resolvedUri) || resolvedUri;
    }

    // Extra Android guard matching PostCreationSheet sanitization
    if (
      Platform.OS === 'android' &&
      !fileUri.startsWith('file://') &&
      !fileUri.startsWith('content://')
    ) {
      fileUri = fileUri.startsWith('/') ? `file://${fileUri}` : `file:///${fileUri}`;
    }

    console.log('UPLOAD_FILE_URI:', fileUri);
    await assertUploadableVideoFile(fileUri);

    // Binary only — FormData multipart corrupts objects in Supabase Storage
    await uploadViaFileSystemBinary(uploadUrl, fileUri, ANON_KEY);
    console.log('PUBLIC_URL:', publicUrl);
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
  const stableUri = sanitizeVideoUriForUpload(localUri) || localUri || '';

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
