/**
 * Shared poster / sample-clip fallbacks so Arena never paints a dead black frame.
 */
import { Image } from 'react-native';

/**
 * Former bundled sample_challenge.mp4 was removed from assets.
 * Keep a null placeholder so Metro never resolves a missing require —
 * feed players use resolveVideoSource → null (black shell), and
 * recording fallback soft-fails to emulator-mock://.
 */
export const BAWAAL_FALLBACK_MP4 = null;

/** Brand mark for non-feed poster prefetch only (feed players stay black underlay). */
export const BAWAAL_REEL_POSTER = require('../../assets/BAWAAL_B_solo.png');

export function isUsablePlaybackUri(uri) {
  if (uri == null || typeof uri !== 'string') return false;
  const t = uri.trim();
  if (!t || t === 'null' || t === 'undefined') return false;
  // Reject obvious mock / relative placeholders
  if (/^(mock|placeholder|local:|blob:)/i.test(t)) return false;
  if (t.startsWith('/') && !t.startsWith('file://') && !t.startsWith('/data')) {
    return false;
  }
  return (
    t.startsWith('https://') ||
    t.startsWith('http://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library://')
  );
}

/**
 * expo-av source for feed players: URI object only.
 * Returns null when the URI is unusable — callers must show a black shell
 * instead of sync-swapping to the bundled sample (freezes the JS thread).
 * @param {string|null|undefined} uri
 * @returns {{ uri: string } | null}
 */
export function resolveVideoSource(uri) {
  if (isUsablePlaybackUri(uri)) {
    return { uri: String(uri).trim() };
  }
  return null;
}

/**
 * Poster image source from a real thumbnail URL only.
 * Returns null when missing — callers must use a solid black underlay
 * (never the BAWAAL logo, which blinks during feed recycle / buffer).
 * @param {string|null|undefined} thumbnailUrl
 * @returns {{ uri: string } | null}
 */
export function resolvePosterSource(thumbnailUrl) {
  if (isUsablePlaybackUri(thumbnailUrl) && /^https?:\/\//i.test(thumbnailUrl)) {
    return { uri: String(thumbnailUrl).trim() };
  }
  return null;
}

/** Prefetch brand poster once so first open is never blank. */
export function prefetchReelPoster() {
  try {
    const src = Image.resolveAssetSource(BAWAAL_REEL_POSTER);
    if (src?.uri) {
      Image.prefetch(src.uri).catch(() => {});
    }
  } catch (_) {
    /* ignore */
  }
}
