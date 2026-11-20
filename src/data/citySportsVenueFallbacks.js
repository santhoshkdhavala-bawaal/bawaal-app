/**
 * Instant curated sports venues for Sport Hub Map city presets.
 * Shown immediately while Overpass / Supabase load — never leave the map empty.
 */

export const CITY_COORDS = Object.freeze({
  hyd: { id: 'hyd', label: 'Hyderabad', latitude: 17.385, longitude: 78.4867 },
  del: { id: 'del', label: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  mum: { id: 'mum', label: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  blr: { id: 'blr', label: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  che: { id: 'che', label: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
});

function venue(cityId, index, name, sport, address, latitude, longitude) {
  return {
    id: `curated-${cityId}-${index}`,
    name,
    address,
    sport,
    category: sport,
    memberCount: 0,
    squadCount: 0,
    lockerHubId: null,
    coordinate: { latitude, longitude },
    source: 'curated',
  };
}

/** @type {Record<string, object[]>} */
export const CITY_VENUE_FALLBACKS = Object.freeze({
  hyd: [
    venue(
      'hyd',
      1,
      'Gachibowli Indoor Stadium',
      'OTHERS',
      'Gachibowli, Hyderabad',
      17.4401,
      78.3489
    ),
    venue(
      'hyd',
      2,
      'Cult Fit Jubilee Hills',
      'GYM',
      'Road No. 36, Jubilee Hills, Hyderabad',
      17.4326,
      78.4071
    ),
    venue(
      'hyd',
      3,
      'Hyderabad MMA Academy',
      'COMBAT',
      'Madhapur, Hyderabad',
      17.4484,
      78.3908
    ),
    venue(
      'hyd',
      4,
      'Rajiv Gandhi International Cricket Stadium',
      'CRICKET',
      'Uppal, Hyderabad',
      17.4062,
      78.5505
    ),
    venue(
      'hyd',
      5,
      'LB Stadium Football Ground',
      'FOOTBALL',
      'Public Gardens, Hyderabad',
      17.3985,
      78.4675
    ),
    venue(
      'hyd',
      6,
      'Gold\'s Gym Banjara Hills',
      'GYM',
      'Road No. 12, Banjara Hills, Hyderabad',
      17.4126,
      78.4482
    ),
    venue(
      'hyd',
      7,
      'Boxing Ring Secunderabad',
      'COMBAT',
      'Secunderabad, Hyderabad',
      17.4399,
      78.4983
    ),
    venue(
      'hyd',
      8,
      'GHMC Swimming Pool',
      'WAVE & BLADE',
      'Necklace Road, Hyderabad',
      17.4239,
      78.4738
    ),
  ],
  del: [
    venue(
      'del',
      1,
      'Jawaharlal Nehru Stadium',
      'OTHERS',
      'Lodhi Road, New Delhi',
      28.5828,
      77.2345
    ),
    venue(
      'del',
      2,
      'Arun Jaitley Stadium',
      'CRICKET',
      'Bahadur Shah Zafar Marg, Delhi',
      28.6378,
      77.243
    ),
    venue(
      'del',
      3,
      'Cult Fit Connaught Place',
      'GYM',
      'Connaught Place, New Delhi',
      28.6315,
      77.2167
    ),
    venue(
      'del',
      4,
      'Delhi Boxing Club',
      'COMBAT',
      'Kashmere Gate, Delhi',
      28.6676,
      77.2273
    ),
    venue(
      'del',
      5,
      'Ambedkar Stadium',
      'FOOTBALL',
      'Delhi Gate, New Delhi',
      28.6412,
      77.241
    ),
    venue(
      'del',
      6,
      'MMA Factory Saket',
      'COMBAT',
      'Saket, New Delhi',
      28.5244,
      77.2066
    ),
    venue(
      'del',
      7,
      'Siri Fort Sports Complex',
      'COURT KINGS',
      'August Kranti Marg, Delhi',
      28.5522,
      77.213
    ),
    venue(
      'del',
      8,
      'Talkatora Swimming Pool',
      'WAVE & BLADE',
      'President\'s Estate, New Delhi',
      28.621,
      77.1955
    ),
  ],
  mum: [
    venue(
      'mum',
      1,
      'Wankhede Stadium',
      'CRICKET',
      'Churchgate, Mumbai',
      18.9389,
      72.8258
    ),
    venue(
      'mum',
      2,
      'Cooperage Football Ground',
      'FOOTBALL',
      'Nariman Point, Mumbai',
      18.922,
      72.8305
    ),
    venue(
      'mum',
      3,
      'Cult Fit Bandra',
      'GYM',
      'Linking Road, Bandra West, Mumbai',
      19.0596,
      72.8295
    ),
    venue(
      'mum',
      4,
      'Mumbai Fight Club MMA',
      'COMBAT',
      'Andheri West, Mumbai',
      19.1364,
      72.8277
    ),
    venue(
      'mum',
      5,
      'Shivaji Park Ground',
      'CRICKET',
      'Dadar West, Mumbai',
      19.027,
      72.838
    ),
    venue(
      'mum',
      6,
      'Gold\'s Gym Lower Parel',
      'GYM',
      'Lower Parel, Mumbai',
      18.9935,
      72.826
    ),
    venue(
      'mum',
      7,
      'Boxing Kingdom Powai',
      'COMBAT',
      'Powai, Mumbai',
      19.1176,
      72.906
    ),
    venue(
      'mum',
      8,
      'Mahalaxmi Racecourse Track',
      'THROTTLE',
      'Mahalaxmi, Mumbai',
      18.9827,
      72.8193
    ),
  ],
  blr: [
    venue(
      'blr',
      1,
      'M. Chinnaswamy Stadium',
      'CRICKET',
      'Cubbon Park, Bengaluru',
      12.9788,
      77.5996
    ),
    venue(
      'blr',
      2,
      'Sree Kanteerava Stadium',
      'FOOTBALL',
      'Kasturba Road, Bengaluru',
      12.9698,
      77.593
    ),
    venue(
      'blr',
      3,
      'Cult Fit Indiranagar',
      'GYM',
      '100 Feet Road, Indiranagar, Bengaluru',
      12.9784,
      77.6408
    ),
    venue(
      'blr',
      4,
      'Bangalore MMA Academy',
      'COMBAT',
      'Koramangala, Bengaluru',
      12.9352,
      77.6245
    ),
    venue(
      'blr',
      5,
      'Karnataka State Boxing Association',
      'COMBAT',
      'Jayanagar, Bengaluru',
      12.9308,
      77.5838
    ),
    venue(
      'blr',
      6,
      'Cubbon Park Tennis Courts',
      'COURT KINGS',
      'Cubbon Park, Bengaluru',
      12.9763,
      77.5929
    ),
    venue(
      'blr',
      7,
      'Basavanagudi Aquatic Centre',
      'WAVE & BLADE',
      'Basavanagudi, Bengaluru',
      12.942,
      77.5665
    ),
    venue(
      'blr',
      8,
      'Gold\'s Gym Whitefield',
      'GYM',
      'Whitefield, Bengaluru',
      12.9698,
      77.7499
    ),
  ],
  che: [
    venue(
      'che',
      1,
      'M. A. Chidambaram Stadium',
      'CRICKET',
      'Chepauk, Chennai',
      13.0627,
      80.2794
    ),
    venue(
      'che',
      2,
      'Jawaharlal Nehru Stadium Chennai',
      'FOOTBALL',
      'Periamet, Chennai',
      13.0838,
      80.2712
    ),
    venue(
      'che',
      3,
      'Cult Fit T Nagar',
      'GYM',
      'T Nagar, Chennai',
      13.0418,
      80.2341
    ),
    venue(
      'che',
      4,
      'Chennai Combat Club',
      'COMBAT',
      'Anna Nagar, Chennai',
      13.085,
      80.2101
    ),
    venue(
      'che',
      5,
      'Mayor Radhakrishnan Hockey Stadium',
      'OTHERS',
      'Egmore, Chennai',
      13.0725,
      80.2609
    ),
    venue(
      'che',
      6,
      'SDAT Aquatic Complex',
      'WAVE & BLADE',
      'Velachery, Chennai',
      12.975,
      80.221
    ),
    venue(
      'che',
      7,
      'Boxing Federation Arena',
      'COMBAT',
      'Nandanam, Chennai',
      13.0334,
      80.2405
    ),
    venue(
      'che',
      8,
      'Gold\'s Gym OMR',
      'GYM',
      'OMR, Chennai',
      12.9121,
      80.2209
    ),
  ],
});

/**
 * Nearest city preset id for GPS / arbitrary coords.
 */
export function resolveNearestCityId(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'hyd';
  let bestId = 'hyd';
  let bestD = Infinity;
  for (const city of Object.values(CITY_COORDS)) {
    const d =
      (lat - city.latitude) ** 2 + (lng - city.longitude) ** 2;
    if (d < bestD) {
      bestD = d;
      bestId = city.id;
    }
  }
  return bestId;
}

/**
 * Curated venues for a city id (defaults Hyderabad).
 */
export function getCityVenueFallbacks(cityId) {
  const key = String(cityId || 'hyd').toLowerCase();
  const list = CITY_VENUE_FALLBACKS[key] || CITY_VENUE_FALLBACKS.hyd;
  return list.map((v) => ({ ...v }));
}
