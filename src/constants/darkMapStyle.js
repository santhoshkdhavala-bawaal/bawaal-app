/**
 * Google Maps JSON style — stealth-black BAWAAL map chrome.
 * Road lines: white (#FFFFFF). Road labels: electric orange (#FF6600) + black halo.
 * Place/area labels: electric cyan (#00F0FF) + black halo.
 * Business POIs + transit hidden so sports hubs / major roads stay prominent.
 * Applied via MapView `customMapStyle` (Google provider / Android; iOS Apple Maps ignores).
 */
const ROAD_LINE = '#FFFFFF';
const ROAD_LABEL_FILL = '#FF6600'; // Electric orange — street names never wash out
const PLACE_LABEL_FILL = '#00F0FF'; // Electric cyan — distinct from white roads
const LABEL_FILL = '#FFFFFF';
const LABEL_STROKE = '#000000';
const LABEL_STROKE_WEIGHT = 3.0;
const ROAD_LABEL_STROKE_WEIGHT = 3.0;

function labelFill(color = LABEL_FILL) {
  return {
    elementType: 'labels.text.fill',
    stylers: [{ color }],
  };
}

function labelStroke(weight = LABEL_STROKE_WEIGHT) {
  return {
    elementType: 'labels.text.stroke',
    stylers: [{ color: LABEL_STROKE }, { weight }],
  };
}

function roadLabelFill() {
  return labelFill(ROAD_LABEL_FILL);
}

function roadLabelStroke() {
  return labelStroke(ROAD_LABEL_STROKE_WEIGHT);
}

function placeLabelFill() {
  return labelFill(PLACE_LABEL_FILL);
}

export const BAWAAL_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  // Global label defaults
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: LABEL_FILL }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: LABEL_STROKE }, { weight: LABEL_STROKE_WEIGHT }],
  },

  // —— Place / area names (Ambawadi, Yashvant Viva Twp, Virar East, …) ——
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  { featureType: 'administrative', ...placeLabelFill() },
  { featureType: 'administrative', ...labelStroke() },
  { featureType: 'administrative.country', ...placeLabelFill() },
  { featureType: 'administrative.country', ...labelStroke() },
  { featureType: 'administrative.province', ...placeLabelFill() },
  { featureType: 'administrative.province', ...labelStroke() },
  { featureType: 'administrative.locality', ...placeLabelFill() },
  { featureType: 'administrative.locality', ...labelStroke() },
  { featureType: 'administrative.neighborhood', ...placeLabelFill() },
  { featureType: 'administrative.neighborhood', ...labelStroke() },
  { featureType: 'administrative.land_parcel', ...placeLabelFill() },
  { featureType: 'administrative.land_parcel', ...labelStroke() },

  // —— POIs: keep sports / parks; hide business clutter ——
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  { featureType: 'poi', ...labelFill() },
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
  { featureType: 'poi.medical', ...labelFill() },
  { featureType: 'poi.medical', ...labelStroke() },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#1A202C' }],
  },
  { featureType: 'poi.school', ...labelFill() },
  { featureType: 'poi.school', ...labelStroke() },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f1410' }],
  },
  { featureType: 'poi.park', ...labelFill() },
  { featureType: 'poi.park', ...labelStroke() },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#122018' }],
  },
  { featureType: 'poi.sports_complex', ...labelFill() },
  { featureType: 'poi.sports_complex', ...labelStroke() },

  // —— Roads: white lines; street names electric orange (#FF6600) + black halo ——
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
  { featureType: 'road', ...roadLabelFill() },
  { featureType: 'road', ...roadLabelStroke() },
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
  { featureType: 'road.arterial', ...roadLabelFill() },
  { featureType: 'road.arterial', ...roadLabelStroke() },
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
  { featureType: 'road.local', ...roadLabelFill() },
  { featureType: 'road.local', ...roadLabelStroke() },
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
  { featureType: 'road.highway', ...roadLabelFill() },
  { featureType: 'road.highway', ...roadLabelStroke() },
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
  { featureType: 'road.highway.controlled_access', ...roadLabelFill() },
  { featureType: 'road.highway.controlled_access', ...roadLabelStroke() },

  // —— Transit: fully hidden ——
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.station',
    stylers: [{ visibility: 'off' }],
  },

  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  { featureType: 'water', ...labelFill() },
  { featureType: 'water', ...labelStroke() },
];
