import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError, looksLikeJwt } from './supabase';

/** Public Supabase Storage bucket for BAWAAL clips */
export const BAWAAL_VIDEO_BUCKET = 'bawaalvideos';

/** Strict env reads — never a user session JWT from supabase.auth */
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
 * Raw Storage REST upload — bypasses supabase-js entirely (no session JWT).
 *
 * Headers use ONLY EXPO_PUBLIC_SUPABASE_ANON_KEY (classic JWT eyJ…).
 * Never attaches supabase.auth.getSession() / user tokens.
 *
 * @param {string} localUri
 * @returns {Promise<string|null>} public HTTPS URL or null
 */
export async function uploadVideoToSupabase(localUri) {
  try {
    console.log('START_UPLOAD: localUri ->', localUri);

    const SUPABASE_URL = getEnvSupabaseUrl();
    const SUPABASE_ANON_KEY = getEnvAnonKey();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('REST_UPLOAD_ERROR: missing EXPO_PUBLIC_SUPABASE_URL or ANON_KEY');
      return null;
    }

    // Storage requires a classic JWT anon key. sb_publishable_* → Invalid Compact JWS.
    if (!looksLikeJwt(SUPABASE_ANON_KEY)) {
      console.error(
        'REST_UPLOAD_ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY is not a JWT ' +
          `(starts with "${SUPABASE_ANON_KEY.slice(0, 18)}…"). ` +
          'Use the classic anon key from Supabase → Project Settings → API (starts with eyJ).'
      );
      return null;
    }

    const fileName = `battle_${Date.now()}.mp4`;
    // Exact path shape: /object/bawaalvideos/battles/{fileName}
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/bawaalvideos/battles/${encodeURIComponent(fileName)}`;
    console.log('UPLOAD_REST_URL:', uploadUrl);

    const response = await fetch(localUri);
    console.log('FETCH_RESPONSE_OK:', response?.ok, 'status:', response?.status);
    const blob = await response.blob();
    console.log('BLOB_READY: size=', blob?.size, 'type=', blob?.type);

    // Strict anon-key auth only — never a user session JWS
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error('REST_UPLOAD_ERROR:', errText);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bawaalvideos/battles/${encodeURIComponent(fileName)}`;
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
