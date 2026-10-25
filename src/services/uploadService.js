import * as FileSystem from 'expo-file-system/legacy';
import { isCloudAuthError, supabase } from './supabase';

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
 * Direct anonymous upload to public `bawaalvideos` bucket.
 * NO getSession / canAttemptCloudUpload / auth gates.
 * Never throws — returns public HTTPS URL string or null.
 *
 * @param {string} localUri
 * @returns {Promise<string|null>}
 */
export async function uploadVideoToSupabase(localUri) {
  console.log('START_UPLOAD: localUri ->', localUri);

  let blob;
  try {
    // Fetch local file and convert to Blob
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
    console.log('UPLOAD_PATH:', filePath);

    // Direct upload to public bucket (anon key — no user session)
    const { data, error } = await supabase.storage
      .from('bawaalvideos')
      .upload(filePath, blob, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (error) {
      console.error(
        'SUPABASE_ERROR_DETAILS:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
      return null;
    }

    console.log('UPLOAD_OK: path=', data?.path || filePath);

    // Retrieve public HTTPS URL
    const { data: publicUrlData } = supabase.storage
      .from('bawaalvideos')
      .getPublicUrl(filePath);

    console.log('PUBLIC_URL:', publicUrlData?.publicUrl);
    return publicUrlData?.publicUrl || null;
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
