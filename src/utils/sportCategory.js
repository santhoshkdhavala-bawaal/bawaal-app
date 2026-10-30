/**
 * Canonical BAWAAL sport taxonomy helpers — forms, briefs, Arena, GAME ON, publish.
 * Source of truth: `src/constants/sports.js` → `BAWAAL_SPORTS`.
 * LOCKED. See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.
 */

import {
  BAWAAL_SPORTS,
  BAWAAL_SPORT_TAXONOMY,
  BAWAAL_SPORTS_WITHOUT_ALL,
} from '../constants/sports';

export {
  BAWAAL_SPORTS,
  BAWAAL_SPORT_TAXONOMY,
  BAWAAL_SPORTS_WITHOUT_ALL,
};

/** @deprecated Prefer BAWAAL_SPORTS / BAWAAL_SPORT_TAXONOMY. */
export const ARENA_SPORT_TABS = BAWAAL_SPORTS;

/** Publish / picker options (excludes ALL). */
export const ARENA_SPORT_OPTIONS = BAWAAL_SPORTS_WITHOUT_ALL;

/** Alias used by Squad Brief + battle forms (includes ALL). */
export const BAWAAL_FORM_SPORTS = BAWAAL_SPORTS;

const ALIASES = {
  all: 'ALL',
  cricket: 'CRICKET',
  football: 'FOOTBALL',
  soccer: 'FOOTBALL',
  futbol: 'FOOTBALL',
  gym: 'GYM',
  lifting: 'GYM',
  fitness: 'GYM',
  workout: 'GYM',
  kabaddi: 'KABADDI',
  combat: 'COMBAT',
  mma: 'COMBAT',
  ufc: 'COMBAT',
  boxing: 'COMBAT',
  striking: 'COMBAT',
  bjj: 'COMBAT',
  wrestling: 'COMBAT',
  judo: 'COMBAT',
  karate: 'COMBAT',
  taekwondo: 'COMBAT',
  throttle: 'THROTTLE',
  racing: 'THROTTLE',
  motorsport: 'THROTTLE',
  'wave & blade': 'WAVE & BLADE',
  wave: 'WAVE & BLADE',
  blade: 'WAVE & BLADE',
  surfing: 'WAVE & BLADE',
  swimming: 'WAVE & BLADE',
  'court kings': 'COURT KINGS',
  basketball: 'COURT KINGS',
  tennis: 'COURT KINGS',
  badminton: 'COURT KINGS',
  court: 'COURT KINGS',
  'sky & summit': 'SKY & SUMMIT',
  climbing: 'SKY & SUMMIT',
  athletics: 'SKY & SUMMIT',
  summit: 'SKY & SUMMIT',
  others: 'OTHERS',
  other: 'OTHERS',
  misc: 'OTHERS',
  golf: 'OTHERS',
  baseball: 'OTHERS',
  rugby: 'OTHERS',
};

/**
 * Normalize any sport/category string → canonical tab key (or null).
 * @param {unknown} value
 * @returns {string|null}
 */
export function canonicalizeSport(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (BAWAAL_SPORTS.includes(upper)) return upper;
  const collapsed = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (ALIASES[collapsed]) return ALIASES[collapsed];
  const compact = collapsed.replace(/[^a-z0-9]+/g, '');
  for (const [alias, canon] of Object.entries(ALIASES)) {
    if (alias.replace(/[^a-z0-9]+/g, '') === compact) return canon;
  }
  return upper;
}

/**
 * Whether a feed item belongs under the selected Arena sport tab.
 * Case-insensitive; checks sport + category; ALL matches everything.
 */
export function matchesSportFilter(item, activeTab) {
  const tab = canonicalizeSport(activeTab) || 'ALL';
  if (!tab || tab === 'ALL') return true;
  if (!item) return false;

  const candidates = [
    item.sport,
    item.category,
    item.sport_tag,
    item.sportTag,
    item.sport_category,
    item.sportCategory,
  ];
  for (const c of candidates) {
    const key = canonicalizeSport(c);
    if (key && key === tab) return true;
  }
  return false;
}

/**
 * Pick a canonical sport for a new/hydrated post.
 */
export function resolvePostSport(post, fallback = 'GYM') {
  const key =
    canonicalizeSport(post?.category) ||
    canonicalizeSport(post?.sport) ||
    canonicalizeSport(post?.sport_category) ||
    canonicalizeSport(fallback) ||
    'GYM';
  if (key === 'ALL') return 'GYM';
  return BAWAAL_SPORTS.includes(key) ? key : 'OTHERS';
}
