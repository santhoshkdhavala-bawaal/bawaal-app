/**
 * LIVE match location → national flag (PUBLIC + PRIVATE).
 * Wraps the worldwide onboarding registry; returns null when unmatched
 * so roster/room chrome never shows a wrong or globe fallback flag.
 */
import { resolveLocationFlag } from './locationFlag';

/**
 * @param {string} locationText
 * @returns {string|null} Flag emoji, or null when no country/city/ISO match
 */
export function getCountryFlagForLocation(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return null;
  try {
    const resolved = resolveLocationFlag(raw);
    if (!resolved?.country || !resolved?.iso) return null;
    const flag = String(resolved.flag || '').trim();
    if (!flag || flag === '🌐') return null;
    return flag;
  } catch {
    return null;
  }
}

/**
 * Prefer stored flag; otherwise derive from location_label.
 * @param {{ country_flag?: string, location_label?: string }|null|undefined} match
 * @returns {string|null}
 */
export function resolveLiveMatchCountryFlag(match) {
  const stored = String(match?.country_flag || '').trim();
  if (stored && stored !== '🌐') return stored;
  return getCountryFlagForLocation(match?.location_label || '');
}

export default getCountryFlagForLocation;
