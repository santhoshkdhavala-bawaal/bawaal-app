import * as FileSystem from 'expo-file-system/legacy';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isCloudAuthError,
  looksLikeJwt,
} from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

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
 * Anonymous upload via Storage REST — bypasses supabase-js so a stale/bad
 * user session JWT is never attached (fixes Invalid Compact JWS / 403).
 *
 * POST {SUPABASE_URL}/storage/v1/object/bawaalvideos/{path}
 * Headers: apikey + (Bearer only when key is a real JWT anon key)
 *
 * Never throws — returns public HTTPS URL string or null.
 *
 * @param {string} localUri
 * @returns {Promise<string|null>}
 */
export async function uploadVideoToSupabase(localUri) {
  console.log('START_UPLOAD: localUri ->', localUri);

  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    console.error('SUPABASE_ERROR_DETAILS: missing EXPO_PUBLIC_SUPABASE_URL or ANON_KEY');
    return null;
  }

  let blob;
  try {
    const response = await fetch(localUri);
    console.log('FETCH_RESPONSE_OK:', response?.ok, 'status:', response?.status);
    blob = await response.blob();
    console.log('BLOB_READY: size=', blob?.size, 'type=', blob?.type);
  } catch (err) {
    console.error('BLOB_FETCH_ERROR:', err);
    return null;
  }

  try {
    const fileName = `battle_${Date.now()}.mp4`;
    const filePath = `battles/${fileName}`;
    // Encode each path segment for the REST URL
    const encodedPath = filePath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const uploadUrl = `${baseUrl}/storage/v1/object/${BAWAAL_VIDEO_BUCKET}/${encodedPath}`;
    console.log('UPLOAD_PATH:', filePath);
    console.log('UPLOAD_REST_URL:', uploadUrl);

    /** @type {Record<string, string>} */
    const headers = {
      apikey: anonKey,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true',
    };

    // Only attach Bearer when the key is a classic JWT. `sb_publishable_*` is NOT a
    // JWS — sending it as Authorization causes "Invalid Compact JWS" / AccessDenied.
    if (looksLikeJwt(anonKey)) {
      headers.Authorization = `Bearer ${anonKey}`;
    } else {
      console.warn(
        '[upload] Non-JWT anon key detected (e.g. sb_publishable_). ' +
          'Uploading with apikey only — prefer the classic JWT anon key from ' +
          'Supabase → Project Settings → API for Storage.'
      );
      // Explicitly do NOT set Authorization (avoids injecting a bad session/JWS)
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: blob,
    });

    const responseText = await uploadRes.text();
    console.log('UPLOAD_HTTP_STATUS:', uploadRes.status, responseText?.slice?.(0, 400));

    if (!uploadRes.ok) {
      console.error(
        'SUPABASE_ERROR_DETAILS:',
        JSON.stringify(
          {
            status: uploadRes.status,
            statusText: uploadRes.statusText,
            body: responseText,
          },
          null,
          2
        )
      );
      return null;
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/${BAWAAL_VIDEO_BUCKET}/${encodedPath}`;
    console.log('PUBLIC_URL:', publicUrl);
    console.log('UPLOAD_OK: path=', filePath);
    return publicUrl;
  } catch (err) {
    console.error(
      'SUPABASE_ERROR_DETAILS:',
      JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2)
    );
    console.error('UPLOAD_CATCH_ERROR:', err);
    return null;
  }
}

/**
 * Thin wrapper for PostCreationSheet / battle flows.
 * Never throws. Uses uploadVideoToSupabase with no auth gates.
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
