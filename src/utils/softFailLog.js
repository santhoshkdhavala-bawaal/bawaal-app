/**
 * Soft-fail logging for Arena / profiles / social.
 * Hot paths must never spam console.log; missing tables / 400s log once per key.
 */

const warnedKeys = new Set();

/**
 * One warn per session key. Safe to call in retries / hydrate loops.
 * @param {string} key
 * @param {string} message
 * @param {unknown} [detail]
 */
export function softFailWarn(key, message, detail) {
  const k = String(key || message || 'soft-fail');
  if (warnedKeys.has(k)) return;
  warnedKeys.add(k);
  if (detail !== undefined) {
    console.warn(message, detail);
  } else {
    console.warn(message);
  }
}

/** No-op stand-in for removed hot-path console.log calls. */
export function softFailDebug() {
  /* intentionally silent — camera / feed hydrate must stay quiet */
}
