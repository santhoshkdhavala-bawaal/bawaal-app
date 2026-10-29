/**
 * Canonical BAWAAL sport taxonomy — forms, briefs, Arena tabs, publish.
 * LOCKED production list. See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.
 */

/** Full locked taxonomy (forms / briefs / filters). */
export const BAWAAL_SPORT_TAXONOMY = [
  'ALL',
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABADDI',
  'COMBAT',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
  'OTHERS',
];

/** @deprecated Prefer BAWAAL_SPORT_TAXONOMY — kept for Arena imports. */
export const ARENA_SPORT_TABS = BAWAAL_SPORT_TAXONOMY;

/** Publish / picker options (excludes ALL). */
export const ARENA_SPORT_OPTIONS = BAWAAL_SPORT_TAXONOMY.filter((t) => t !== 'ALL');

/** Alias used by Squad Brief + battle forms (includes ALL). */
export const BAWAAL_FORM_SPORTS = BAWAAL_SPORT_TAXONOMY;

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
  throttle: 'THROTTLE',
  racing: 'THROTTLE',
  motorsport: 'THROTTLE',
  'wave & blade': 'WAVE & BLADE',
  wave: 'WAVE & BLADE',
  blade: 'WAVE & BLADE',
  surfing: 'WAVE & BLADE',
  'court kings': 'COURT KINGS',
  basketball: 'COURT KINGS',
  court: 'COURT KINGS',
  'sky & summit': 'SKY & SUMMIT',
  climbing: 'SKY & SUMMIT',
  summit: 'SKY & SUMMIT',
  others: 'OTHERS',
  other: 'OTHERS',
  misc: 'OTHERS',
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
  if (BAWAAL_SPORT_TAXONOMY.includes(upper)) return upper;
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
  return BAWAAL_SPORT_TAXONOMY.includes(key) ? key : 'OTHERS';
}
