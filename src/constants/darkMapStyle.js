/**
 * Google Maps JSON style — stealth-black BAWAAL map chrome.
 * Label readability (100%):
 *   road names → Electric Orange #FF6600
 *   localities → Bright Cyan #00F0FF
 *   POI / minor places → Warm Gold #FFE082
 * All text strokes → solid black #000000, weight 4 (heavy halo).
 * Business POIs + transit hidden. Applied via MapView `customMapStyle`.
 */
const ROAD_LINE = '#FFFFFF';
const ROAD_LABEL_FILL = '#FF6600';
const LOCALITY_LABEL_FILL = '#00F0FF';
const POI_LABEL_FILL = '#FFE082';
const LABEL_STROKE = '#000000';
const LABEL_STROKE_WEIGHT = 4.0;

function labelFill(color) {
  return {
    elementType: 'labels.text.fill',
    stylers: [{ color }],
  };
}

function labelStroke() {
  return {
    elementType: 'labels.text.stroke',
    stylers: [{ color: LABEL_STROKE }, { weight: LABEL_STROKE_WEIGHT }],
  };
}

export const BAWAAL_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  // Global defaults — gold fill + heavy black halo (overridden per feature below)
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: POI_LABEL_FILL }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: LABEL_STROKE }, { weight: LABEL_STROKE_WEIGHT }],
  },

  // —— Administrative / localities (Virar East, Ambawadi, …) → Bright Cyan ——
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  { featureType: 'administrative', ...labelFill(LOCALITY_LABEL_FILL) },
  { featureType: 'administrative', ...labelStroke() },
  { featureType: 'administrative.country', ...labelFill(LOCALITY_LABEL_FILL) },
  { featureType: 'administrative.country', ...labelStroke() },
  { featureType: 'administrative.province', ...labelFill(LOCALITY_LABEL_FILL) },
  { featureType: 'administrative.province', ...labelStroke() },
  { featureType: 'administrative.locality', ...labelFill(LOCALITY_LABEL_FILL) },
  { featureType: 'administrative.locality', ...labelStroke() },
  { featureType: 'administrative.neighborhood', ...labelFill(LOCALITY_LABEL_FILL) },
  { featureType: 'administrative.neighborhood', ...labelStroke() },
  { featureType: 'administrative.land_parcel', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'administrative.land_parcel', ...labelStroke() },

  // —— POI / minor place labels → Warm Gold ——
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  { featureType: 'poi', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi', ...labelStroke() },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  { featureType: 'poi.medical', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.medical', ...labelStroke() },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  { featureType: 'poi.school', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.school', ...labelStroke() },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f1410' }],
  },
  { featureType: 'poi.park', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.park', ...labelStroke() },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#122018' }],
  },
  { featureType: 'poi.sports_complex', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.sports_complex', ...labelStroke() },
  { featureType: 'poi.attraction', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.attraction', ...labelStroke() },
  { featureType: 'poi.place_of_worship', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.place_of_worship', ...labelStroke() },
  { featureType: 'poi.government', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'poi.government', ...labelStroke() },

  // —— Roads: white geometry; street names Electric Orange + heavy black halo ——
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: ROAD_LINE }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: ROAD_LINE }],
  },
  { featureType: 'road', ...labelFill(ROAD_LABEL_FILL) },
  { featureType: 'road', ...labelStroke() },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: ROAD_LINE }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: ROAD_LINE }],
  },
  { featureType: 'road.arterial', ...labelFill(ROAD_LABEL_FILL) },
  { featureType: 'road.arterial', ...labelStroke() },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: ROAD_LINE }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: ROAD_LINE }],
  },
  { featureType: 'road.local', ...labelFill(ROAD_LABEL_FILL) },
  { featureType: 'road.local', ...labelStroke() },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: ROAD_LINE }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: ROAD_LINE }],
  },
  { featureType: 'road.highway', ...labelFill(ROAD_LABEL_FILL) },
  { featureType: 'road.highway', ...labelStroke() },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: ROAD_LINE }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: ROAD_LINE }],
  },
  { featureType: 'road.highway.controlled_access', ...labelFill(ROAD_LABEL_FILL) },
  { featureType: 'road.highway.controlled_access', ...labelStroke() },

  // —— Transit: fully hidden ——
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },

  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  { featureType: 'water', ...labelFill(POI_LABEL_FILL) },
  { featureType: 'water', ...labelStroke() },
];
