/**
 * V2 Arena top header — combined BAWAAL mark, ARENA label,
 * pulsing ● LIVE pill, glowing ▶ GAME ON pill, notification bell.
 */
import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG = '#0A0A0A';
const WHITE = '#FFFFFF';
const ACCENT = '#FF5A00';
const LIVE_ORANGE = '#FF5A1F';
const LIVE_CRIMSON = '#E53935';
const MUTED = '#A9A9A9';

const COMBINED_LOGO = require('../../assets/BAWAAL_logo_combined.png');

function LivePill({ onPress, liveCount = 0 }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const count = Math.max(0, Number(liveCount) || 0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.95],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0
          ? `Open BAWAAL LIVE hub, ${count} live`
          : 'Open BAWAAL LIVE hub'
      }
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <View style={styles.liveWrap}>
        <Animated.View
          pointerEvents="none"
          style={[styles.liveGlow, { opacity: glowOpacity }]}
        />
        <View style={styles.livePill}>
          <Animated.View style={[styles.liveDot, { opacity: dotOpacity }]} />
          <Text style={styles.liveText}>LIVE</Text>
          {count > 0 ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>
                {count > 99 ? '99+' : String(count)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GameOnPill({ onPress }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Open GAME ON command drawer"
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <View style={styles.gameOnWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.gameOnGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
        <View style={styles.gameOnPill}>
          <Text style={styles.gameOnText}>▶ GAME ON</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ArenaV2Header({
  onBrandPress,
  onLivePress,
  liveCount = 0,
  onGameOnPress,
  onNotificationsPress,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onBrandPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open profile gateway"
          hitSlop={{ top: 8, bottom: 4, left: 4, right: 8 }}
          style={styles.brandHit}
        >
          <View style={styles.brandStack}>
            <Image
              source={COMBINED_LOGO}
              style={styles.combinedLogo}
              resizeMode="contain"
              accessibilityLabel="BAWAAL"
            />
            {/* Shifts under the BAWAAL wordmark (right of the B emblem) */}
            <Text style={styles.arenaLabel}>ARENA</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightCol}>
          <LivePill onPress={onLivePress} liveCount={liveCount} />
          <GameOnPill onPress={onGameOnPress} />
          <TouchableOpacity
            onPress={onNotificationsPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.bellBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={WHITE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: BG,
    paddingLeft: 0,
    paddingRight: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 90, 0, 0.28)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandHit: {
    flexShrink: 1,
    maxWidth: '48%',
  },
  brandStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginLeft: 16,
  },
  combinedLogo: {
    height: 38,
    width: 190,
  },
  arenaLabel: {
    // Centered under "BAWAAL" wordmark in the 190px combined mark
    marginTop: 4,
    marginLeft: 72,
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    textAlign: 'left',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  liveWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: LIVE_CRIMSON,
    ...Platform.select({
      ios: {
        shadowColor: LIVE_CRIMSON,
        shadowOpacity: 0.85,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: LIVE_ORANGE,
        shadowOpacity: 0.7,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LIVE_CRIMSON,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.55)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: WHITE,
  },
  liveText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveBadge: {
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  liveBadgeText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
  },
  gameOnWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOnGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOpacity: 0.9,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: ACCENT,
        shadowOpacity: 0.75,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  gameOnPill: {
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  gameOnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.6,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});

export default memo(ArenaV2Header);
export { ACCENT as ARENA_V2_ACCENT, BG as ARENA_V2_BG };
