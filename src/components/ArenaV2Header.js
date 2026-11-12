/**
 * V2 Arena top header — B mark + wordmark, ARENA label,
 * glowing ▶ GAME ON pill, notification bell.
 */
import React, { useEffect, useRef, memo } from 'react';
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
const MUTED = '#A9A9A9';

const B_LOGO = require('../../assets/BAWAAL_B_solo.png');
const WORDMARK = require('../../assets/BAWAAL_text.png');

function GameOnPill({ onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;

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
          style={styles.brandCol}
        >
          <View style={styles.logoRow}>
            <Image
              source={B_LOGO}
              style={styles.bLogo}
              resizeMode="contain"
              accessibilityLabel="BAWAAL B"
            />
            <Image
              source={WORDMARK}
              style={styles.wordmark}
              resizeMode="contain"
              accessibilityLabel="BAWAAL"
            />
          </View>
          <Text style={styles.arenaLabel}>ARENA</Text>
        </TouchableOpacity>

        <View style={styles.rightCol}>
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
    paddingHorizontal: 14,
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
  brandCol: {
    flexShrink: 1,
    maxWidth: '54%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bLogo: {
    width: 40,
    height: 40,
  },
  wordmark: {
    width: 148,
    height: 30,
  },
  arenaLabel: {
    marginTop: 6,
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
