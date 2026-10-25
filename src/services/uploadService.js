import * as FileSystem from 'expo-file-system/legacy';
import {
  supabase,
  getSupabaseUrl,
  getSupabaseAnonKey,
  isCloudAuthError,
} from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

/**
 * Resolve project URL — prefer shared helper, fall back to env.
 * Never a user session JWT from supabase.auth.
 */
function resolveSupabaseUrl() {
  const fromHelper = getSupabaseUrl?.() || '';
  if (fromHelper) return fromHelper;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return typeof url === 'string' ? url.replace(/\/$/, '').trim() : '';
}

/**
 * Resolve anon / publishable key for Storage REST headers.
 * Accepts classic JWT (`eyJ…`) and newer `sb_publishable_…` keys alike —
 * no format/regex rejection.
 */
function resolveAnonKey() {
  const fromHelper = getSupabaseAnonKey?.() || '';
  if (fromHelper) return fromHelper;
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
 * Read local video URI into a binary body (Blob preferred, ArrayBuffer fallback).
 */
async function readVideoBinary(localUri) {
  const uri = normalizeLocalUri(localUri) || localUri;
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      `Failed to read local video (HTTP ${response.status}) from ${uri}`
    );
  }

  try {
    const blob = await response.blob();
    if (blob && typeof blob.size === 'number' && blob.size > 0) {
      return { body: blob, byteLength: blob.size, kind: 'blob' };
    }
  } catch (blobErr) {
    console.warn(
      '[upload] blob() failed, falling back to arrayBuffer:',
      blobErr?.message || blobErr
    );
  }

  // Re-fetch for ArrayBuffer — response body may already be consumed
  const retry = await fetch(uri);
  if (!retry.ok) {
    throw new Error(
      `Failed to re-read local video (HTTP ${retry.status}) from ${uri}`
    );
  }
  const buffer = await retry.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Local video file is empty (0 bytes)');
  }
  return { body: buffer, byteLength: buffer.byteLength, kind: 'arrayBuffer' };
}

/**
 * Raw Storage REST upload to `bawaalvideos/battles/{fileName}`.
 *
 * Headers use EXPO_PUBLIC_SUPABASE_ANON_KEY as-is (JWT `eyJ…` or `sb_publishable_…`).
 * Never attaches supabase.auth.getSession() / user tokens.
 *
 * @param {string} localUri
 * @returns {Promise<string|null>} public HTTPS URL or null (caller must abort post)
 */
export async function uploadVideoToSupabase(localUri) {
  try {
    console.log('START_UPLOAD: localUri ->', localUri);

    const SUPABASE_URL = resolveSupabaseUrl();
    const SUPABASE_ANON_KEY = resolveAnonKey();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error(
        'REST_UPLOAD_ERROR: missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY'
      );
      return null;
    }

    console.log(
      'UPLOAD_KEY_PREFIX:',
      SUPABASE_ANON_KEY.slice(0, 18) + '…',
      '(len=' + SUPABASE_ANON_KEY.length + ')'
    );

    const fileName = `battle_${Date.now()}.mp4`;
    const objectPath = `battles/${fileName}`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/bawaalvideos/${objectPath}`;
    console.log('UPLOAD_REST_URL:', uploadUrl);

    const { body, byteLength, kind } = await readVideoBinary(localUri);
    console.log('BLOB_READY: size=', byteLength, 'kind=', kind);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error(
        'REST_UPLOAD_ERROR:',
        uploadResponse.status,
        uploadResponse.statusText,
        errText
      );
      return null;
    }

    const { data } = supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .getPublicUrl(objectPath);

    const publicUrl =
      typeof data?.publicUrl === 'string' && data.publicUrl.length > 0
        ? data.publicUrl
        : `${SUPABASE_URL}/storage/v1/object/public/bawaalvideos/${objectPath}`;

    if (!isRemoteHttpsUri(publicUrl)) {
      console.error('REST_UPLOAD_ERROR: getPublicUrl did not return HTTPS URL', publicUrl);
      return null;
    }

    console.log('PUBLIC_URL:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('UPLOAD_CATCH_ERROR:', err);
    return null;
  }
}

/**
 * Thin wrapper for PostCreationSheet / battle flows.
 * Never throws. Uses uploadVideoToSupabase with no auth gates.
 * When publicUrl is null, callers must NOT create a feed post.
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

  const publicUrl = await uploadVideoToSupabase(stableUri);
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
