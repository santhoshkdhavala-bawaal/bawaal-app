/**
 * Google Maps JSON style — stealth-black BAWAAL map chrome.
 * Admin + road labels: high-contrast slate (#E2E8F0) on black stroke.
 * Non-essential POIs muted / simplified to cut visual noise.
 * Applied via MapView `customMapStyle` (Google provider / Android; iOS Apple Maps ignores).
 */
export const BAWAAL_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#E2E8F0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },

  // —— Administrative labels ——
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },

  // —— Non-essential POIs: mute / simplify ——
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'simplified' }, { color: '#1A202C' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#1A202C' }],
  },
  {
    featureType: 'poi.place_of_worship',
    stylers: [{ visibility: 'simplified' }, { color: '#1A202C' }],
  },
  {
    featureType: 'poi.attraction',
    stylers: [{ visibility: 'simplified' }, { color: '#1A202C' }],
  },
  {
    featureType: 'poi.government',
    stylers: [{ visibility: 'simplified' }, { color: '#1A202C' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f1410' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4ade80' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#122018' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },

  // —— Roads: vivid white / silver + high-contrast labels ——
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#E0E0E0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#E8E8E8' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#D0D0D0' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E0E0E0' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E0E0E0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E0E0E0' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },

  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#151515' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#C0C0C0' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3b82f6' }],
  },
];
