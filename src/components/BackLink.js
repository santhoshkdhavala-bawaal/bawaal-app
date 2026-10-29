/**
 * High-visibility back affordance for stealth-black screens.
 * Electric blue by default; pass `accent` for modal/theme tints (e.g. Clinic mint).
 */
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const BACK_ACCENT = '#3B82F6';

function BackLink({
  label = 'Back',
  onPress,
  style,
  textStyle,
  accent = BACK_ACCENT,
  hitSlop = 12,
}) {
  const color = accent || BACK_ACCENT;
  const display = String(label || 'Back').trim();
  const withArrow = display.startsWith('←') ? display : `← ${display}`;
  const chipFill =
    color === BACK_ACCENT ? 'rgba(59, 130, 246, 0.14)' : `${color}22`;

  return (
    <TouchableOpacity
      style={[styles.hit, style]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={
        typeof hitSlop === 'number'
          ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
          : hitSlop
      }
      accessibilityRole="button"
      accessibilityLabel={withArrow.replace(/^←\s*/, '')}
    >
      <View style={[styles.chip, { borderColor: color, backgroundColor: chipFill }]}>
        <Text style={[styles.text, { color }, textStyle]}>{withArrow}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'flex-start',
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

export default memo(BackLink);
