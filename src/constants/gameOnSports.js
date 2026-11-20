/**
 * GAME ON drawer sport filter chips — 8 locked category pills.
 * Arena taxonomy (`BAWAAL_SPORTS`) remains the locked source for forms / hubs.
 *
 * Sub-sport lists under each section are resolution dictionaries only
 * (map legacy / granular tags → category). The drawer UI shows section
 * titles, not the nested pill grids.
 */

/** BAWAAL_SPORTS key → GAME ON dashboard category title. */
export const BAWAAL_SPORT_TO_GAME_ON_CATEGORY = Object.freeze({
  ALL: 'All',
  CRICKET: 'Ball Sports',
  FOOTBALL: 'Ball Sports',
  KABADDI: 'Ball Sports',
  'COURT KINGS': 'Ball Sports',
  COMBAT: 'Combat Sports',
  THROTTLE: 'Racing & Speed',
  'WAVE & BLADE': 'Water & Surf',
  'SKY & SUMMIT': 'Extreme & Adventure',
  GYM: 'Strength & Fitness',
  OTHERS: 'Others',
});

/**
 * GAME ON sections — titles are the 7 non-All category pills.
 * `sports` = granular / legacy labels that belong in the category.
 * `bawaalSports` = locked BAWAAL_SPORTS keys that belong in the category.
 */
export const GAME_ON_SPORT_SECTIONS = [
  {
    id: 'ball',
    title: 'Ball Sports',
    bawaalSports: ['CRICKET', 'FOOTBALL', 'KABADDI', 'COURT KINGS'],
    sports: [
      'Cricket',
      'Football',
      'Basketball',
      'Tennis',
      'Badminton',
      'Volleyball',
      'Hockey',
      'Rugby',
      'Baseball',
      'Kabaddi',
      'Golf',
      'Table Tennis',
      'Pickleball',
      'CRICKET',
      'FOOTBALL',
      'KABADDI',
      'COURT KINGS',
    ],
  },
  {
    id: 'combat',
    title: 'Combat Sports',
    bawaalSports: ['COMBAT'],
    sports: [
      'MMA',
      'Boxing',
      'Wrestling',
      'Kickboxing',
      'Muay Thai',
      'Judo',
      'Karate',
      'Taekwondo',
      'COMBAT',
    ],
  },
  {
    id: 'racing',
    title: 'Racing & Speed',
    bawaalSports: ['THROTTLE'],
    sports: [
      'Formula 1',
      'MotoGP',
      'Supercross / Motocross',
      'NASCAR',
      'Cycling',
      'BMX',
      'Athletics',
      'Skateboarding',
      'THROTTLE',
    ],
  },
  {
    id: 'water',
    title: 'Water & Surf',
    bawaalSports: ['WAVE & BLADE'],
    sports: [
      'Surfing',
      'Sailing',
      'Rowing',
      'Scuba Diving',
      'White Water Rafting',
      'Swimming',
      'WAVE & BLADE',
    ],
  },
  {
    id: 'extreme',
    title: 'Extreme & Adventure',
    bawaalSports: ['SKY & SUMMIT'],
    sports: [
      'Snowboarding',
      'Skiing',
      'Rock Climbing',
      'Parkour',
      'Paragliding',
      'Skydiving',
      'Bungee Jumping',
      'SKY & SUMMIT',
    ],
  },
  {
    id: 'strength',
    title: 'Strength & Fitness',
    bawaalSports: ['GYM'],
    sports: [
      'Weightlifting',
      'Powerlifting',
      'CrossFit',
      'Bodybuilding',
      'GYM',
    ],
  },
  {
    id: 'others',
    title: 'Others',
    bawaalSports: ['OTHERS'],
    sports: ['Archery', 'Battles', 'OTHERS'],
  },
];

/**
 * GAME ON / Arena dashboard filter bar — exact 8 locked labels, order locked:
 * All → Ball Sports → Combat → Racing → Water → Extreme → Strength → Others
 */
export const ARENA_DASHBOARD_CATEGORY_PILLS = Object.freeze([
  'All',
  ...GAME_ON_SPORT_SECTIONS.map((s) => s.title),
]);

/** Alias used by GAME ON drawer sports row. */
export const GAME_ON_CATEGORY_PILLS = ARENA_DASHBOARD_CATEGORY_PILLS;

const SECTION_TITLE_SET = new Set(
  GAME_ON_SPORT_SECTIONS.map((s) => s.title.toLowerCase())
);

/**
 * Resolve which dashboard / GAME ON category a post/battle belongs to.
 * Accepts BAWAAL_SPORTS keys, section titles, or granular sub-sport labels.
 * @param {string|null|undefined} sportLabel
 * @returns {string} section title or 'Others'
 */
export function resolveDashboardCategory(sportLabel) {
  const raw = String(sportLabel || '')
    .trim()
    .toLowerCase();
  if (!raw || raw === 'all') return 'All';

  // Already a GAME ON category title
  if (SECTION_TITLE_SET.has(raw)) {
    const hit = GAME_ON_SPORT_SECTIONS.find(
      (s) => s.title.toLowerCase() === raw
    );
    return hit?.title || 'Others';
  }

  // Locked BAWAAL_SPORTS taxonomy keys (and close casing variants)
  const upper = String(sportLabel || '')
    .trim()
    .toUpperCase();
  if (BAWAAL_SPORT_TO_GAME_ON_CATEGORY[upper]) {
    return BAWAAL_SPORT_TO_GAME_ON_CATEGORY[upper];
  }

  for (const section of GAME_ON_SPORT_SECTIONS) {
    if (
      section.sports.some((s) => {
        const key = String(s).toLowerCase();
        return raw === key || raw.includes(key) || key.includes(raw);
      })
    ) {
      return section.title;
    }
  }
  return 'Others';
}

/**
 * Whether a feed item matches a GAME ON category pill selection.
 * @param {object|null|undefined} item
 * @param {string|null|undefined} categoryLabel
 */
export function matchesGameOnCategory(item, categoryLabel) {
  if (categoryLabel == null || String(categoryLabel).trim() === '') {
    return true;
  }
  const cat = String(categoryLabel).trim();
  if (!cat || cat === 'All' || cat.toUpperCase() === 'ALL') return true;
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
    if (c == null || String(c).trim() === '') continue;
    if (resolveDashboardCategory(c) === cat) return true;
  }
  return false;
}
