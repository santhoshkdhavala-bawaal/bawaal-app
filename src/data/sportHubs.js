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

/** Pin accent by sport taxonomy key. */
export const HUB_SPORT_COLORS = {
  CRICKET: '#FACC15',
  FOOTBALL: '#39FF14',
  GYM: '#FF5500',
  KABADDI: '#EF4444',
  COMBAT: '#FF3366',
  THROTTLE: '#A855F7',
  'WAVE & BLADE': '#00E5FF',
  'COURT KINGS': '#3B82F6',
  'SKY & SUMMIT': '#4ADE80',
  OTHERS: '#E8ECE9',
  ALL: '#FFFFFF',
};

export function hubPinColor(sport) {
  const key = canonicalizeSport(sport) || 'OTHERS';
  return HUB_SPORT_COLORS[key] || HUB_SPORT_COLORS.OTHERS;
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
