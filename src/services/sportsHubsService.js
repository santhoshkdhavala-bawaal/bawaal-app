/**
 * Sport Hub Map ↔ Supabase `public.sports_hubs`.
 * Falls back to local VIRAR_SPORTS_SPOTS when offline / empty / misconfigured.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import {
  filterVirarSportsSpots,
  virarSpotToHub,
} from '../data/sportHubs';
import { canonicalizeSport } from '../utils/sportCategory';

export const SPORTS_HUBS_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql';

function mapHubRow(row) {
  if (!row) return null;
  const lat = Number(row.latitude ?? row.lat);
  const lng = Number(row.longitude ?? row.lng ?? row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const category =
    canonicalizeSport(row.category || row.sport) ||
    String(row.category || row.sport || 'OTHERS').toUpperCase();
  return {
    id: String(row.id),
    name: String(row.name || 'Sport Hub'),
    address: String(row.address || ''),
    sport: category,
    category,
    memberCount: Number(row.member_count) || 0,
    squadCount: Number(row.squad_count) || 0,
    lockerHubId: row.locker_hub_id || null,
    coordinate: { latitude: lat, longitude: lng },
    source: 'sports_hubs',
  };
}

function localFallback(selectedCategory) {
  return {
    hubs: filterVirarSportsSpots(selectedCategory),
    fromCloud: false,
    error: null,
  };
}

/**
 * Fetch map pins for `selectedCategory`.
 * ALL / SPORTS SPOTS → all rows; else filter by category.
 * Empty / error → Virar seed spots.
 *
 * @param {string} [selectedCategory]
 */
export async function fetchSportsHubs(selectedCategory = 'ALL') {
  const key = String(selectedCategory || 'ALL').trim();
  const upper = key.toUpperCase();
  const showAll = !key || upper === 'ALL' || upper === 'SPORTS SPOTS';

  if (!isSupabaseConfigured()) {
    return localFallback(selectedCategory);
  }

  try {
    let query = supabase.from('sports_hubs').select('*').limit(200);
    if (!showAll) {
      const sport = canonicalizeSport(key) || upper;
      query = query.eq('category', sport);
    }

    const { data, error } = await query;
    if (error) throw error;

    const hubs = (data || []).map(mapHubRow).filter(Boolean);
    if (!hubs.length) {
      return localFallback(selectedCategory);
    }
    return { hubs, fromCloud: true, error: null };
  } catch (error) {
    console.warn('[sportsHubsService] fetchSportsHubs:', error?.message || error);
    return {
      hubs: filterVirarSportsSpots(selectedCategory),
      fromCloud: false,
      error,
    };
  }
}

/** Map a raw Virar seed (or similar) through the same hub shape. */
export function spotToMapHub(spot) {
  return virarSpotToHub(spot);
}
