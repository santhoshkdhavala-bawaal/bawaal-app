/**
 * Demo athlete graph for Passport hub / inline preview / full profile.
 * Swap for Supabase follows + profiles when auth ships.
 */

const DEMO_PHOTOS = (seed, captions) =>
  captions.map((caption, i) => ({
    id: `${seed}-p${i + 1}`,
    uri: `https://picsum.photos/seed/${seed}${i + 1}/400/400`,
    caption,
  }));

export const CURRENT_USER = {
  id: 'me',
  displayName: 'Rohit Kumar',
  username: 'Rohit_VK7',
  handle: '@rohit_vk7',
  bio: 'Combat Sports Athlete & Striker · Virar Boxing Club',
  city: 'Virar West, Mumbai',
  location: 'Virar West, Mumbai',
  primarySport: 'COMBAT',
  tags: ['COMBAT', 'STRIKER', 'BOXING'],
  avatarUri: null,
  verified: true,
  role: 'athlete',
  statusBadge: 'SCOUT VERIFIED',
  stats: {
    bawaalPts: 3850,
    rank: 1,
    battlesWon: 18,
    battlesFought: 23,
    followers: 1240,
    following: 86,
    winRate: 78,
  },
  metrics: [
    { id: 'velocity', label: 'Strike Velocity', value: 94, accent: 'red' },
    { id: 'stamina', label: 'Stamina & Form', value: 88, accent: 'green' },
  ],
  clips: [
    { id: 'c1', title: 'Shadow combo · 0.5×', sport: 'COMBAT' },
    { id: 'c2', title: 'Pad work PR', sport: 'COMBAT' },
    { id: 'c3', title: 'Footwork drill', sport: 'COMBAT' },
  ],
  photos: DEMO_PHOTOS('rohit', [
    'Sparring still',
    'Pad work',
    'Ring walk',
    'Gym mural',
    'Gloves detail',
    'Team huddle',
  ]),
};

export const FOLLOWING = [
  {
    id: 'f1',
    displayName: 'Mia Torque',
    handle: '@Mia_Torque',
    sport: 'GYM',
    online: true,
    verified: true,
    role: 'pro',
    bio: 'Floor PR hunter · chalk & chaos',
    statusBadge: 'PRO',
    stats: { bawaalPts: 4120, rank: 2, battlesWon: 22, followers: 890, following: 40, winRate: 81 },
    metrics: [
      { id: 'power', label: 'Power Output', value: 91, accent: 'red' },
      { id: 'form', label: 'Form Score', value: 86, accent: 'blue' },
    ],
    clips: [
      { id: 'mc1', title: 'Deadlift lockout', sport: 'GYM' },
      { id: 'mc2', title: 'Push press sets', sport: 'GYM' },
    ],
    photos: DEMO_PHOTOS('mia', ['PR chalk', 'Bar setup', 'Lift still', 'Gym night']),
  },
  {
    id: 'f2',
    displayName: 'Aman Strike',
    handle: '@Aman_Combat',
    sport: 'COMBAT',
    online: false,
    verified: false,
    role: 'athlete',
    bio: 'Southpaw striker · Mumbai circuit',
    statusBadge: 'RISING',
    stats: { bawaalPts: 2980, rank: 5, battlesWon: 14, followers: 560, following: 120, winRate: 72 },
    metrics: [
      { id: 'speed', label: 'Hand Speed', value: 89, accent: 'blue' },
      { id: 'defence', label: 'Defence IQ', value: 84, accent: 'green' },
    ],
    clips: [
      { id: 'ac1', title: 'Jab-cross ladder', sport: 'COMBAT' },
      { id: 'ac2', title: 'Clinch escape', sport: 'COMBAT' },
    ],
    photos: DEMO_PHOTOS('aman', ['Pads', 'Shadow']),
  },
  {
    id: 'f3',
    displayName: 'Rohit Bat',
    handle: '@Rohit_Cricket',
    sport: 'CRICKET',
    online: true,
    verified: true,
    role: 'athlete',
    bio: 'Opening bat · net sessions daily',
    statusBadge: 'VERIFIED',
    stats: { bawaalPts: 3510, rank: 3, battlesWon: 11, followers: 2100, following: 55, winRate: 69 },
    metrics: [
      { id: 'timing', label: 'Timing', value: 92, accent: 'green' },
      { id: 'power', label: 'Bat Speed', value: 87, accent: 'red' },
    ],
    clips: [
      { id: 'rc1', title: 'Cover drive nets', sport: 'CRICKET' },
      { id: 'rc2', title: 'Pull shot drill', sport: 'CRICKET' },
    ],
    photos: DEMO_PHOTOS('bat', ['Nets', 'Drive still', 'Kit bag']),
  },
];

export const SUGGESTED = [
  {
    id: 's1',
    displayName: 'Karan FreeKick',
    handle: '@Karan_FreeKick',
    sport: 'FOOTBALL',
    online: false,
    verified: false,
    role: 'athlete',
    bio: 'Set-piece specialist · left foot',
    statusBadge: 'SUGGESTED',
    stats: { bawaalPts: 2740, rank: 8, battlesWon: 9, followers: 430, following: 200, winRate: 64 },
    metrics: [
      { id: 'curve', label: 'Curve Accuracy', value: 90, accent: 'blue' },
      { id: 'stamina', label: 'Match Stamina', value: 82, accent: 'green' },
    ],
    clips: [
      { id: 'kc1', title: 'Free-kick wall', sport: 'FOOTBALL' },
      { id: 'kc2', title: 'Crossing drills', sport: 'FOOTBALL' },
    ],
    photos: DEMO_PHOTOS('karan', ['Wall kick', 'Crossing']),
  },
  {
    id: 's2',
    displayName: 'RaceQueen IN',
    handle: '@RaceQueen_IN',
    sport: 'THROTTLE',
    online: true,
    verified: true,
    role: 'pro',
    bio: 'Night pulls · 0–100 focus',
    statusBadge: 'HOT',
    stats: { bawaalPts: 3890, rank: 4, battlesWon: 16, followers: 3200, following: 90, winRate: 77 },
    metrics: [
      { id: 'reaction', label: 'Reaction', value: 95, accent: 'red' },
      { id: 'control', label: 'Vehicle Control', value: 88, accent: 'blue' },
    ],
    clips: [
      { id: 'rq1', title: 'Launch practice', sport: 'THROTTLE' },
      { id: 'rq2', title: 'Corner exit', sport: 'THROTTLE' },
    ],
    photos: DEMO_PHOTOS('race', ['Launch', 'Corner', 'Pit lane', 'Night']),
  },
  {
    id: 's3',
    displayName: 'Yuki Power',
    handle: '@Yuki_Lift',
    sport: 'GYM',
    online: false,
    verified: true,
    role: 'scout',
    bio: 'Olympic lifts · Tokyo prep · recruiting Asia circuit',
    statusBadge: 'ELITE',
    stats: { bawaalPts: 4450, rank: 1, battlesWon: 27, followers: 5100, following: 33, winRate: 85 },
    metrics: [
      { id: 'snatch', label: 'Snatch Form', value: 93, accent: 'green' },
      { id: 'clean', label: 'Clean & Jerk', value: 91, accent: 'red' },
    ],
    clips: [
      { id: 'yk1', title: 'Snatch singles', sport: 'GYM' },
      { id: 'yk2', title: 'Jerk recovery', sport: 'GYM' },
    ],
    photos: DEMO_PHOTOS('yuki', ['Snatch', 'Platform', 'Warm-up', 'Meet day', 'Bar', 'Crowd']),
  },
];

/** Extra verified handles that appear in Arena / banter demos */
const EXTRA_VERIFIED = new Set(
  [
    '@Mia_Torque',
    '@Neha_Lift',
    '@RaceQueen_IN',
    '@Rohit_Cricket',
    '@rohit_vk7',
    '@Yuki_Lift',
    '@VirarStriker',
  ].map((h) => h.toLowerCase())
);

function normalizeHandle(handle) {
  const s = String(handle || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  return s.startsWith('@') ? s : `@${s}`;
}

export function findAthleteById(id) {
  if (!id || id === 'me') return CURRENT_USER;
  return (
    FOLLOWING.find((a) => a.id === id) ||
    SUGGESTED.find((a) => a.id === id) ||
    null
  );
}

export function findAthleteByHandle(handle) {
  const key = normalizeHandle(handle);
  if (!key) return null;
  if (normalizeHandle(CURRENT_USER.handle) === key) return CURRENT_USER;
  return (
    FOLLOWING.find((a) => normalizeHandle(a.handle) === key) ||
    SUGGESTED.find((a) => normalizeHandle(a.handle) === key) ||
    null
  );
}

export function isHandleVerified(handle) {
  const key = normalizeHandle(handle);
  if (!key) return false;
  if (EXTRA_VERIFIED.has(key)) return true;
  const athlete = findAthleteByHandle(key);
  return Boolean(athlete?.verified);
}

/** Accent tokens — stats/metrics only (UI chrome stays B&W). Verified "B" badge uses VERIFIED_BLUE. */
export const STAT_ACCENTS = {
  red: '#FF3B30',
  green: '#39FF14',
  blue: '#00E5FF',
};
