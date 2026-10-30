/**
 * Safe local placeholder clip when native recordAsync fails (esp. Android).
 * Never leave the user on a black / error recording screen.
 */
import { Image } from 'react-native';
import { BAWAAL_FALLBACK_MP4 } from './reelMediaFallback';
import { validateRecordedVideoUri } from './recordedVideoUri';

/** Max wait for native stopRecording / recordAsync flush before sample fallback. */
export const STOP_SAVE_TIMEOUT_MS = 2000;

/**
 * Race a promise against a hard timeout. Never leaves callers hanging on
 * expo-camera Invariant / muxer stalls.
 * @template T
 * @param {Promise<T>|T} promise
 * @param {number} [ms]
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function raceWithTimeout(
  promise,
  ms = STOP_SAVE_TIMEOUT_MS,
  label = 'operation'
) {
  const limit = Math.max(250, Number(ms) || STOP_SAVE_TIMEOUT_MS);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timeout after ${limit}ms`));
    }, limit);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Stop native capture + await recordAsync settle, with a strict timeout.
 * On Invariant / reject / hang → returns sample-clip URI so preview can open.
 *
 * @param {{
 *   stopRecording?: () => unknown,
 *   recordPromise?: Promise<{ uri?: string }|null>|null,
 *   timeoutMs?: number,
 * }} opts
 * @returns {Promise<{ uri: string, usedFallback: boolean, timedOut?: boolean, error?: string }>}
 */
export async function settleStopRecording(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? STOP_SAVE_TIMEOUT_MS;
  let stopError = null;

  try {
    const stopFn = opts.stopRecording;
    if (typeof stopFn === 'function') {
      const stopResult = stopFn();
      if (stopResult != null && typeof stopResult.then === 'function') {
        await raceWithTimeout(
          Promise.resolve(stopResult).catch((err) => {
            stopError = err;
            return null;
          }),
          timeoutMs,
          'stopRecording'
        );
      }
    }
  } catch (err) {
    stopError = err;
  }

  const pending = opts.recordPromise;
  if (pending && typeof pending.then === 'function') {
    try {
      const video = await raceWithTimeout(pending, timeoutMs, 'recordAsync settle');
      const coalesced = coalesceRecordingUri(
        video && typeof video === 'object' ? video.uri : null
      );
      return {
        ...coalesced,
        timedOut: false,
        error: stopError ? String(stopError?.message || stopError) : undefined,
      };
    } catch (err) {
      const msg = String(err?.message || err || '');
      console.warn(
        '[safeRecordingFallback] stop/save bypass — sample clip:',
        msg
      );
      return {
        uri: resolveSafeRecordingFallbackUri(),
        usedFallback: true,
        timedOut: /timeout/i.test(msg),
        error: msg,
      };
    }
  }

  if (stopError) {
    console.warn(
      '[safeRecordingFallback] stopRecording error — sample clip:',
      stopError?.message || stopError
    );
  }
  return {
    uri: resolveSafeRecordingFallbackUri(),
    usedFallback: true,
    timedOut: false,
    error: stopError ? String(stopError?.message || stopError) : undefined,
  };
}

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

  const timeoutMs = opts.timeoutMs ?? STOP_SAVE_TIMEOUT_MS;
  try {
    const stable = await raceWithTimeout(
      Promise.resolve().then(() => persist(first.uri)),
      timeoutMs,
      'persist/save'
    );
    const next = coalesceRecordingUri(stable || first.uri);
    return next;
  } catch (err) {
    const msg = String(err?.message || err || '');
    console.warn(
      '[safeRecordingFallback] persist/codec/timeout — sample clip:',
      msg
    );
    return {
      uri: resolveSafeRecordingFallbackUri(),
      usedFallback: true,
    };
  }
}
