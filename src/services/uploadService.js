import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError } from './supabase';

/**
 * Yield so React can paint loading UI before heavy file / network work.
 * (RN 0.88+ removed InteractionManager — use idle + next frame instead.)
 */
function yieldToUI() {
  return new Promise((resolve) => {
    const finish = () => requestAnimationFrame(() => setTimeout(resolve, 0));
    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(() => finish(), { timeout: 120 });
    } else {
      finish();
    }
  });
}

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

/** Collapse `https://host//path` and repeated `/public/` segments. */
function cleanStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url
    .replace(/([^:]\/)\/+/g, '$1')
    .replace(
      /\/storage\/v1\/object\/public\/(?:public\/)+bawaalvideos\//g,
      '/storage/v1/object/public/bawaalvideos/'
    )
    .trim();
}

/**
 * Force the exact public bucket URL shape required for playback:
 * `https://<project>.supabase.co/storage/v1/object/public/bawaalvideos/${filePath}`
 *
 * Fixes missing `/public/` and duplicate slashes (audio may play; video stays black).
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
  }

  // Absolute http(s) → canonical public form
  if (/^https?:\/\//i.test(uri)) {
    const rebuilt = uri.match(
      /^(https?:\/\/[^/?#]+)\/storage\/v1\/object\/(?:public\/)?bawaalvideos\/(.+?)(?:\?.*)?$/i
    );
    if (rebuilt) {
      const filePath = rebuilt[2].replace(/^\/+/, '').replace(/\/+/g, '/');
      return cleanStorageUrl(
        `${rebuilt[1]}/storage/v1/object/public/bawaalvideos/${filePath}`
      );
    }
    return cleanStorageUrl(uri);
  }

  if (!base) return null;

  if (uri.startsWith('/storage/v1/object/public/bawaalvideos/')) {
    return cleanStorageUrl(`${base}${uri}`);
  }
  if (uri.startsWith('/storage/v1/object/bawaalvideos/')) {
    return cleanStorageUrl(
      `${base}${uri.replace(
        '/storage/v1/object/bawaalvideos/',
        '/storage/v1/object/public/bawaalvideos/'
      )}`
    );
  }
  if (uri.startsWith('storage/v1/object/public/bawaalvideos/')) {
    return cleanStorageUrl(`${base}/${uri}`);
  }

  const cleaned = uri.replace(/^\//, '').replace(/\/+/g, '/');
  if (cleaned.startsWith('bawaalvideos/')) {
    return cleanStorageUrl(`${base}/storage/v1/object/public/${cleaned}`);
  }
  if (cleaned.startsWith('battles/')) {
    return cleanStorageUrl(
      `${base}/storage/v1/object/public/bawaalvideos/${cleaned}`
    );
  }
  // Bare filename → battles/<file>
  if (/^[\w.\-]+\.mp4$/i.test(cleaned)) {
    return cleanStorageUrl(
      `${base}/storage/v1/object/public/bawaalvideos/battles/${cleaned}`
    );
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
 * Native binary upload ONLY (runs off the JS thread via FileSystem native task).
 *
 * Supabase Storage `/object/{bucket}/{path}` expects the raw file bytes with
 * `Content-Type: video/mp4`. Multipart FormData wraps the file in boundary
 * markers and produces black/corrupt playback in players.
 *
 * @param {string} uploadUrl
 * @param {string} fileUri
 * @param {string} anonKey
 * @param {(pct: number) => void} [onProgress] 0–100
 */
async function uploadViaFileSystemBinary(
  uploadUrl,
  fileUri,
  anonKey,
  onProgress
) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'video/mp4',
    'x-upsert': 'true',
  };
  const options = {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  };

  let result;

  // Prefer createUploadTask — native background transfer + progress callbacks
  // so the JS thread stays responsive during multi‑MB video uploads.
  if (typeof FileSystem.createUploadTask === 'function') {
    const task = FileSystem.createUploadTask(
      uploadUrl,
      fileUri,
      options,
      (progress) => {
        try {
          const total = progress?.totalBytesExpectedToSend || 0;
          const sent = progress?.totalBytesSent || 0;
          if (total > 0 && typeof onProgress === 'function') {
            const pct = Math.min(100, Math.round((sent / total) * 100));
            onProgress(pct);
          }
        } catch (_) {
          /* ignore progress callback errors */
        }
      }
    );
    result = await task.uploadAsync();
  } else {
    result = await FileSystem.uploadAsync(uploadUrl, fileUri, options);
  }

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

  if (typeof onProgress === 'function') onProgress(100);
  console.log('BINARY_UPLOAD_OK: status=', result.status);
  return true;
}

/**
 * Upload a local video to Supabase Storage (`bawaalvideos/battles/{fileName}`).
 *
 * - Yields to UI (InteractionManager) before file I/O / network
 * - Sanitizes Android URIs (`file://` prefix)
 * - Persists to a stable path and verifies non-empty size
 * - Uploads raw MP4 bytes via native FileSystem task (never multipart / never blocks JS)
 *
 * @param {string} videoUri
 * @param {string} [fileName]
 * @param {{ onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<string|null>} public HTTPS URL or null (caller must abort post)
 */
export async function uploadVideoToSupabase(videoUri, fileName, options) {
  const onProgress =
    options && typeof options.onProgress === 'function'
      ? options.onProgress
      : null;

  try {
    console.log('START_UPLOAD: videoUri ->', videoUri);

    // Let loading indicators paint before heavy work stalls the JS thread
    await yieldToUI();
    if (onProgress) onProgress(2);

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
      if (onProgress) onProgress(100);
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
      if (onProgress) onProgress(5);
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
    if (onProgress) onProgress(8);

    // Yield again right before native transfer so UI stays buttery
    await yieldToUI();

    // Binary only — FormData multipart corrupts objects in Supabase Storage
    await uploadViaFileSystemBinary(uploadUrl, fileUri, ANON_KEY, (pct) => {
      // Map native 0–100 into 8–100 so prep steps stay visible
      if (onProgress) onProgress(Math.max(8, Math.min(100, pct)));
    });
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
