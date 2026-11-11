import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const WHITE = '#FFFFFF';
const ACCENT = '#FF5722';
const MUTED = '#A0A0A0';

/** Orange brand mark (asset file name kept; file is the orange logo). */
const BAWAAL_LOGO = require('./assets/BAWAAL_white_full.png');

/**
 * Global brand header: BAWAAL + screen subtitle.
 * Optional rightSlot aligns opposite the screen-name row.
 * Pass `useLogo` to render the orange logo image instead of white wordmark text.
 */
export default function BrandHeader({
  screenName = 'ARENA',
  onBrandPress,
  rightSlot = null,
  useLogo = false,
  logoSource = BAWAAL_LOGO,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onBrandPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open profile gateway"
          hitSlop={{ top: 8, bottom: 4, left: 4, right: 8 }}
          style={styles.brandWrap}
        >
          {useLogo ? (
            <Image
              source={logoSource}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="BAWAAL"
            />
          ) : (
            <Text style={styles.brand}>BAWAAL</Text>
          )}
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
  brandLogo: {
    width: 148,
    height: 32,
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
