/**
 * Sport Hub Map ↔ Supabase `public.sports_hubs`.
 * Default soft-fail is empty hubs (live GPS map merges Overpass).
 * Optional `allowLocalFallback` still exposes Virar seeds for legacy callers.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import {
  filterVirarSportsSpots,
  virarSpotToHub,
} from '../data/sportHubs';
import { canonicalizeSport } from '../utils/sportCategory';
import { haversineMeters } from './nearbySportsVenuesService';

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

function emptyResult(error = null) {
  return { hubs: [], fromCloud: false, error };
}

function filterHubsNear(hubs, near, radiusM) {
  const lat = Number(near?.latitude);
  const lng = Number(near?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return hubs;
  const r = Number(radiusM) || 8000;
  return hubs.filter((hub) => {
    const d = haversineMeters(
      lat,
      lng,
      hub.coordinate.latitude,
      hub.coordinate.longitude
    );
    return Number.isFinite(d) && d <= r * 1.15;
  });
}

/**
 * Fetch map pins for `selectedCategory`.
 * ALL / SPORTS SPOTS → all rows; else filter by category.
 *
 * @param {string} [selectedCategory]
 * @param {{ allowLocalFallback?: boolean, near?: {latitude:number,longitude:number}, radiusM?: number }} [options]
 */
export async function fetchSportsHubs(selectedCategory = 'ALL', options = {}) {
  const key = String(selectedCategory || 'ALL').trim();
  const upper = key.toUpperCase();
  const showAll = !key || upper === 'ALL' || upper === 'SPORTS SPOTS';
  const allowLocalFallback = options?.allowLocalFallback === true;
  const near = options?.near || null;
  const radiusM = options?.radiusM ?? 8000;

  if (!isSupabaseConfigured()) {
    return allowLocalFallback ? localFallback(selectedCategory) : emptyResult();
  }

  try {
    let query = supabase.from('sports_hubs').select('*').limit(200);
    if (!showAll) {
      const sport = canonicalizeSport(key) || upper;
      query = query.eq('category', sport);
    }

    const { data, error } = await query;
    if (error) throw error;

    let hubs = (data || []).map(mapHubRow).filter(Boolean);
    if (near) hubs = filterHubsNear(hubs, near, radiusM);
    if (!hubs.length) {
      return allowLocalFallback
        ? localFallback(selectedCategory)
        : { hubs: [], fromCloud: true, error: null };
    }
    return { hubs, fromCloud: true, error: null };
  } catch (error) {
    console.warn('[sportsHubsService] fetchSportsHubs:', error?.message || error);
    if (allowLocalFallback) {
      return {
        hubs: filterVirarSportsSpots(selectedCategory),
        fromCloud: false,
        error,
      };
    }
    return emptyResult(error);
  }
}

/** Map a raw Virar seed (or similar) through the same hub shape. */
export function spotToMapHub(spot) {
  return virarSpotToHub(spot);
}
