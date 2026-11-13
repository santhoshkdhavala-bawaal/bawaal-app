/**
 * Local placeholders when remote Supabase / CDN media is missing or fails.
 * Keeps Image from fetching null/empty/"null" URIs (avoids 404 spam).
 */
/* eslint-disable global-require */

/** Default athlete / profile avatar mark. */
export const DEFAULT_AVATAR_ASSET = require('../../assets/BAWAAL_B_solo.png');

/** Generic remote media / poster fallback (same brand mark). */
export const DEFAULT_MEDIA_PLACEHOLDER = require('../../assets/BAWAAL_B_solo.png');

/**
 * True when a value is a usable non-empty remote (or local file) image URI.
 * Rejects null / undefined / "" / "null" / "undefined" / whitespace-only.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUsableRemoteImageUri(value) {
  if (value == null) return false;
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return false;
  if (/^(null|undefined|nan|false)$/i.test(t)) return false;
  // Relative placeholders / schemes that never resolve as profile media
  if (/^(mock:|placeholder:|about:|data:\s*$)/i.test(t)) return false;
  return true;
}

/**
 * Normalize to a trimmed URI string, or `null` when not fetchable.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeRemoteImageUri(value) {
  if (!isUsableRemoteImageUri(value)) return null;
  return String(value).trim();
}
