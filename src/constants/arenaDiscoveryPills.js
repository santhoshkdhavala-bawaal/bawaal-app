/**
 * Arena dashboard discovery pills only — not form taxonomy / GAME ON drawer.
 */

export const ARENA_DISCOVERY_PILLS = Object.freeze([
  'For You',
  'Football',
  'Basketball',
  'BMX',
  'MMA',
]);

export const ARENA_DISCOVERY_DEFAULT = 'For You';

/**
 * Whether a feed item matches the selected discovery pill.
 * "For You" → all items; otherwise case-insensitive sport/category includes.
 */
export function matchesArenaDiscoveryPill(item, pill) {
  const selected = String(pill || ARENA_DISCOVERY_DEFAULT).trim();
  if (!selected || selected === 'For You') return true;
  const needle = selected.toLowerCase();
  const hay = [
    item?.sport,
    item?.category,
    item?.primary_sport,
    item?.title,
    item?.caption,
    item?.target,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return hay.includes(needle);
}
