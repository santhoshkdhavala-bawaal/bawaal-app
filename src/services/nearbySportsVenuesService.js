/**
 * Nearby sports venues around live GPS — OpenStreetMap Overpass + helpers.
 * Soft-fails to [] on network / timeout so the map never hangs.
 */
import { matchesGameOnCategory } from '../constants/gameOnSports';
import { softFailWarn } from '../utils/softFailLog';
import { canonicalizeSport } from '../utils/sportCategory';

export const NEARBY_RADIUS_M = 7000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
/** Hard client timeout so UI never sticks on "Scanning…". */
export const OVERPASS_FETCH_TIMEOUT_MS = 6000;

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const φ1 = toRad(aLat);
  const φ2 = toRad(bLat);
  const Δφ = toRad(bLat - aLat);
  const Δλ = toRad(bLng - aLng);
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/**
 * Map OSM tags → locked BAWAAL_SPORTS key.
 */
export function mapOsmTagsToSport(tags = {}) {
  const sport = String(tags.sport || '').toLowerCase();
  const leisure = String(tags.leisure || '').toLowerCase();
  const amenity = String(tags.amenity || '').toLowerCase();
  const name = String(tags.name || '').toLowerCase();
  const blob = `${sport} ${leisure} ${amenity} ${name}`;

  if (
    /mma|boxing|martial|kickbox|muay|wrestling|judo|karate|taekwondo|combat|bjj/.test(
      blob
    )
  ) {
    return 'COMBAT';
  }
  if (/fitness|gym|crossfit|weight|bodybuild|powerlift/.test(blob)) {
    return 'GYM';
  }
  if (/cricket/.test(blob)) return 'CRICKET';
  if (/soccer|football/.test(blob) && !/american/.test(blob)) return 'FOOTBALL';
  if (/kabaddi/.test(blob)) return 'KABADDI';
  if (
    /basketball|tennis|badminton|volleyball|squash|pickleball|table_tennis|court/.test(
      blob
    )
  ) {
    return 'COURT KINGS';
  }
  if (/swim|surf|sail|rowing|water|diving|beach/.test(blob)) {
    return 'WAVE & BLADE';
  }
  if (/skate|bmx|motocross|racing|cycle|velodrome/.test(blob)) {
    return 'THROTTLE';
  }
  if (/climb|ski|snowboard|parkour|paraglide|hiking|summit/.test(blob)) {
    return 'SKY & SUMMIT';
  }
  if (leisure === 'stadium' || leisure === 'pitch' || leisure === 'track') {
    return 'OTHERS';
  }
  if (leisure === 'sports_centre' || amenity === 'community_centre') {
    return 'OTHERS';
  }
  return canonicalizeSport(sport) || 'OTHERS';
}

function buildOverpassQuery(lat, lng, radiusM) {
  const r = Math.round(radiusM);
  const around = `around:${r},${lat},${lng}`;
  // Keep Overpass server timeout under the client AbortController budget.
  return `
[out:json][timeout:5];
(
  node["leisure"="fitness_centre"](${around});
  node["leisure"="sports_centre"](${around});
  node["leisure"="stadium"](${around});
  node["leisure"="pitch"](${around});
  node["leisure"="swimming_pool"](${around});
  node["leisure"="track"](${around});
  node["amenity"="gym"](${around});
  node["sport"~"boxing|martial_arts|mma|fitness|gym|cricket|soccer|football|basketball|kabaddi|swimming|tennis|badminton|climbing|skateboard"](${around});
  way["leisure"="fitness_centre"](${around});
  way["leisure"="sports_centre"](${around});
  way["leisure"="stadium"](${around});
  way["leisure"="pitch"](${around});
  way["leisure"="swimming_pool"](${around});
  way["amenity"="gym"](${around});
  way["sport"~"boxing|martial_arts|mma|fitness|gym|cricket|soccer|football|basketball|kabaddi|swimming|tennis|badminton|climbing|skateboard"](${around});
  relation["leisure"="sports_centre"](${around});
  relation["leisure"="stadium"](${around});
);
out center tags 60;
`.trim();
}

function elementToVenue(el, origin) {
  if (!el) return null;
  const tags = el.tags || {};
  const lat = Number(el.lat ?? el.center?.lat);
  const lng = Number(el.lon ?? el.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = String(tags.name || tags['name:en'] || '').trim();
  if (!name) return null;

  const sport = mapOsmTagsToSport(tags);
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
  ].filter(Boolean);
  const address =
    addressParts.join(', ') ||
    String(tags['addr:full'] || tags.description || 'Nearby sports venue');

  const distanceM = origin
    ? haversineMeters(origin.latitude, origin.longitude, lat, lng)
    : null;

  return {
    id: `osm-${el.type || 'n'}-${el.id}`,
    name,
    address,
    sport,
    category: sport,
    memberCount: 0,
    squadCount: 0,
    lockerHubId: null,
    coordinate: { latitude: lat, longitude: lng },
    distanceM,
    source: 'overpass',
  };
}

function parseOverpassVenues(json, origin) {
  const elements = Array.isArray(json?.elements) ? json.elements : [];
  const venues = elements
    .map((el) => elementToVenue(el, origin))
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const v of venues) {
    const key = `${v.name.toLowerCase()}|${v.coordinate.latitude.toFixed(4)}|${v.coordinate.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  unique.sort((a, b) => (a.distanceM || 0) - (b.distanceM || 0));
  return unique.slice(0, 80);
}

/**
 * POST one Overpass mirror with AbortController timeout.
 */
async function fetchOverpassEndpoint(endpoint, body, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const onAbort = () => {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  };
  if (externalSignal) {
    if (externalSignal.aborted) onAbort();
    else externalSignal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(onAbort, timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(body)}`,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Overpass HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Query Overpass for sports venues near lat/lng.
 * Races both mirrors under a 6s AbortController — never hangs the UI.
 * @returns {Promise<object[]>}
 */
export async function fetchOverpassSportsVenues(
  latitude,
  longitude,
  radiusM = NEARBY_RADIUS_M,
  options = {}
) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const timeoutMs = Number(options.timeoutMs) || OVERPASS_FETCH_TIMEOUT_MS;
  const body = buildOverpassQuery(lat, lng, radiusM);
  const origin = { latitude: lat, longitude: lng };
  const parentController = new AbortController();
  const killTimer = setTimeout(() => parentController.abort(), timeoutMs);

  try {
    const attempts = OVERPASS_ENDPOINTS.map((endpoint) =>
      fetchOverpassEndpoint(
        endpoint,
        body,
        timeoutMs,
        parentController.signal
      ).then((json) => {
        const venues = parseOverpassVenues(json, origin);
        if (!venues.length) {
          throw new Error('Overpass empty');
        }
        return venues;
      })
    );

    // First mirror with usable results wins (Promise.any + sequential fallback).
    let venues = null;
    if (typeof Promise.any === 'function') {
      venues = await Promise.any(attempts);
    } else {
      for (const attempt of attempts) {
        try {
          venues = await attempt;
          break;
        } catch {
          /* try next */
        }
      }
    }
    parentController.abort();
    return Array.isArray(venues) ? venues : [];
  } catch (err) {
    softFailWarn(
      'overpass.nearby',
      err?.message || err || 'Overpass fetch failed'
    );
    return [];
  } finally {
    clearTimeout(killTimer);
  }
}

/**
 * Merge Supabase hubs + Overpass venues, annotate distance, filter by category.
 */
export function mergeNearbyVenues({
  cloudHubs = [],
  overpassVenues = [],
  origin,
  selectedCategory = 'ALL',
  radiusM = NEARBY_RADIUS_M,
} = {}) {
  const originLat = Number(origin?.latitude);
  const originLng = Number(origin?.longitude);
  const hasOrigin = Number.isFinite(originLat) && Number.isFinite(originLng);
  const catRaw = String(selectedCategory || 'All').trim();
  const showAll =
    !catRaw ||
    catRaw === 'All' ||
    catRaw.toUpperCase() === 'ALL' ||
    catRaw.toUpperCase() === 'SPORTS SPOTS';

  const annotate = (hub) => {
    if (!hub?.coordinate) return null;
    const lat = Number(hub.coordinate.latitude);
    const lng = Number(hub.coordinate.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const distanceM = hasOrigin
      ? haversineMeters(originLat, originLng, lat, lng)
      : hub.distanceM ?? null;
    if (
      hasOrigin &&
      Number.isFinite(distanceM) &&
      Number.isFinite(radiusM) &&
      distanceM > radiusM * 1.15
    ) {
      return null;
    }
    const sport =
      canonicalizeSport(hub.sport || hub.category) ||
      String(hub.sport || hub.category || 'OTHERS').toUpperCase();
    const next = {
      ...hub,
      sport,
      category: sport,
      distanceM,
    };
    if (!showAll && !matchesGameOnCategory(next, catRaw)) return null;
    return next;
  };

  const merged = [];
  const seen = new Set();
  for (const row of [...cloudHubs, ...overpassVenues]) {
    const next = annotate(row);
    if (!next) continue;
    const key = String(next.id || `${next.name}-${next.coordinate.latitude}`);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(next);
  }
  merged.sort((a, b) => (a.distanceM || 0) - (b.distanceM || 0));
  return merged;
}
