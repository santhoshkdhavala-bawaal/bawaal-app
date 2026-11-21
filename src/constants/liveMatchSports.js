/**
 * Live Match Telecast sports — picker list for GO LIVE setup.
 * Merges locked BAWAAL_SPORTS (minus ALL) with granular court sports used
 * in live telecasts. Does NOT mutate GAME_ON_CATEGORY_PILLS / BAWAAL_SPORTS.
 */
import { BAWAAL_SPORTS_WITHOUT_ALL } from './sports';

/** Extra live-telecast sports called out in product (not BAWAAL form keys). */
const LIVE_MATCH_EXTRA_SPORTS = Object.freeze([
  'VOLLEYBALL',
  'BASKETBALL',
  'BADMINTON',
]);

/**
 * Full GO LIVE dropdown options — every BAWAAL taxonomy sport + extras.
 * `OTHERS` from taxonomy is normalized to `OTHER` for live matches.
 */
function buildLiveMatchSports() {
  const set = new Set();
  BAWAAL_SPORTS_WITHOUT_ALL.forEach((s) => {
    const key = String(s || '').trim().toUpperCase();
    if (!key || key === 'ALL') return;
    set.add(key === 'OTHERS' ? 'OTHER' : key);
  });
  LIVE_MATCH_EXTRA_SPORTS.forEach((s) => set.add(s));
  set.add('OTHER');

  const list = Array.from(set);
  list.sort((a, b) => {
    if (a === 'OTHER') return 1;
    if (b === 'OTHER') return -1;
    return a.localeCompare(b);
  });
  return Object.freeze(list);
}

export const LIVE_MATCH_SPORTS = buildLiveMatchSports();

/** Current GO LIVE default (kept from Phase 1). */
export const DEFAULT_LIVE_MATCH_SPORT = 'FOOTBALL';
