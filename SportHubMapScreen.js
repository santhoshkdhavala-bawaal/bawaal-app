/**
 * Community & Location — Interactive Sport Hub Map (Step 1).
 * Dark stealth map + sport-tagged pins + hub bottom sheet.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
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
import {
  HUB_SPORT_COLORS,
  SPORT_HUB_MAP_REGION,
  SPORT_HUBS,
  hubPinColor,
} from './src/data/sportHubs';
import { canonicalizeSport } from './src/utils/sportCategory';

let MapView = null;
let Marker = null;
let PROVIDER_GOOGLE = undefined;
try {
  // Native / Expo Go — maps unavailable on web metro without polyfill
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch {
  MapView = null;
}

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const OFF = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';
const ACCENT = '#3B82F6';
const JOIN = '#FACC15';

const HubPin = memo(function HubPin({ sport, selected }) {
  const color = hubPinColor(sport);
  const label = canonicalizeSport(sport) || 'HUB';
  const short =
    label.length > 10 ? label.split(' ')[0].slice(0, 6) : label.slice(0, 8);
  return (
    <View style={[styles.pinWrap, selected && styles.pinWrapOn]}>
      <View style={[styles.pinDot, { borderColor: color }]}>
        <Text style={[styles.pinText, { color }]} numberOfLines={1}>
          {short}
        </Text>
      </View>
      <View style={[styles.pinStem, { borderTopColor: color }]} />
    </View>
  );
});

function HubBottomSheet({ hub, visible, onClose, onViewHub, onJoinSquad, bottomPad }) {
  if (!hub) return null;
  const sport = canonicalizeSport(hub.sport) || hub.sport;
  const color = hubPinColor(sport);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>SPORT HUB</Text>
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
            <Text style={styles.metaStat}>
              {hub.memberCount} members · {hub.squadCount} squad
              {hub.squadCount === 1 ? '' : 's'}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => onViewHub?.(hub)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="View Hub"
            >
              <Text style={styles.viewBtnText}>VIEW HUB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => onJoinSquad?.(hub)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Join Squad"
            >
              <Text style={styles.joinBtnText}>JOIN SQUAD</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SportHubMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tracksPins, setTracksPins] = useState(true);
  const mapsReady = Boolean(MapView) && Platform.OS !== 'web';

  useEffect(() => {
    const t = setTimeout(() => setTracksPins(false), 600);
    return () => clearTimeout(t);
  }, []);

  const selectedHub = useMemo(
    () => SPORT_HUBS.find((h) => h.id === selectedId) || null,
    [selectedId]
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
        latitudeDelta: 0.06,
        longitudeDelta: 0.04,
      },
      280
    );
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const openLockerForHub = useCallback(
    (hub, join) => {
      setSheetOpen(false);
      const params = {
        tab: 'Locker',
        focusHubId: hub?.lockerHubId || undefined,
        joinSquadHint: join ? hub?.name : undefined,
      };
      if (navigation?.canGoBack?.()) {
        navigation.navigate('Main', params);
      } else {
        navigation?.navigate?.('Main', params);
      }
    },
    [navigation]
  );

  const onViewHub = useCallback(
    (hub) => openLockerForHub(hub, false),
    [openLockerForHub]
  );

  const onJoinSquad = useCallback(
    (hub) => openLockerForHub(hub, true),
    [openLockerForHub]
  );

  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <BackLink label="Back" onPress={goBack} />
        <View style={styles.topTitles}>
          <Text style={styles.topTitle}>SPORT HUB MAP</Text>
          <Text style={styles.topSub}>Community · Location</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      <View style={styles.mapStage}>
        {mapsReady ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={mapProvider}
            initialRegion={SPORT_HUB_MAP_REGION}
            customMapStyle={BAWAAL_DARK_MAP_STYLE}
            userInterfaceStyle="dark"
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsPointsOfInterest={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            onPress={() => {
              if (sheetOpen) closeSheet();
            }}
          >
            {SPORT_HUBS.map((hub) => (
              <Marker
                key={hub.id}
                coordinate={hub.coordinate}
                tracksViewChanges={tracksPins || selectedId === hub.id}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onMarkerPress(hub);
                }}
                accessibilityLabel={`${hub.name} ${hub.sport}`}
              >
                <HubPin sport={hub.sport} selected={selectedId === hub.id} />
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
              Map preview — tap a hub card (native map loads in Expo Go / dev builds).
            </Text>
            {SPORT_HUBS.map((hub) => {
              const color = hubPinColor(hub.sport);
              return (
                <TouchableOpacity
                  key={hub.id}
                  style={[
                    styles.fallbackCard,
                    selectedId === hub.id && { borderColor: color },
                  ]}
                  onPress={() => onMarkerPress(hub)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.fallbackName}>{hub.name}</Text>
                  <Text style={styles.fallbackAddr}>{hub.address}</Text>
                  <Text style={[styles.fallbackSport, { color }]}>
                    {canonicalizeSport(hub.sport)} · {hub.memberCount} members
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Legend strip */}
        <View style={[styles.legend, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legendRow}
          >
            {Object.entries(HUB_SPORT_COLORS)
              .filter(([k]) => k !== 'ALL')
              .slice(0, 8)
              .map(([sport, color]) => (
                <View key={sport} style={styles.legendChip}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{sport}</Text>
                </View>
              ))}
          </ScrollView>
        </View>
      </View>

      <HubBottomSheet
        hub={selectedHub}
        visible={sheetOpen && !!selectedHub}
        onClose={closeSheet}
        onViewHub={onViewHub}
        onJoinSquad={onJoinSquad}
        bottomPad={bottomPad}
      />
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
    paddingHorizontal: 16,
    paddingBottom: 10,
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
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  mapStage: {
    flex: 1,
    backgroundColor: BG,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
  pinWrap: {
    alignItems: 'center',
  },
  pinWrapOn: {
    transform: [{ scale: 1.08 }],
  },
  pinDot: {
    minWidth: 54,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  pinText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
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
  legend: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  legendRow: {
    gap: 8,
    paddingVertical: 6,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
    color: ACCENT,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  viewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewBtnText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  joinBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: JOIN,
    backgroundColor: 'rgba(250,204,21,0.16)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinBtnText: {
    color: JOIN,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
