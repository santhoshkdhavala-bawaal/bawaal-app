/**
 * Shared poster / sample-clip fallbacks so Arena never paints a dead black frame.
 */
import { Image } from 'react-native';

/** Bundled sample MP4 — used when video_url is mock / invalid / delayed. */
export const BAWAAL_FALLBACK_MP4 = require('../../assets/sample_challenge.mp4');

/** Stealth poster while the decoder buffers. */
export const BAWAAL_REEL_POSTER = require('../../assets/BAWAAL_white_icon.png');

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
 * expo-av / expo-video source: real URI object, or bundled sample asset.
 * @param {string|null|undefined} uri
 * @returns {{ uri: string } | number}
 */
export function resolveVideoSource(uri) {
  if (isUsablePlaybackUri(uri)) {
    return { uri: String(uri).trim() };
  }
  return BAWAAL_FALLBACK_MP4;
}

/**
 * Poster image source from thumbnail URL or brand icon.
 * @param {string|null|undefined} thumbnailUrl
 */
export function resolvePosterSource(thumbnailUrl) {
  if (isUsablePlaybackUri(thumbnailUrl) && /^https?:\/\//i.test(thumbnailUrl)) {
    return { uri: String(thumbnailUrl).trim() };
  }
  return BAWAAL_REEL_POSTER;
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
