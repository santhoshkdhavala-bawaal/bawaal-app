/**
 * LIVE match location → national flag meta (PUBLIC + PRIVATE).
 * Wraps the worldwide onboarding registry; returns null when unmatched
 * so roster/room chrome never shows a wrong or globe fallback flag.
 *
 * Prefer flagcdn PNG (`flagImageUri`) for crisp Windows/web rendering;
 * `flagEmoji` remains the offline / onError fallback.
 */
import { resolveLocationFlag } from './locationFlag';

/**
 * @typedef {{ isoCode: string, flagEmoji: string, countryName: string, flagImageUri: string }} LiveCountryFlagMeta
 */

/**
 * @param {string} isoCode
 * @returns {string}
 */
export function flagCdnUri(isoCode) {
  const iso = String(isoCode || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) return '';
  return `https://flagcdn.com/w80/${iso}.png`;
}

/**
 * @param {string} locationText
 * @returns {LiveCountryFlagMeta|null}
 */
export function getCountryFlagForLocation(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return null;
  try {
    const resolved = resolveLocationFlag(raw);
    if (!resolved?.country || !resolved?.iso) return null;
    const isoCode = String(resolved.iso || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(isoCode)) return null;
    const flagEmoji = String(resolved.flag || '').trim();
    if (!flagEmoji || flagEmoji === '🌐') return null;
    return {
      isoCode,
      flagEmoji,
      countryName: String(resolved.country || '').trim() || isoCode,
      flagImageUri: flagCdnUri(isoCode),
    };
  } catch {
    return null;
  }
}

/**
 * Prefer stored iso/flag; otherwise derive from location_label.
 * @param {{
 *   country_iso?: string,
 *   country_flag?: string,
 *   country_name?: string,
 *   location_label?: string,
 * }|null|undefined} match
 * @returns {LiveCountryFlagMeta|null}
 */
export function resolveLiveMatchCountryFlag(match) {
  const derived = getCountryFlagForLocation(match?.location_label || '');
  const storedIso = String(match?.country_iso || match?.countryIso || '')
    .trim()
    .toUpperCase();
  const storedEmoji = String(match?.country_flag || '').trim();
  const storedName = String(
    match?.country_name || match?.countryName || ''
  ).trim();

  if (/^[A-Z]{2}$/.test(storedIso)) {
    const flagEmoji =
      (storedEmoji && storedEmoji !== '🌐' ? storedEmoji : '') ||
      derived?.flagEmoji ||
      '';
    if (!flagEmoji && !derived) {
      // ISO alone is enough for CDN image; emoji optional
      return {
        isoCode: storedIso,
        flagEmoji: '',
        countryName: storedName || derived?.countryName || storedIso,
        flagImageUri: flagCdnUri(storedIso),
      };
    }
    return {
      isoCode: storedIso,
      flagEmoji: flagEmoji || derived?.flagEmoji || '',
      countryName: storedName || derived?.countryName || storedIso,
      flagImageUri: flagCdnUri(storedIso),
    };
  }

  if (derived) return derived;

  if (storedEmoji && storedEmoji !== '🌐') {
    return {
      isoCode: '',
      flagEmoji: storedEmoji,
      countryName: storedName || '',
      flagImageUri: '',
    };
  }

  return null;
}

export default getCountryFlagForLocation;
