/**
 * GAME ON drawer sport filter chips — organized category sections.
 * Arena taxonomy (`BAWAAL_SPORTS`) remains the locked source for forms / hubs.
 *
 * Arena dashboard horizontal pills = All + each section title (8 locked labels).
 */

export const GAME_ON_SPORT_SECTIONS = [
  {
    id: 'ball',
    title: 'Ball Sports',
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
    ],
  },
  {
    id: 'combat',
    title: 'Combat Sports',
    sports: [
      'MMA',
      'Boxing',
      'Wrestling',
      'Kickboxing',
      'Muay Thai',
      'Judo',
      'Karate',
      'Taekwondo',
    ],
  },
  {
    id: 'racing',
    title: 'Racing & Speed',
    sports: [
      'Formula 1',
      'MotoGP',
      'Supercross / Motocross',
      'NASCAR',
      'Cycling',
      'BMX',
      'Athletics',
      'Swimming',
      'Skateboarding',
    ],
  },
  {
    id: 'water',
    title: 'Water & Surf',
    sports: [
      'Surfing',
      'Sailing',
      'Rowing',
      'Scuba Diving',
      'White Water Rafting',
    ],
  },
  {
    id: 'extreme',
    title: 'Extreme & Adventure',
    sports: [
      'Snowboarding',
      'Skiing',
      'Rock Climbing',
      'Parkour',
      'Paragliding',
      'Skydiving',
      'Bungee Jumping',
    ],
  },
  {
    id: 'strength',
    title: 'Strength & Fitness',
    sports: ['Weightlifting', 'Powerlifting', 'CrossFit', 'Bodybuilding'],
  },
  {
    id: 'others',
    title: 'Others',
    sports: ['Archery', 'Battles'],
  },
];

/** Arena dashboard filter bar — All + 7 GAME ON section titles. */
export const ARENA_DASHBOARD_CATEGORY_PILLS = Object.freeze([
  'All',
  ...GAME_ON_SPORT_SECTIONS.map((s) => s.title),
]);

/**
 * Resolve which dashboard category a post/battle belongs to.
 * @param {string|null|undefined} sportLabel
 * @returns {string} section title or 'Others'
 */
export function resolveDashboardCategory(sportLabel) {
  const raw = String(sportLabel || '')
    .trim()
    .toLowerCase();
  if (!raw || raw === 'all') return 'All';
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
