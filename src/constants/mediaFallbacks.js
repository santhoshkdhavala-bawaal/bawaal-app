/**
 * Local placeholders when remote Supabase / CDN media is missing or fails.
 * Keeps Image from fetching null/empty/"null" URIs (avoids 404 spam).
 * Session cache of failed URLs skips repeat network hits after the first 404.
 */
/* eslint-disable global-require */

/** Default athlete / profile avatar mark. */
export const DEFAULT_AVATAR_ASSET = require('../../assets/BAWAAL_B_solo.png');

/** Generic remote media / poster fallback (same brand mark). */
export const DEFAULT_MEDIA_PLACEHOLDER = require('../../assets/BAWAAL_B_solo.png');

/** URIs that already 404'd this session — never re-fetch. */
const failedRemoteImageUris = new Set();

/**
 * Remember a remote URI that failed to load (404 / decode error).
 * @param {unknown} value
 */
export function rememberFailedRemoteImageUri(value) {
  const uri = normalizeRemoteImageUri(value, { skipFailedCache: true });
  if (uri) failedRemoteImageUris.add(uri);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasFailedRemoteImageUri(value) {
  const uri = normalizeRemoteImageUri(value, { skipFailedCache: true });
  return Boolean(uri && failedRemoteImageUris.has(uri));
}

/**
 * True when a value is a usable non-empty remote (or local file) image URI.
 * Rejects null / undefined / "" / "null" / "undefined" / whitespace-only /
 * incomplete Supabase Storage paths / previously failed URLs.
 * @param {unknown} value
 * @param {{ skipFailedCache?: boolean }} [opts]
 * @returns {boolean}
 */
export function isUsableRemoteImageUri(value, opts = {}) {
  if (value == null) return false;
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return false;
  if (/^(null|undefined|nan|false)$/i.test(t)) return false;
  // Relative placeholders / schemes that never resolve as profile media
  if (/^(mock:|placeholder:|about:|data:\s*$)/i.test(t)) return false;
  // Broken storage object keys often land as ".../public/avatars/" or ".../null"
  if (/\/(null|undefined|nan)(\/|$|\?)/i.test(t)) return false;
  if (/\/storage\/v1\/object\/public\/[^/]+\/?$/i.test(t)) return false;
  if (/\/storage\/v1\/object\/public\/[^/]+\/\?/.test(t)) return false;
  if (!opts.skipFailedCache && failedRemoteImageUris.has(t)) return false;
  return true;
}

/**
 * Normalize to a trimmed URI string, or `null` when not fetchable.
 * @param {unknown} value
 * @param {{ skipFailedCache?: boolean }} [opts]
 * @returns {string|null}
 */
export function normalizeRemoteImageUri(value, opts = {}) {
  if (!isUsableRemoteImageUri(value, opts)) return null;
  return String(value).trim();
}
