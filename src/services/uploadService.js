import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError, isSupabaseConfigured, supabase } from './supabase';

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
      : `bawaal_${Date.now()}.mp4`;
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

    if (uri.includes('/battle_clips/') || uri.includes('/bawaal_clips/')) {
      return uri;
    }

    const dir = `${FileSystem.documentDirectory}bawaal_clips`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}/bawaal_${Date.now()}.mp4`;
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

const STORAGE_HEADERS = (anonKey) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'video/mp4',
  'x-upsert': 'true',
});

/** Decode base64 → Uint8Array without external deps (Hermes / RN safe). */
function base64ToUint8Array(base64) {
  const cleaned = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!cleaned) throw new Error('Empty base64 video payload');

  if (typeof globalThis.Buffer === 'function') {
    return new Uint8Array(globalThis.Buffer.from(cleaned, 'base64'));
  }

  if (typeof globalThis.atob !== 'function') {
    throw new Error('No base64 decoder available on this runtime');
  }

  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Read local `file://` / `content://` video into Uint8Array.
 * Prefer fetch → ArrayBuffer/Blob first, then FileSystem base64 fallback.
 */
async function readLocalVideoBytes(fileUri) {
  console.log('UPLOAD_READ_BYTES:', fileUri);

  // Path A: fetch local URI → ArrayBuffer (RN / Expo often supports file://)
  try {
    const res = await fetch(fileUri);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer && buffer.byteLength >= MIN_VIDEO_BYTES) {
        console.log('UPLOAD_READ_BYTES: arrayBuffer size=', buffer.byteLength);
        return new Uint8Array(buffer);
      }
      console.warn(
        'UPLOAD_READ_BYTES: arrayBuffer too small:',
        buffer?.byteLength
      );
    }
  } catch (fetchErr) {
    console.warn(
      'UPLOAD_READ_BYTES: fetch/arrayBuffer failed:',
      fetchErr?.message || fetchErr
    );
  }

  // Path B: FileSystem base64 decode
  const encoding =
    FileSystem.EncodingType?.Base64 ||
    FileSystem.EncodingType?.BASE64 ||
    'base64';
  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding });
  const bytes = base64ToUint8Array(base64);
  console.log('UPLOAD_READ_BYTES: base64 size=', bytes.byteLength);
  if (bytes.byteLength < MIN_VIDEO_BYTES) {
    throw new Error(
      `Decoded video too small (${bytes.byteLength} bytes) — refusing upload`
    );
  }
  return bytes;
}

/**
 * RN-safe binary body for Storage.
 * Prefer ArrayBuffer (Supabase JS accepts it cleanly on Android), then Blob.
 */
function bytesToUploadBody(bytes) {
  try {
    if (bytes?.buffer instanceof ArrayBuffer) {
      const start = bytes.byteOffset || 0;
      const end = start + bytes.byteLength;
      return bytes.buffer.slice(start, end);
    }
  } catch (_) {
    /* fall through */
  }
  if (typeof Blob !== 'undefined') {
    try {
      return new Blob([bytes], { type: 'video/mp4' });
    } catch (_) {
      try {
        return new Blob([bytes.buffer], { type: 'video/mp4' });
      } catch (__) {
        /* fall through */
      }
    }
  }
  return bytes;
}

/**
 * Preferred path: Supabase JS client upload (ArrayBuffer / Blob).
 */
async function uploadViaSupabaseSdk(objectPath, fileUri, onProgress) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client not configured');
  }
  if (onProgress) onProgress(12);
  const bytes = await readLocalVideoBytes(fileUri);
  if (onProgress) onProgress(40);
  const body = bytesToUploadBody(bytes);

  console.log(
    'UPLOAD_SDK: path=',
    objectPath,
    'bodyType=',
    body?.constructor?.name,
    'bytes=',
    bytes.byteLength
  );
  const { data, error } = await supabase.storage
    .from(BAWAAL_VIDEO_BUCKET)
    .upload(objectPath, body, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    console.error('REST_UPLOAD_ERROR (sdk):', error.message || error);
    throw new Error(error.message || 'Supabase SDK storage upload failed');
  }

  // Confirm public URL is resolvable (catches bucket/policy misconfig early)
  try {
    const { data: pub } = supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .getPublicUrl(objectPath);
    if (pub?.publicUrl) {
      console.log('SDK_UPLOAD_PUBLIC_URL:', pub.publicUrl);
    }
  } catch (_) {
    /* non-fatal */
  }

  if (onProgress) onProgress(100);
  console.log('SDK_UPLOAD_OK:', data?.path || objectPath);
  return true;
}

/**
 * Android-safe REST path: file:// → bytes → Blob → fetch POST.
 * Avoids FormData multipart corruption.
 */
async function uploadViaFetchArrayBuffer(
  uploadUrl,
  fileUri,
  anonKey,
  onProgress
) {
  console.log('UPLOAD_BLOB_FETCH: reading', fileUri);
  if (onProgress) onProgress(15);

  const bytes = await readLocalVideoBytes(fileUri);
  const body = bytesToUploadBody(bytes);
  if (onProgress) onProgress(45);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: STORAGE_HEADERS(anonKey),
    body,
  });

  const bodyText = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('REST_UPLOAD_ERROR (blob/fetch):', res.status, bodyText);
    throw new Error(
      bodyText || `Storage Blob upload failed with status ${res.status}`
    );
  }

  if (onProgress) onProgress(100);
  console.log('BLOB_FETCH_UPLOAD_OK: status=', res.status);
  return true;
}

/**
 * Native binary upload via FileSystem (iOS / fallback).
 * Supabase Storage expects raw MP4 bytes — never multipart FormData.
 */
async function uploadViaFileSystemBinary(
  uploadUrl,
  fileUri,
  anonKey,
  onProgress
) {
  const options = {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: STORAGE_HEADERS(anonKey),
  };

  let result;

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
 * Upload bytes to Supabase Storage — SDK → Blob fetch → native FileSystem.
 */
async function uploadVideoBytes(
  uploadUrl,
  objectPath,
  fileUri,
  anonKey,
  onProgress
) {
  const attempts = [
    {
      name: 'supabase-sdk',
      run: () => uploadViaSupabaseSdk(objectPath, fileUri, onProgress),
    },
    {
      name: 'blob-fetch',
      run: () =>
        uploadViaFetchArrayBuffer(uploadUrl, fileUri, anonKey, onProgress),
    },
    {
      name: 'filesystem-binary',
      run: () =>
        uploadViaFileSystemBinary(uploadUrl, fileUri, anonKey, onProgress),
    },
  ];

  // Large F1 / racing clips: stream via native FileSystem first (no full-file
  // ArrayBuffer in JS heap → fewer Android OOM crashes).
  let fileSize = 0;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    fileSize = Number(info?.size) || 0;
  } catch (_) {
    /* ignore */
  }
  const LARGE_CLIP_BYTES = 6 * 1024 * 1024;
  const preferStreaming =
    Platform.OS === 'android' && fileSize >= LARGE_CLIP_BYTES;

  // Android small: SDK → Blob → FS. Android large: FS → SDK → Blob.
  // iOS: SDK → FS → Blob.
  const ordered = preferStreaming
    ? [attempts[2], attempts[0], attempts[1]]
    : Platform.OS === 'android'
      ? [attempts[0], attempts[1], attempts[2]]
      : [attempts[0], attempts[2], attempts[1]];

  let lastErr = null;
  for (const step of ordered) {
    try {
      console.log(
        '[upload] trying',
        step.name,
        fileSize ? `(~${Math.round(fileSize / 1024 / 1024)}MB)` : ''
      );
      await step.run();
      return true;
    } catch (err) {
      lastErr = err;
      console.warn(`[upload] ${step.name} failed:`, err?.message || err);
    }
  }
  throw lastErr || new Error('All storage upload strategies failed');
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
 * @param {{ onProgress?: (pct: number) => void, onError?: (msg: string) => void }} [options]
 * @returns {Promise<string|null>} public HTTPS URL or null (caller must abort post)
 */
export async function uploadVideoToSupabase(videoUri, fileName, options) {
  const onProgress =
    options && typeof options.onProgress === 'function'
      ? options.onProgress
      : null;
  const reportError = (msg) => {
    console.error('UPLOAD_CATCH_ERROR:', msg);
    if (typeof options?.onError === 'function') {
      try {
        options.onError(String(msg || 'Upload failed'));
      } catch (_) {
        /* ignore */
      }
    }
  };

  try {
    console.log('START_UPLOAD: videoUri ->', videoUri);

    // Let loading indicators paint before heavy work stalls the JS thread
    await yieldToUI();
    if (onProgress) onProgress(2);

    const SUPABASE_URL = getEnvSupabaseUrl();
    const ANON_KEY = getEnvAnonKey();

    if (!SUPABASE_URL || !ANON_KEY) {
      reportError(
        'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY'
      );
      return null;
    }

    const resolvedUri = sanitizeVideoUriForUpload(videoUri);
    if (!resolvedUri) {
      reportError('Missing or invalid local videoUri');
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
    const objectPath = `battles/${safeName}`;
    const uploadUrl = buildUploadUrl(SUPABASE_URL, safeName);
    // Exact public playback URL (must include /public/)
    const publicUrl =
      ensurePublicBawaalVideoUrl(buildPublicUrl(SUPABASE_URL, safeName)) ||
      buildPublicUrl(SUPABASE_URL, safeName);

    console.log('UPLOAD_REST_URL:', uploadUrl);
    console.log('UPLOAD_OBJECT_PATH:', objectPath);
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
      const persistMsg = persistErr?.message || String(persistErr);
      console.warn('[upload] persist failed:', persistMsg);
      // content:// often cannot be read as base64 — abort rather than upload junk
      if (/^content:\/\//i.test(resolvedUri)) {
        reportError(
          `Could not copy gallery clip to app storage before upload: ${persistMsg}`
        );
        return null;
      }
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

    // Yield again right before transfer so UI stays buttery
    await yieldToUI();

    // SDK (Blob) → fetch Blob → native FileSystem binary
    await uploadVideoBytes(
      uploadUrl,
      objectPath,
      fileUri,
      ANON_KEY,
      (pct) => {
        if (onProgress) onProgress(Math.max(8, Math.min(100, pct)));
      }
    );
    console.log('PUBLIC_URL:', publicUrl);
    return publicUrl;
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('UPLOAD_CATCH_ERROR:', msg, err);
    reportError(msg);
    return null;
  }
}

/**
 * Copy a camera/cache URI into app document storage so gallery-save / GC
 * cannot invalidate the path before feed upload.
 * @param {string} videoUri
 * @returns {Promise<string>} stable file:// URI (or original on soft failure)
 */
export async function stabilizeLocalVideoUri(videoUri) {
  const sanitized = sanitizeVideoUriForUpload(videoUri);
  if (!sanitized) return videoUri;
  if (isRemoteHttpsUri(sanitized)) return sanitized;
  try {
    const persisted = await persistLocalVideoUri(sanitized);
    return sanitizeVideoUriForUpload(persisted) || persisted || sanitized;
  } catch (err) {
    console.warn(
      '[upload] stabilizeLocalVideoUri failed:',
      err?.message || err
    );
    return sanitized;
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
