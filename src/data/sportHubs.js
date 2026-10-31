/**
 * Community Sport Hub Map — seed hubs (Mumbai metro).
 * Swap for Supabase geo hubs when cloud sync ships.
 */
import { canonicalizeSport } from '../utils/sportCategory';

/** Fallback camera — Virar / Mumbai metro (renders without live GPS). */
export const SPORT_HUB_MAP_REGION = {
  latitude: 19.4559,
  longitude: 72.8094,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * Pin / filter-pill accents — match map legend & Game On category chips.
 * Cricket yellow · Football volt green · Gym/Combat flame orange-red.
 */
export const HUB_SPORT_COLORS = {
  CRICKET: '#FFD700',
  FOOTBALL: '#00FF66',
  GYM: '#FF5500',
  KABADDI: '#FF3B30',
  COMBAT: '#FF3B30',
  THROTTLE: '#A855F7',
  'WAVE & BLADE': '#00E5FF',
  'COURT KINGS': '#3B82F6',
  'SKY & SUMMIT': '#39FF14',
  OTHERS: '#E8ECE9',
  ALL: '#FFFFFF',
};

/** Gyms / MMA / cricket turfs / kabaddi courts — high-visibility glow pins. */
export const HIGHLIGHT_SPORT_SPOTS = Object.freeze([
  'GYM',
  'COMBAT',
  'CRICKET',
  'KABADDI',
]);

/** @deprecated Prefer hubPinColor — kept for callers expecting a neon default. */
export const SPORTS_SPOT_NEON = '#FF3B30';
export const SPORTS_SPOT_NEON_ALT = '#FF5500';

export function hubPinColor(sport) {
  const key = canonicalizeSport(sport) || 'OTHERS';
  return HUB_SPORT_COLORS[key] || HUB_SPORT_COLORS.OTHERS;
}

/** True for gyms, MMA/combat clubs, cricket turfs, kabaddi courts. */
export function isSportsSpotHighlight(sport) {
  const key = canonicalizeSport(sport) || '';
  return HIGHLIGHT_SPORT_SPOTS.includes(key);
}

/** Category-matched accent for sports-spot glow pins (same as filter pills). */
export function sportsSpotNeon(sport) {
  return hubPinColor(sport);
}

export const SPORT_HUBS = [
  {
    id: 'hub-iron-virar',
    name: 'Iron Circle Arena',
    address: 'Virar West Gym Belt, Palghar, Mumbai',
    sport: 'COMBAT',
    memberCount: 48,
    squadCount: 6,
    lockerHubId: 'squad-iron',
    coordinate: { latitude: 19.4554, longitude: 72.8111 },
  },
  {
    id: 'hub-south-turf',
    name: 'South Turf Unit',
    address: 'Bandra West Open Turf, Mumbai',
    sport: 'GYM',
    memberCount: 112,
    squadCount: 12,
    lockerHubId: 'gym-south',
    coordinate: { latitude: 19.0596, longitude: 72.8295 },
  },
  {
    id: 'hub-night-shift',
    name: 'Night Shift Athletics',
    address: 'Andheri East Track Oval, Mumbai',
    sport: 'THROTTLE',
    memberCount: 36,
    squadCount: 8,
    lockerHubId: 'squad-night',
    coordinate: { latitude: 19.1136, longitude: 72.8697 },
  },
  {
    id: 'hub-lift-wars',
    name: 'Lift Wars Inner',
    address: 'Powai Strength Lab, Mumbai',
    sport: 'GYM',
    memberCount: 28,
    squadCount: 4,
    lockerHubId: 'squad-lift',
    coordinate: { latitude: 19.1176, longitude: 72.906 },
  },
  {
    id: 'hub-cricket-nets',
    name: 'Marine Drive Nets',
    address: 'Chowpatty Net Complex, South Mumbai',
    sport: 'CRICKET',
    memberCount: 64,
    squadCount: 9,
    lockerHubId: null,
    coordinate: { latitude: 18.954, longitude: 72.813 },
  },
  {
    id: 'hub-kabaddi-court',
    name: 'Raigad Kabaddi Court',
    address: 'Dadar East Indoor Hall, Mumbai',
    sport: 'KABADDI',
    memberCount: 42,
    squadCount: 5,
    lockerHubId: null,
    coordinate: { latitude: 19.0178, longitude: 72.8478 },
  },
  {
    id: 'hub-court-kings',
    name: 'Court Kings Hoops',
    address: 'Lower Parel Courts, Mumbai',
    sport: 'COURT KINGS',
    memberCount: 55,
    squadCount: 7,
    lockerHubId: null,
    coordinate: { latitude: 18.9935, longitude: 72.827 },
  },
  {
    id: 'hub-wave-blade',
    name: 'Wave & Blade Coast',
    address: 'Juhu Beach Boardwalk, Mumbai',
    sport: 'WAVE & BLADE',
    memberCount: 31,
    squadCount: 3,
    lockerHubId: null,
    coordinate: { latitude: 19.0988, longitude: 72.8265 },
  },
];

export function findSportHubById(id) {
  if (!id) return null;
  return SPORT_HUBS.find((h) => h.id === id) || null;
}

export function filterSportsSpotHubs(hubs = SPORT_HUBS) {
  return (hubs || []).filter((h) => isSportsSpotHighlight(h?.sport));
}

/**
 * Real-world mock sports facilities around Virar / Nalasopara (Palghar).
 * Schema: { id, name, category, latitude, longitude, address }
 */
export const VIRAR_SPORTS_SPOTS = [
  // —— Gyms ——
  {
    id: 'virar-golds-gym',
    name: "Gold's Gym Virar",
    category: 'GYM',
    latitude: 19.4568,
    longitude: 72.8082,
    address: 'Near Virar West Station, Palghar',
  },
  {
    id: 'virar-talwalkars',
    name: 'Talwalkars Fitness Virar',
    category: 'GYM',
    latitude: 19.4582,
    longitude: 72.8125,
    address: 'Evershine City Road, Virar West',
  },
  {
    id: 'virar-fitzone',
    name: 'FitZone Local Hub',
    category: 'GYM',
    latitude: 19.4521,
    longitude: 72.8058,
    address: 'Agashi Road, Virar West',
  },
  {
    id: 'nalasopara-powerhouse',
    name: 'PowerHouse Gym Nalasopara',
    category: 'GYM',
    latitude: 19.4195,
    longitude: 72.8142,
    address: 'Nalasopara West Market Road',
  },
  // —— Football ——
  {
    id: 'virar-global-city-turf',
    name: 'Global City Turf',
    category: 'FOOTBALL',
    latitude: 19.4612,
    longitude: 72.8015,
    address: 'Global City Complex, Virar West',
  },
  {
    id: 'virar-viva-ground',
    name: 'Viva Ground',
    category: 'FOOTBALL',
    latitude: 19.4486,
    longitude: 72.8168,
    address: 'Viva College Rd, Virar West',
  },
  {
    id: 'nalasopara-astro-turf',
    name: 'Nalasopara Astro Turf',
    category: 'FOOTBALL',
    latitude: 19.4238,
    longitude: 72.8211,
    address: 'Achole Road, Nalasopara East',
  },
  // —— Cricket ——
  {
    id: 'virar-cricket-ground',
    name: 'Virar Cricket Ground',
    category: 'CRICKET',
    latitude: 19.4545,
    longitude: 72.8189,
    address: 'Bolinj Cricket Ground, Virar West',
  },
  {
    id: 'virar-nets-arena',
    name: 'Virar Nets Arena',
    category: 'CRICKET',
    latitude: 19.4498,
    longitude: 72.8095,
    address: 'Chandansar Rd, Virar East',
  },
  {
    id: 'nalasopara-turf-cricket',
    name: 'Nalasopara Cricket Turf',
    category: 'CRICKET',
    latitude: 19.4272,
    longitude: 72.8088,
    address: 'Tulinj Road, Nalasopara East',
  },
  // —— Combat / MMA / Boxing ——
  {
    id: 'virar-mma-lab',
    name: 'Virar MMA Lab',
    category: 'COMBAT',
    latitude: 19.4575,
    longitude: 72.8044,
    address: 'Phoolpada Road, Virar West',
  },
  {
    id: 'virar-iron-fist',
    name: 'Iron Fist Boxing Ring',
    category: 'COMBAT',
    latitude: 19.4512,
    longitude: 72.8136,
    address: 'Manvelpada, Virar East',
  },
  {
    id: 'nalasopara-strike-academy',
    name: 'Strike Academy MMA',
    category: 'COMBAT',
    latitude: 19.4218,
    longitude: 72.8175,
    address: 'Nalasopara West Main Road',
  },
  // —— Kabaddi / Others ——
  {
    id: 'virar-kabaddi-akhada',
    name: 'Virar Kabaddi Akhada',
    category: 'KABADDI',
    latitude: 19.4604,
    longitude: 72.8152,
    address: 'Bolinj Village Ground, Virar',
  },
  {
    id: 'virar-open-courts',
    name: 'Virar Open Courts',
    category: 'COURT KINGS',
    latitude: 19.4469,
    longitude: 72.8071,
    address: 'Yashwant Viva Township Courts',
  },
];

/** Normalize VIRAR_SPORTS_SPOTS → hub-shaped markers for the map UI. */
export function virarSpotToHub(spot) {
  if (!spot) return null;
  const category = canonicalizeSport(spot.category) || String(spot.category || 'OTHERS').toUpperCase();
  return {
    id: spot.id,
    name: spot.name,
    address: spot.address,
    sport: category,
    category,
    memberCount: spot.memberCount ?? 0,
    squadCount: spot.squadCount ?? 0,
    lockerHubId: null,
    coordinate: {
      latitude: Number(spot.latitude),
      longitude: Number(spot.longitude),
    },
    source: 'virar-spot',
  };
}

/**
 * Filter Virar sports spots by category pill selection.
 * ALL / SPORTS SPOTS → all spots; else case-insensitive category match.
 */
export function filterVirarSportsSpots(selectedCategory = 'ALL', spots = VIRAR_SPORTS_SPOTS) {
  const key = String(selectedCategory || 'ALL').trim();
  const upper = key.toUpperCase();
  if (!key || upper === 'ALL' || upper === 'SPORTS SPOTS') {
    return (spots || []).map(virarSpotToHub).filter(Boolean);
  }
  return (spots || [])
    .filter(
      (s) =>
        String(s.category || '').toLowerCase() === key.toLowerCase() ||
        canonicalizeSport(s.category) === canonicalizeSport(key)
    )
    .map(virarSpotToHub)
    .filter(Boolean);
}
