/**
 * Resolve a country flag emoji from free-text location
 * (e.g. "Mumbai, India", "Timbuktu, Mali", "Khartoum, Sudan", "Kabul, Afghanistan").
 * Uses the full worldwide ISO registry — case-insensitive.
 *
 * LOCKED with onboarding — see `.cursor/rules/bawaal-onboarding-locked.mdc`.
 */
import { WORLD_COUNTRIES } from '../data/worldCountries';

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hitName(haystack, needle) {
  if (!needle) return false;
  if (haystack === needle) return true;
  if (haystack.endsWith(` ${needle}`) || haystack.startsWith(`${needle} `)) return true;
  if (haystack.includes(`, ${needle}`) || haystack.includes(`${needle},`)) return true;
  // Word-boundary style for multi-word countries
  const re = new RegExp(
    `(^|[,\\s])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[,\\s])`,
    'i'
  );
  return re.test(haystack);
}

/**
 * @param {string} locationText
 * @returns {{ flag: string, country: string|null, iso: string|null }}
 */
export function resolveLocationFlag(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return { flag: '', country: null, iso: null };

  const normalized = normalize(raw);
  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // Prefer last comma segment as country ("Mumbai, India")
  const candidates = [...parts].reverse();

  for (const candidate of candidates) {
    for (const entry of WORLD_COUNTRIES) {
      if (entry.names.includes(candidate) || candidate === normalize(entry.label)) {
        return { flag: entry.flag, country: entry.label, iso: entry.iso };
      }
    }
  }

  // Full-string / alias contains country name (skip ultra-short ISO aliases like "in","us")
  for (const entry of WORLD_COUNTRIES) {
    for (const name of entry.names) {
      if (name.length < 3) continue;
      if (hitName(normalized, name)) {
        return { flag: entry.flag, country: entry.label, iso: entry.iso };
      }
    }
  }

  // Short ISO aliases only when they are a whole comma segment ("..., US")
  for (const candidate of candidates) {
    if (candidate.length > 3) continue;
    for (const entry of WORLD_COUNTRIES) {
      if (entry.names.includes(candidate)) {
        return { flag: entry.flag, country: entry.label, iso: entry.iso };
      }
    }
  }

  // City fallback (longer city names first to reduce false positives)
  const cityHits = [];
  for (const entry of WORLD_COUNTRIES) {
    for (const city of entry.cities || []) {
      if (!city || city.length < 3) continue;
      if (hitName(normalized, city)) {
        cityHits.push({ entry, city, len: city.length });
      }
    }
  }
  if (cityHits.length) {
    cityHits.sort((a, b) => b.len - a.len);
    const best = cityHits[0].entry;
    return { flag: best.flag, country: best.label, iso: best.iso };
  }

  return { flag: '🌐', country: null, iso: null };
}

export default resolveLocationFlag;
