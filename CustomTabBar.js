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
 * Bold labels lifted off the bottom edge for clear black/white contrast.
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
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
              <Text
                style={[
                  styles.tabLabel,
                  active && styles.tabLabelActive,
                ]}
              >
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
    borderTopWidth: 1.5,
    borderTopColor: BORDER_TOP,
    paddingTop: 12,
    paddingHorizontal: 2,
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
    paddingTop: 6,
    paddingBottom: 6,
    minHeight: 58,
  },
  battlesTabItem: {
    marginRight: 6,
    paddingRight: 4,
    maxWidth: 84,
  },
  tabLabelWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  battlesLabelWrap: {
    minHeight: 38,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 2,
  },
  tabLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 14,
    textTransform: 'uppercase',
    ...(Platform.OS === 'android' ? { fontFamily: 'sans-serif-black' } : null),
  },
  tabLabelActive: {
    color: WHITE,
    fontSize: 12,
    letterSpacing: 1.1,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
    marginTop: 5,
  },
  tabDotSpacer: {
    width: 5,
    height: 5,
    marginTop: 5,
  },
  fabWrap: {
    width: 78,
    alignItems: 'center',
    marginTop: -22,
    marginHorizontal: 4,
    zIndex: 2,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: WHITE,
    borderWidth: 2.5,
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
    fontSize: 38,
    fontWeight: '900',
    marginTop: -2,
    lineHeight: 40,
  },
  fabCaption: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 5,
  },
  thunderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: OBSIDIAN,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    alignSelf: 'center',
  },
  thunderSpacer: {
    width: 20,
    height: 20,
    marginBottom: 2,
  },
  thunderText: {
    fontSize: 11,
    marginTop: -1,
  },
});
