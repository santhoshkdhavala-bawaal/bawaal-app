/**
 * Community & Location — Sport Hub Map (NEAR ME).
 * Native: react-native-maps + PROVIDER_GOOGLE + live GPS.
 * Web: interactive Leaflet/OSM iframe (localhost:8081).
 * GPS fail → Hyderabad (or city switcher) + always load nearby venues.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackLink from './src/components/BackLink';
import WebOsmMap from './src/components/WebOsmMap';
import { BAWAAL_DARK_MAP_STYLE } from './src/constants/darkMapStyle';
import {
  GAME_ON_CATEGORY_PILLS,
  resolveDashboardCategory,
} from './src/constants/gameOnSports';
import {
  HUB_SPORT_COLORS,
  hubPinColor,
  sportsSpotNeon,
} from './src/data/sportHubs';
import {
  NEARBY_RADIUS_M,
  fetchOverpassSportsVenues,
  formatDistance,
  mergeNearbyVenues,
} from './src/services/nearbySportsVenuesService';
import { fetchSportsHubs } from './src/services/sportsHubsService';
import { canonicalizeSport } from './src/utils/sportCategory';
import {
  regionFromCoords,
  resolveUserCoordinates,
} from './src/utils/userLocation';

const FILTER_ALL = 'All';

const CATEGORY_PILL_COLORS = {
  All: '#FFFFFF',
  'Ball Sports': '#FFD700',
  'Combat Sports': '#FF2A5F',
  'Racing & Speed': '#A855F7',
  'Water & Surf': '#00E5FF',
  'Extreme & Adventure': '#39FF14',
  'Strength & Fitness': '#FF5500',
  Others: '#E8ECE9',
};

/** Exact 8 GAME ON category pills. */
const CATEGORY_PILLS = GAME_ON_CATEGORY_PILLS.map((label) => ({
  key: label,
  label,
  color: CATEGORY_PILL_COLORS[label] || HUB_SPORT_COLORS.OTHERS || '#FF5500',
}));

const DEFAULT_CITY = {
  id: 'hyd',
  label: 'Hyderabad',
  latitude: 17.385,
  longitude: 78.4867,
};

const CITY_PRESETS = [
  DEFAULT_CITY,
  { id: 'del', label: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { id: 'mum', label: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { id: 'blr', label: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  { id: 'che', label: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
];

let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = undefined;
try {
  if (Platform.OS !== 'web') {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  }
} catch {
  MapView = null;
}

const BG = '#08120F';
const SURFACE = '#0A1210';
const WHITE = '#FFFFFF';
const OFF = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';
const GOLD = '#FFD700';
const CRIMSON = '#FF2A5F';
const BADGE_TEXT = '#FFFFFF';

const HubPin = memo(function HubPin({ sport, selected }) {
  const color = hubPinColor(sport) || sportsSpotNeon(sport);
  const label = canonicalizeSport(sport) || 'HUB';
  const short =
    label.length > 10 ? label.split(' ')[0].slice(0, 6) : label.slice(0, 8);

  return (
    <View style={[styles.glowWrap, selected && styles.pinWrapOn]}>
      <View
        style={[
          styles.glowHalo,
          { borderColor: color, shadowColor: color, backgroundColor: `${color}22` },
        ]}
      />
      <View style={[styles.glowBadge, { borderColor: color, shadowColor: color }]}>
        <Text style={styles.glowBadgeText} numberOfLines={1}>
          {short}
        </Text>
      </View>
      <View style={[styles.pinStem, { borderTopColor: color }]} />
    </View>
  );
});

function HubBottomSheet({ hub, visible, onClose, onDirections, bottomPad }) {
  if (!hub) return null;
  const sport = canonicalizeSport(hub.sport) || hub.sport;
  const dashCat = resolveDashboardCategory(sport);
  const color = hubPinColor(sport);
  const dist = formatDistance(hub.distanceM);

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.sheetDock,
        { paddingBottom: bottomPad, opacity: visible ? 1 : 0 },
      ]}
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetEyebrow}>NEARBY VENUE</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.75}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hubName}>{hub.name}</Text>
        <Text style={styles.hubAddress}>{hub.address}</Text>

        <View style={styles.metaRow}>
          <View style={[styles.sportBadge, { borderColor: color }]}>
            <View style={[styles.sportDot, { backgroundColor: color }]} />
            <Text style={[styles.sportBadgeText, { color }]}>{dashCat}</Text>
          </View>
          {dist ? <Text style={styles.metaStat}>{dist} away</Text> : null}
        </View>

        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => onDirections?.(hub)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open directions in Google Maps"
        >
          <Text style={styles.directionsBtnText}>DIRECTIONS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SportHubMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const originRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(FILTER_ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tracksPins, setTracksPins] = useState(true);
  const [venues, setVenues] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [activeCityId, setActiveCityId] = useState(DEFAULT_CITY.id);
  const [usingGps, setUsingGps] = useState(false);
  const [locating, setLocating] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Finding your location…');
  const [locationHint, setLocationHint] = useState(null);
  const isWeb = Platform.OS === 'web';
  const nativeMapsReady = Boolean(MapView) && !isWeb;

  useEffect(() => {
    const t = setTimeout(() => setTracksPins(false), 600);
    return () => clearTimeout(t);
  }, [venues, selectedCategory]);

  const animateNativeTo = useCallback((coords, animated = true) => {
    if (!coords || !nativeMapsReady) return;
    const region = regionFromCoords(coords.latitude, coords.longitude, 0.04);
    mapRef.current?.animateToRegion?.(region, animated ? 420 : 0);
  }, [nativeMapsReady]);

  const loadNearby = useCallback(async (coords, category = selectedCategory) => {
    if (!coords) return;
    setLoadingVenues(true);
    setStatusMsg('Scanning nearby gyms, clubs & grounds…');
    try {
      // Cloud fetch is unfiltered; GAME ON category applied in merge.
      const [cloud, overpass] = await Promise.all([
        fetchSportsHubs('ALL', {
          allowLocalFallback: false,
          near: coords,
          radiusM: NEARBY_RADIUS_M,
        }),
        fetchOverpassSportsVenues(
          coords.latitude,
          coords.longitude,
          NEARBY_RADIUS_M
        ),
      ]);
      const merged = mergeNearbyVenues({
        cloudHubs: cloud?.hubs || [],
        overpassVenues: overpass || [],
        origin: coords,
        selectedCategory: category,
        radiusM: NEARBY_RADIUS_M,
      });
      setVenues(merged);
      setStatusMsg(
        merged.length
          ? `${merged.length} venues within ~${Math.round(NEARBY_RADIUS_M / 1000)} km`
          : 'No OSM venues in range — try another city'
      );
      setTracksPins(true);
    } catch {
      setVenues([]);
      setStatusMsg('Could not load nearby venues');
    } finally {
      setLoadingVenues(false);
    }
  }, [selectedCategory]);

  const applyOrigin = useCallback(
    async (coords, { cityId = null, gps = false, hint = null } = {}) => {
      const next = {
        latitude: Number(coords.latitude),
        longitude: Number(coords.longitude),
      };
      if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) {
        return;
      }
      originRef.current = next;
      setOrigin(next);
      setUsingGps(!!gps);
      setActiveCityId(cityId || (gps ? 'gps' : DEFAULT_CITY.id));
      setLocationHint(hint);
      animateNativeTo(next);
      await loadNearby(next, selectedCategory);
    },
    [animateNativeTo, loadNearby, selectedCategory]
  );

  const applyCity = useCallback(
    async (city) => {
      setLocating(true);
      setStatusMsg(`Loading ${city.label}…`);
      try {
        await applyOrigin(city, {
          cityId: city.id,
          gps: false,
          hint: `Showing ${city.label} (city preset)`,
        });
      } finally {
        setLocating(false);
      }
    },
    [applyOrigin]
  );

  const locateAndLoad = useCallback(async () => {
    setLocating(true);
    setLocationHint(null);
    setStatusMsg('Finding your location…');
    try {
      const coords = await resolveUserCoordinates({ timeoutMs: 8000 });
      await applyOrigin(coords, {
        cityId: 'gps',
        gps: true,
        hint: null,
      });
    } catch (err) {
      const denied = err?.code === 'PERMISSION_DENIED';
      const hint = denied
        ? 'GPS blocked — showing Hyderabad. Tap Use My GPS or pick a city.'
        : 'GPS unavailable — showing Hyderabad. Tap Use My GPS or pick a city.';
      setLocationHint(hint);
      await applyOrigin(DEFAULT_CITY, {
        cityId: DEFAULT_CITY.id,
        gps: false,
        hint,
      });
    } finally {
      setLocating(false);
    }
  }, [applyOrigin]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await Promise.resolve();
      if (cancelled) return;
      await locateAndLoad();
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVenues = useMemo(() => {
    if (!selectedCategory || selectedCategory === FILTER_ALL) return venues;
    return venues.filter(
      (v) =>
        resolveDashboardCategory(v.sport || v.category) === selectedCategory
    );
  }, [venues, selectedCategory]);

  const selectedHub = useMemo(
    () => filteredVenues.find((h) => h.id === selectedId) || null,
    [selectedId, filteredVenues]
  );

  const onSelectCategory = useCallback(
    (category) => {
      const next = String(category || FILTER_ALL).trim() || FILTER_ALL;
      setSelectedCategory(next);
      setSelectedId(null);
      setSheetOpen(false);
      const coords = originRef.current || origin;
      if (coords) {
        void loadNearby(coords, next);
        animateNativeTo(coords);
      }
    },
    [animateNativeTo, loadNearby, origin]
  );

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Main', { tab: 'Locker' });
  }, [navigation]);

  const onMarkerPress = useCallback(
    (hub) => {
      setSelectedId(hub.id);
      setSheetOpen(true);
      if (nativeMapsReady) {
        mapRef.current?.animateToRegion?.(
          {
            latitude: hub.coordinate.latitude,
            longitude: hub.coordinate.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.02,
          },
          280
        );
      }
    },
    [nativeMapsReady]
  );

  const onWebSelectVenue = useCallback(
    (id) => {
      const hub = filteredVenues.find((v) => String(v.id) === String(id));
      if (hub) onMarkerPress(hub);
    },
    [filteredVenues, onMarkerPress]
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const openDirections = useCallback((hub) => {
    const lat = hub?.coordinate?.latitude;
    const lng = hub?.coordinate?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = encodeURIComponent(hub?.name || 'Venue');
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      );
    });
  }, []);

  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
  const mapCenter = origin || DEFAULT_CITY;
  const initialRegion = regionFromCoords(
    mapCenter.latitude,
    mapCenter.longitude,
    0.04
  );

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <BackLink label="Back" onPress={goBack} accent="#3B82F6" />
        <View style={styles.topTitles}>
          <Text style={styles.topTitle}>SPORT HUB MAP</Text>
          <Text style={styles.topSub}>
            {isWeb ? 'NEAR ME · Web map' : 'NEAR ME · Live GPS'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={() => void locateAndLoad()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Use my GPS"
        >
          <Text style={styles.gpsBtnText}>
            {usingGps ? 'RECENTER' : 'USE GPS'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        {(locating || loadingVenues) && (
          <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.statusText} numberOfLines={2}>
          {locationHint || statusMsg}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cityRow}
        style={styles.cityScroll}
        keyboardShouldPersistTaps="handled"
      >
        {CITY_PRESETS.map((city) => {
          const active = !usingGps && activeCityId === city.id;
          return (
            <TouchableOpacity
              key={city.id}
              style={[styles.cityChip, active && styles.cityChipOn]}
              onPress={() => void applyCity(city)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show map in ${city.label}`}
            >
              <Text style={[styles.cityChipText, active && styles.cityChipTextOn]}>
                {city.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.mapStage}>
        {nativeMapsReady ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1, width: '100%', height: '100%' }}
            provider={mapProvider}
            initialRegion={initialRegion}
            customMapStyle={BAWAAL_DARK_MAP_STYLE}
            userInterfaceStyle="dark"
            showsUserLocation
            showsMyLocationButton
            showsCompass={false}
            showsPointsOfInterest={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            onPress={() => {
              if (sheetOpen) closeSheet();
            }}
          >
            {filteredVenues.map((spot) => (
              <Marker
                key={`${selectedCategory}-${spot.id}`}
                coordinate={spot.coordinate}
                tracksViewChanges={tracksPins || selectedId === spot.id}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onMarkerPress(spot);
                }}
                accessibilityLabel={`${spot.name} ${spot.sport || spot.category}`}
              >
                <HubPin
                  sport={spot.sport || spot.category}
                  selected={selectedId === spot.id}
                />
              </Marker>
            ))}
          </MapView>
        ) : isWeb ? (
          <WebOsmMap
            latitude={mapCenter.latitude}
            longitude={mapCenter.longitude}
            venues={filteredVenues}
            selectedId={selectedId}
            onSelectVenue={onWebSelectVenue}
            zoom={13}
          />
        ) : (
          <View style={styles.fallbackList}>
            <Text style={styles.fallbackHint}>
              Map unavailable on this platform. Venue list still loads below.
            </Text>
          </View>
        )}

        {filteredVenues.length > 0 && !sheetOpen ? (
          <View
            style={[
              styles.cardRailWrap,
              { bottom: Math.max(insets.bottom, 12) + 56 },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRail}
              keyboardShouldPersistTaps="handled"
            >
              {filteredVenues.slice(0, 24).map((spot) => {
                const color = hubPinColor(spot.sport || spot.category);
                const active = selectedId === spot.id;
                return (
                  <Pressable
                    key={`card-${spot.id}`}
                    style={[
                      styles.venueCard,
                      active && { borderColor: GOLD },
                    ]}
                    onPress={() => onMarkerPress(spot)}
                  >
                    <Text style={styles.venueCardName} numberOfLines={1}>
                      {spot.name}
                    </Text>
                    <Text style={[styles.venueCardMeta, { color }]} numberOfLines={1}>
                      {resolveDashboardCategory(spot.sport || spot.category)}
                      {spot.distanceM != null
                        ? ` · ${formatDistance(spot.distanceM)}`
                        : ''}
                    </Text>
                    <TouchableOpacity
                      style={styles.venueCardDir}
                      onPress={() => openDirections(spot)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.venueCardDirText}>DIRECTIONS</Text>
                    </TouchableOpacity>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.legend, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legendRow}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORY_PILLS.map((pill) => {
              const active = selectedCategory === pill.key;
              return (
                <TouchableOpacity
                  key={pill.key}
                  style={[
                    styles.legendChip,
                    active && styles.legendChipActive,
                    active && {
                      borderColor: pill.color,
                      backgroundColor: `${pill.color}33`,
                      shadowColor: pill.color,
                    },
                  ]}
                  onPress={() => onSelectCategory(pill.key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter ${pill.label}`}
                >
                  <View
                    style={[styles.legendDot, { backgroundColor: pill.color }]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      active && styles.legendTextActive,
                      active && { color: pill.color },
                    ]}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <HubBottomSheet
          hub={selectedHub}
          visible={sheetOpen && !!selectedHub}
          onClose={closeSheet}
          onDirections={openDirections}
          bottomPad={bottomPad + 48}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    zIndex: 2,
  },
  topTitles: {
    alignItems: 'center',
    flex: 1,
  },
  topTitle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  topSub: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  gpsBtn: {
    borderWidth: 1,
    borderColor: CRIMSON,
    backgroundColor: 'rgba(255,42,95,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: 'center',
  },
  gpsBtnText: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: BG,
  },
  statusText: {
    flex: 1,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  cityScroll: {
    maxHeight: 44,
    backgroundColor: BG,
  },
  cityRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  cityChip: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cityChipOn: {
    borderColor: GOLD,
    backgroundColor: 'rgba(255,215,0,0.14)',
  },
  cityChipText: {
    color: OFF,
    fontSize: 11,
    fontWeight: '800',
  },
  cityChipTextOn: {
    color: GOLD,
  },
  mapStage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
  },
  fallbackList: {
    flex: 1,
    backgroundColor: BG,
    padding: 16,
  },
  fallbackHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  pinWrapOn: {
    transform: [{ scale: 1.08 }],
  },
  glowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    top: -4,
    width: 70,
    height: 38,
    borderRadius: 12,
    borderWidth: 2.5,
    opacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  glowBadge: {
    minWidth: 58,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.96)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 12,
  },
  glowBadgeText: {
    color: BADGE_TEXT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pinStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  cardRailWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardRail: {
    paddingHorizontal: 12,
    gap: 10,
  },
  venueCard: {
    width: 200,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(8,18,15,0.94)',
    padding: 12,
  },
  venueCardName: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },
  venueCardMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  venueCardDir: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  venueCardDirText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  legend: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 3,
  },
  legendRow: {
    gap: 8,
    paddingVertical: 6,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,18,15,0.88)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  legendChipActive: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: OFF,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  legendTextActive: {
    fontWeight: '900',
  },
  sheetDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  sheetClose: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  hubName: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  hubAddress: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: BG,
  },
  sportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  metaStat: {
    color: OFF,
    fontSize: 12,
    fontWeight: '700',
  },
  directionsBtn: {
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: 'rgba(255,215,0,0.14)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  directionsBtnText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
