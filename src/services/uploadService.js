import * as FileSystem from 'expo-file-system/legacy';
import { supabase, isSupabaseConfigured } from './supabase';

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

/**
 * Copy camera temp clips into app document storage so POST still works after review.
 * Camera cache URIs often disappear → fetch/read then returns 404.
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

    // Already under our docs folder — keep as-is
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
 * Verify local clip exists and load bytes via FileSystem (avoids fetch 404 on file://).
 */
export async function readLocalVideoBytes(localUri) {
  let uri = normalizeLocalUri(localUri);
  if (!uri) throw new Error('Missing local video URI for upload');
  if (uri.startsWith('emulator-mock://')) {
    throw new Error('Cannot upload emulator mock clip to cloud storage');
  }

  // Prefer FileSystem for file:// paths — fetch(file://) often returns 404 on RN.
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

  // content:// — copy into docs then read as file
  if (uri.startsWith('content://') || uri.startsWith('ph://')) {
    const stable = await persistLocalVideoUri(uri);
    return readLocalVideoBytes(stable);
  }

  // Remote HTTPS — fetch is appropriate
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
 * Upload a local battle clip to the public `battle-videos` storage bucket.
 * Returns the public HTTPS URL for the uploaded object.
 */
export const uploadBattleVideo = async (localUri) => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
    );
  }

  try {
    const filename = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp4`;
    const stableUri = await persistLocalVideoUri(localUri);
    const arrayBuffer = await readLocalVideoBytes(stableUri);

    const { error } = await supabase.storage.from('battle-videos').upload(filename, arrayBuffer, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('battle-videos')
      .getPublicUrl(filename);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Upload succeeded but public URL was not returned');
    }

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error uploading battle video:', err);
    throw err;
  }
};

export { normalizeLocalUri };
