/**
 * Safe local placeholder clip when native recordAsync fails (esp. Android).
 * Never leave the user on a black / error recording screen.
 */
import { Image } from 'react-native';
import { BAWAAL_FALLBACK_MP4 } from './reelMediaFallback';

/**
 * Resolve bundled `sample_challenge.mp4` to a playable URI.
 * Falls back to emulator-mock scheme if asset resolution fails.
 * @returns {string}
 */
export function resolveSafeRecordingFallbackUri() {
  try {
    const src = Image.resolveAssetSource(BAWAAL_FALLBACK_MP4);
    if (src?.uri && typeof src.uri === 'string' && src.uri.trim()) {
      return src.uri.trim();
    }
  } catch (err) {
    console.warn(
      '[safeRecordingFallback] asset resolve failed:',
      err?.message || err
    );
  }
  return `emulator-mock://${Date.now()}.mp4`;
}

/**
 * Prefer a validated recorded URI; otherwise return the safe sample clip.
 * @param {unknown} uri
 * @param {(u: unknown) => { ok: boolean, uri?: string }} validate
 * @returns {{ uri: string, usedFallback: boolean }}
 */
export function coalesceRecordingUri(uri, validate) {
  try {
    const check = typeof validate === 'function' ? validate(uri) : null;
    if (check?.ok && check.uri) {
      return { uri: check.uri, usedFallback: !!check.mock };
    }
  } catch (_) {
    /* ignore */
  }
  return {
    uri: resolveSafeRecordingFallbackUri(),
    usedFallback: true,
  };
}
