/**
 * Community & Location — Sport Hub Map (NEAR ME).
 * Live GPS + Google Maps (PROVIDER_GOOGLE) + Overpass nearby venues
 * merged with Supabase sports_hubs. No hardcoded Virar seed pins.
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
import { BAWAAL_DARK_MAP_STYLE } from './src/constants/darkMapStyle';
import { BAWAAL_SPORTS } from './src/constants/sports';
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

const FILTER_ALL = 'ALL';

/** Locked 11 BAWAAL_SPORTS pills. */
const CATEGORY_PILLS = BAWAAL_SPORTS.map((sport) => ({
  key: sport,
  label: sport,
  color: HUB_SPORT_COLORS[sport] || (sport === 'ALL' ? '#FFFFFF' : '#FF5500'),
}));

let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = undefined;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
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

/** Soft India-center only until GPS resolves — never Virar clubs list. */
const BOOTSTRAP_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

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
            <Text style={[styles.sportBadgeText, { color }]}>{sport}</Text>
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
  const userCoordsRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(FILTER_ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tracksPins, setTracksPins] = useState(true);
  const [venues, setVenues] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Finding your location…');
  const [locationError, setLocationError] = useState(null);
  const mapsReady = Boolean(MapView) && Platform.OS !== 'web';

  useEffect(() => {
    const t = setTimeout(() => setTracksPins(false), 600);
    return () => clearTimeout(t);
  }, [venues, selectedCategory]);

  const animateToUser = useCallback((coords, animated = true) => {
    if (!coords) return;
    const region = regionFromCoords(coords.latitude, coords.longitude, 0.04);
    mapRef.current?.animateToRegion?.(region, animated ? 420 : 0);
  }, []);

  const loadNearby = useCallback(
    async (coords, category = selectedCategory) => {
      if (!coords) return;
      setLoadingVenues(true);
      setStatusMsg('Scanning nearby gyms, clubs & grounds…');
      try {
        const [cloud, overpass] = await Promise.all([
          fetchSportsHubs(category, {
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
            : 'No venues found nearby — try Recenter'
        );
        setTracksPins(true);
      } catch {
        setVenues([]);
        setStatusMsg('Could not load nearby venues');
      } finally {
        setLoadingVenues(false);
      }
    },
    [selectedCategory]
  );

  const locateAndLoad = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    setStatusMsg('Finding your location…');
    try {
      const coords = await resolveUserCoordinates({ timeoutMs: 8000 });
      userCoordsRef.current = coords;
      setUserCoords(coords);
      animateToUser(coords);
      await loadNearby(coords, selectedCategory);
    } catch (err) {
      const denied = err?.code === 'PERMISSION_DENIED';
      setLocationError(
        denied
          ? 'Location permission is required to find hubs near you.'
          : 'Could not get GPS. Check location services and try again.'
      );
      setStatusMsg(denied ? 'Permission needed' : 'GPS unavailable');
    } finally {
      setLocating(false);
    }
  }, [animateToUser, loadNearby, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // Yield so permission/GPS work is not sync setState inside the effect body.
      await Promise.resolve();
      if (cancelled) return;
      await locateAndLoad();
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // Mount-only cold start — category changes re-filter via onSelectCategory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVenues = useMemo(() => {
    const cat = String(selectedCategory || FILTER_ALL).toUpperCase();
    if (!cat || cat === FILTER_ALL) return venues;
    return venues.filter(
      (v) => (canonicalizeSport(v.sport || v.category) || '') === cat
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
      const coords = userCoordsRef.current || userCoords;
      if (coords) {
        void loadNearby(coords, next);
        animateToUser(coords);
      }
    },
    [animateToUser, loadNearby, userCoords]
  );

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Main', { tab: 'Locker' });
  }, [navigation]);

  const onMarkerPress = useCallback((hub) => {
    setSelectedId(hub.id);
    setSheetOpen(true);
    mapRef.current?.animateToRegion?.(
      {
        latitude: hub.coordinate.latitude,
        longitude: hub.coordinate.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.02,
      },
      280
    );
  }, []);

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
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      );
    });
  }, []);

  const onRecenter = useCallback(() => {
    void locateAndLoad();
  }, [locateAndLoad]);

  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
  const initialRegion = userCoords
    ? regionFromCoords(userCoords.latitude, userCoords.longitude, 0.04)
    : BOOTSTRAP_REGION;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <BackLink label="Back" onPress={goBack} accent="#3B82F6" />
        <View style={styles.topTitles}>
          <Text style={styles.topTitle}>SPORT HUB MAP</Text>
          <Text style={styles.topSub}>NEAR ME · Live GPS</Text>
        </View>
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={onRecenter}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Recenter on my location"
        >
          <Text style={styles.recenterBtnText}>RECENTER</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        {(locating || loadingVenues) && (
          <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.statusText} numberOfLines={1}>
          {locationError || statusMsg}
        </Text>
      </View>

      <View style={styles.mapStage}>
        {mapsReady ? (
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
        ) : (
          <ScrollView
            style={styles.fallbackList}
            contentContainerStyle={styles.fallbackContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fallbackHint}>
              Native Google Map loads in Android / iOS builds. Nearby venues
              still list below.
            </Text>
            {filteredVenues.map((spot) => {
              const color = hubPinColor(spot.sport || spot.category);
              return (
                <TouchableOpacity
                  key={spot.id}
                  style={[
                    styles.fallbackCard,
                    selectedId === spot.id && { borderColor: color },
                    { borderColor: color, borderWidth: 1.5 },
                  ]}
                  onPress={() => onMarkerPress(spot)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.fallbackName}>{spot.name}</Text>
                  <Text style={styles.fallbackAddr}>{spot.address}</Text>
                  <Text style={[styles.fallbackSport, { color }]}>
                    ★ {canonicalizeSport(spot.sport || spot.category)}
                    {spot.distanceM != null
                      ? ` · ${formatDistance(spot.distanceM)}`
                      : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Bottom venue cards */}
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
                      {canonicalizeSport(spot.sport || spot.category)}
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

        {/* Category filter pills */}
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
  recenterBtn: {
    borderWidth: 1,
    borderColor: CRIMSON,
    backgroundColor: 'rgba(255,42,95,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: 'center',
  },
  recenterBtnText: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BG,
  },
  statusText: {
    flex: 1,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
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
  },
  fallbackContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 10,
  },
  fallbackHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 17,
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    padding: 14,
  },
  fallbackName: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
  },
  fallbackAddr: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  fallbackSport: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.5,
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
