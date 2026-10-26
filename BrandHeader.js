import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const WHITE = '#FFFFFF';
const ACCENT = '#FF5722';
const MUTED = '#A0A0A0';

/**
 * Global brand header: optional hamburger (left drawer) + BAWAAL + screen subtitle.
 * Optional rightSlot aligns opposite the screen-name row (e.g. ARENA).
 */
export default function BrandHeader({
  screenName = 'ARENA',
  onBrandPress,
  onMenuPress = null,
  rightSlot = null,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.topRow}>
        {typeof onMenuPress === 'function' ? (
          <TouchableOpacity
            onPress={onMenuPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={styles.menuBtn}
          >
            <View style={styles.burgerLine} />
            <View style={[styles.burgerLine, styles.burgerLineMid]} />
            <View style={styles.burgerLine} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onBrandPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open profile gateway"
          hitSlop={{ top: 8, bottom: 4, left: 4, right: 8 }}
          style={styles.brandWrap}
        >
          <Text style={styles.brand}>BAWAAL</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.subRow}>
        <TouchableOpacity onPress={onBrandPress} activeOpacity={0.75}>
          <Text style={styles.screenName}>{String(screenName).toUpperCase()}</Text>
        </TouchableOpacity>
        {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 236, 233, 0.18)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 236, 233, 0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  burgerLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: WHITE,
  },
  burgerLineMid: {
    width: 12,
  },
  brandWrap: {
    flexShrink: 1,
  },
  brand: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    minHeight: 22,
  },
  screenName: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
    flexShrink: 1,
  },
});

export const BRAND = { BG, WHITE, ACCENT, MUTED, CARD: '#121212' };
