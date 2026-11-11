/**
 * Arena feed destination / battle-tier filter pills (not sport taxonomy).
 * Keys align with PostDestinationSelector ArenaTier values.
 */

export const ARENA_FEED_TIER_ALL = 'all';

export const ARENA_FEED_TIERS = [
  { id: 'all', label: 'All' },
  { id: 'group_battle', label: 'Bawaal Battle' },
  { id: 'dark_arena', label: 'Dark Arena' },
  { id: 'pro_faceoff', label: 'Faceoff' },
  { id: 'war_cry_live', label: 'War Cry' },
];

const TIER_IDS = new Set(
  ARENA_FEED_TIERS.map((t) => t.id).filter((id) => id !== 'all')
);

/**
 * Resolve a feed card → filter tier id.
 * Missing / social posts resolve to null (visible under All only).
 */
export function resolveArenaFeedTier(item) {
  if (!item || typeof item !== 'object') return null;

  const explicit = String(
    item.tier || item.destinationTier || item.arenaTier || ''
  )
    .trim()
    .toLowerCase();
  if (TIER_IDS.has(explicit)) return explicit;

  const type = String(item.type || '').toLowerCase();
  const mode = String(item.mode || '').toUpperCase();
  const status = String(item.status || '').toUpperCase();

  if (
    type === 'group_battle' ||
    mode === 'BATTLE_REWIND' ||
    explicit === 'battle'
  ) {
    return 'group_battle';
  }
  if (
    type === 'pro_faceoff' ||
    type === 'faceoff' ||
    /faceoff/i.test(String(item.title || ''))
  ) {
    return 'pro_faceoff';
  }
  if (
    type === 'war_cry' ||
    type === 'war_cry_live' ||
    mode === 'WAR_CRY' ||
    /war\s*cry/i.test(String(item.title || ''))
  ) {
    return 'war_cry_live';
  }
  if (
    type === 'open_challenge' ||
    type === 'challenge_video' ||
    type === 'battle_thread' ||
    item.isOpenChallenge ||
    item._fromArenaChallenges ||
    mode === 'BATTLE_BAWAAL' ||
    status === 'OPEN' ||
    explicit === 'dark_arena'
  ) {
    return 'dark_arena';
  }

  // SPARKS / JOSH / plain reels — All only
  return null;
}

export function filterArenaFeedByTier(items, tierId) {
  const list = Array.isArray(items) ? items : [];
  const key = String(tierId || 'all').toLowerCase();
  if (!key || key === 'all') return list;
  return list.filter((item) => resolveArenaFeedTier(item) === key);
}
