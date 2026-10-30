/**
 * Safe local placeholder clip when native recordAsync fails (esp. Android).
 * Never leave the user on a black / error recording screen.
 */
import { Image } from 'react-native';
import { BAWAAL_FALLBACK_MP4 } from './reelMediaFallback';
import { validateRecordedVideoUri } from './recordedVideoUri';

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
 * @param {(u: unknown) => { ok: boolean, uri?: string, mock?: boolean }} [validate]
 * @returns {{ uri: string, usedFallback: boolean }}
 */
export function coalesceRecordingUri(uri, validate = validateRecordedVideoUri) {
  try {
    if (uri == null || (typeof uri === 'string' && !uri.trim())) {
      return {
        uri: resolveSafeRecordingFallbackUri(),
        usedFallback: true,
      };
    }
    const check = typeof validate === 'function' ? validate(uri) : null;
    if (check?.ok && check.uri) {
      return { uri: check.uri, usedFallback: !!check.mock };
    }
  } catch (err) {
    console.warn(
      '[safeRecordingFallback] coalesce failed:',
      err?.message || err
    );
  }
  return {
    uri: resolveSafeRecordingFallbackUri(),
    usedFallback: true,
  };
}

/**
 * Normalize a just-stopped recording URI for preview/post.
 * Treats null, empty, codec/persist failures as sample-clip fallbacks.
 *
 * @param {unknown} uri
 * @param {{ persist?: (u: string) => Promise<string|null> }} [opts]
 * @returns {Promise<{ uri: string, usedFallback: boolean }>}
 */
export async function ensurePlayableRecordingUri(uri, opts = {}) {
  const first = coalesceRecordingUri(uri);
  if (first.usedFallback) return first;

  const persist = typeof opts.persist === 'function' ? opts.persist : null;
  if (!persist) return first;

  try {
    const stable = await persist(first.uri);
    const next = coalesceRecordingUri(stable || first.uri);
    return next;
  } catch (err) {
    const msg = String(err?.message || err || '');
    console.warn(
      '[safeRecordingFallback] persist/codec failed — sample clip:',
      msg
    );
    return {
      uri: resolveSafeRecordingFallbackUri(),
      usedFallback: true,
    };
  }
}
