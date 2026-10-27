import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';

const OBSIDIAN = '#000000';
const OFF_WHITE = '#E8ECE9';
const WHITE = '#FFFFFF';
const ACCENT = '#FFFFFF';
const BORDER_TOP = '#2A2A2A';
const MUTED = '#A0A0A0';

const TABS = [
  { key: 'Arena', label: 'ARENA' },
  { key: 'Battles', label: 'BATTLES' },
  { key: 'Create', label: '+ BATTLE', isFab: true },
  { key: 'Locker', label: 'LOCKER\nROOM' },
  { key: 'Passport', label: 'PASSPORT' },
];

/**
 * 5-tab bar: ARENA · BATTLES · + BATTLE · LOCKER ROOM · PASSPORT
 * Full-width row with even spacing; FAB floats without squishing side tabs.
 */
export default function CustomTabBar({
  activeTab,
  onTabPress,
  onCreatePress,
  bottomPad = 16,
  challengeAlertActive = false,
}) {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!challengeAlertActive) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.22, duration: 480, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [challengeAlertActive, pulse]);

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
      {TABS.map((item) => {
        if (item.isFab) {
          return (
            <View key={item.key} style={styles.fabSlot}>
              <TouchableOpacity
                style={styles.fabWrap}
                onPress={onCreatePress}
                activeOpacity={0.85}
                accessibilityLabel="Create battle"
              >
                <View style={styles.fab}>
                  <Text style={styles.fabPlus}>+</Text>
                </View>
                <Text style={styles.fabCaption} numberOfLines={1}>
                  BATTLE
                </Text>
              </TouchableOpacity>
            </View>
          );
        }

        const active = activeTab === item.key;
        const isBattles = item.key === 'Battles';
        const isPassport = item.key === 'Passport';
        const isLocker = item.key === 'Locker';
        const showThunder = isBattles && challengeAlertActive;

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.tabItem}
            onPress={() => onTabPress(item.key)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
          >
            <View style={styles.tabLabelWrap}>
              {showThunder ? (
                <Animated.View
                  style={[styles.thunderBadge, { transform: [{ scale: pulse }] }]}
                >
                  <Text style={styles.thunderText}>⚡</Text>
                </Animated.View>
              ) : isBattles ? (
                <View style={styles.thunderSpacer} />
              ) : null}
              <Text
                numberOfLines={isLocker ? 2 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {isPassport ? 'PASSPORT' : item.label}
              </Text>
            </View>
            {active ? <View style={styles.tabDot} /> : <View style={styles.tabDotSpacer} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: OBSIDIAN,
    borderTopWidth: 1.5,
    borderTopColor: BORDER_TOP,
    paddingTop: 10,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -3 },
      },
      android: { elevation: 12 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 2,
    minHeight: 52,
    minWidth: 0,
  },
  tabLabelWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: 1,
  },
  tabLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
    lineHeight: 11,
    textTransform: 'uppercase',
    width: '100%',
    ...(Platform.OS === 'android' ? { fontFamily: 'sans-serif-medium' } : null),
  },
  tabLabelActive: {
    color: WHITE,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 4,
  },
  tabDotSpacer: {
    width: 4,
    height: 4,
    marginTop: 4,
  },
  /** Fixed center slot so FAB never steals flex from side tabs */
  fabSlot: {
    width: 68,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fabWrap: {
    width: 68,
    alignItems: 'center',
    marginTop: -20,
    zIndex: 2,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: WHITE,
    borderWidth: 2,
    borderColor: OFF_WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 10 },
    }),
  },
  fabPlus: {
    color: '#000000',
    fontSize: 34,
    fontWeight: '900',
    marginTop: -2,
    lineHeight: 36,
  },
  fabCaption: {
    color: WHITE,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  thunderBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: OBSIDIAN,
    borderWidth: 1.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    alignSelf: 'center',
  },
  thunderSpacer: {
    width: 16,
    height: 16,
    marginBottom: 1,
  },
  thunderText: {
    fontSize: 9,
    marginTop: -1,
  },
});
