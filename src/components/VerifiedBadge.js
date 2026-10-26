/**
 * Official BAWAAL Verified badge — electric blue rounded square with bold "B".
 * Replaces any standard checkmark / blue tick. Accent-only color against B&W UI.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Electric blue — primary verification accent */
export const VERIFIED_BLUE = '#00E5FF';

/**
 * @param {{ size?: number, style?: object, letterColor?: string }} props
 */
function VerifiedBadge({ size = 14, style, letterColor = '#000000' }) {
  const dim = Math.max(12, size);
  const radius = Math.max(3, Math.round(dim * 0.28));
  const fontSize = Math.max(8, dim * 0.62);

  return (
    <View
      accessibilityLabel="BAWAAL Verified"
      accessibilityRole="image"
      style={[
        styles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.letter,
          {
            color: letterColor,
            fontSize,
            lineHeight: dim,
          },
        ]}
        allowFontScaling={false}
      >
        B
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: VERIFIED_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Keeps badge optically centered next to @handle text
    marginTop: 1,
  },
  letter: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: 0,
  },
});

export default memo(VerifiedBadge);
