/**
 * Floating mute / unmute — flat icon only (no circle, no drop shadow).
 */
import React, { memo } from 'react';
import { Pressable, Image, StyleSheet } from 'react-native';

const ICON_MUTED = require('../../assets/bmute.png');
const ICON_UNMUTED = require('../../assets/bunmute.png');

function MuteToggleButton({ muted, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
      style={({ pressed }) => [
        styles.hit,
        pressed && styles.hitPressed,
        style,
      ]}
    >
      <Image
        source={muted ? ICON_MUTED : ICON_UNMUTED}
        style={styles.icon}
        resizeMode="contain"
        tintColor="#FFFFFF"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  hitPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.92 }],
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: '#FFFFFF',
  },
});

export default memo(MuteToggleButton);
