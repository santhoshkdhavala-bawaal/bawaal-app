import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';

const OBSIDIAN = '#000000';
const OFF_WHITE = '#E8ECE9';
const WHITE = '#FFFFFF';
const ACCENT = '#FFFFFF';
const BORDER_TOP = '#1A1A1A';
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
 * Pulsing ⚡ sits centered above BATTLES — never overlaps the FAB.
 */
export default function CustomTabBar({
  activeTab,
  onTabPress,
  onCreatePress,
  bottomPad = 8,
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
            <TouchableOpacity
              key={item.key}
              style={styles.fabWrap}
              onPress={onCreatePress}
              activeOpacity={0.85}
              accessibilityLabel="Create battle"
            >
              <View style={styles.fab}>
                <Text style={styles.fabPlus}>+</Text>
              </View>
              <Text style={styles.fabCaption}>BATTLE</Text>
            </TouchableOpacity>
          );
        }
        const active = activeTab === item.key;
        const isBattles = item.key === 'Battles';
        const showThunder = isBattles && challengeAlertActive;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.tabItem, isBattles && styles.battlesTabItem]}
            onPress={() => onTabPress(item.key)}
            activeOpacity={0.8}
          >
            <View style={[styles.tabLabelWrap, isBattles && styles.battlesLabelWrap]}>
              {showThunder ? (
                <Animated.View
                  style={[styles.thunderBadge, { transform: [{ scale: pulse }] }]}
                >
                  <Text style={styles.thunderText}>⚡</Text>
                </Animated.View>
              ) : isBattles ? (
                <View style={styles.thunderSpacer} />
              ) : null}
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: OBSIDIAN,
    borderTopWidth: 1,
    borderTopColor: BORDER_TOP,
    paddingTop: 10,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -2 },
      },
      android: { elevation: 10 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    minHeight: 52,
  },
  battlesTabItem: {
    marginRight: 6,
    paddingRight: 4,
    maxWidth: 78,
  },
  tabLabelWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  battlesLabelWrap: {
    minHeight: 34,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 2,
  },
  tabLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 12,
  },
  tabLabelActive: {
    color: OFF_WHITE,
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
  fabWrap: {
    width: 74,
    alignItems: 'center',
    marginTop: -18,
    marginHorizontal: 4,
    zIndex: 2,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 8 },
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
    color: OFF_WHITE,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  thunderBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: OBSIDIAN,
    borderWidth: 1.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    alignSelf: 'center',
  },
  thunderSpacer: {
    width: 18,
    height: 18,
    marginBottom: 2,
  },
  thunderText: {
    fontSize: 10,
    marginTop: -1,
  },
});
