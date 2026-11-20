/**
 * Interactive OpenStreetMap (Leaflet) for Expo web / localhost.
 * Native Android/iOS keep react-native-maps — this is web-only.
 */
import React, { createElement, memo, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLeafletHtml({ latitude, longitude, venues, selectedId, zoom }) {
  const lat = Number(latitude) || 17.385;
  const lng = Number(longitude) || 78.4867;
  const z = Number(zoom) || 13;
  const markers = (Array.isArray(venues) ? venues : [])
    .slice(0, 60)
    .map((v) => {
      const vLat = Number(v?.coordinate?.latitude);
      const vLng = Number(v?.coordinate?.longitude);
      if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) return null;
      return {
        id: String(v.id),
        name: String(v.name || 'Venue'),
        sport: String(v.sport || v.category || ''),
        lat: vLat,
        lng: vLng,
        selected: String(v.id) === String(selectedId),
      };
    })
    .filter(Boolean);

  const markersJson = JSON.stringify(markers).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin:0; padding:0; width:100%; height:100%; background:#08120F; }
    .leaflet-container { background:#08120F; font-family: system-ui, sans-serif; }
    .bawaal-pin {
      background:#000; color:#fff; border:2px solid #FFD700; border-radius:8px;
      padding:3px 6px; font-size:10px; font-weight:800; white-space:nowrap;
      box-shadow:0 0 10px rgba(255,215,0,0.45);
    }
    .bawaal-pin.on { border-color:#FF2A5F; box-shadow:0 0 12px rgba(255,42,95,0.55); }
    .leaflet-popup-content-wrapper { background:#0A1210; color:#fff; border-radius:10px; }
    .leaflet-popup-tip { background:#0A1210; }
    a { color:#FFD700; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var center = [${lat}, ${lng}];
      var markers = ${markersJson};
      var map = L.map('map', { zoomControl: true, attributionControl: true })
        .setView(center, ${z});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      L.circleMarker(center, {
        radius: 8, color: '#FF2A5F', fillColor: '#FFD700', fillOpacity: 0.9, weight: 2
      }).addTo(map).bindPopup('You are here');
      markers.forEach(function (m) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="bawaal-pin' + (m.selected ? ' on' : '') + '">' +
            (m.sport ? String(m.sport).slice(0, 8) : 'HUB') + '</div>',
          iconSize: [64, 28],
          iconAnchor: [32, 28]
        });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        var gmaps = 'https://www.google.com/maps/dir/?api=1&destination=' + m.lat + ',' + m.lng;
        marker.bindPopup(
          '<strong>' + m.name.replace(/</g,'&lt;') + '</strong><br/>' +
          (m.sport || '') + '<br/><a href="' + gmaps + '" target="_blank" rel="noopener">Directions</a>'
        );
        marker.on('click', function () {
          try {
            parent.postMessage(JSON.stringify({ type: 'bawaal-venue', id: m.id }), '*');
          } catch (e) {}
        });
      });
    })();
  </script>
</body>
</html>`;
}

function WebOsmMap({
  latitude,
  longitude,
  venues = [],
  selectedId = null,
  zoom = 13,
  onSelectVenue,
  style,
}) {
  const html = useMemo(
    () =>
      buildLeafletHtml({
        latitude,
        longitude,
        venues,
        selectedId,
        zoom,
      }),
    [latitude, longitude, venues, selectedId, zoom]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onMessage = (event) => {
      try {
        const data =
          typeof event?.data === 'string' ? JSON.parse(event.data) : event?.data;
        if (data?.type === 'bawaal-venue' && data.id) {
          onSelectVenue?.(String(data.id));
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelectVenue]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, style]}>
      {createElement('iframe', {
        title: 'BAWAAL Sport Hub Map',
        srcDoc: html,
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          backgroundColor: '#08120F',
        },
        allow: 'geolocation',
        loading: 'lazy',
      })}
      {/* Keep a11y hint for screen readers without cluttering the visual map */}
      <View accessibilityLabel={escapeHtml('Interactive OpenStreetMap')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#08120F',
    overflow: 'hidden',
  },
});

export default memo(WebOsmMap);
