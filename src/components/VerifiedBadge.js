/**
 * Official BAWAAL verification tick ("blue tick").
 * Electric blue only — chrome stays monochrome.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Striking electric blue against B&W UI */
export const VERIFIED_BLUE = '#0095F6';

function VerifiedBadge({ size = 14, style }) {
  const dim = Math.max(10, size);
  return (
    <View
      accessibilityLabel="Verified account"
      accessibilityRole="image"
      style={[
        styles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.check, { fontSize: dim * 0.62, lineHeight: dim }]}>
        ✓
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: VERIFIED_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default memo(VerifiedBadge);
