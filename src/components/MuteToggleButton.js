/**
 * Floating mute / unmute — top-right video overlay, flat BAWAAL orange icon.
 */
import React, { memo } from 'react';
import { Pressable, Image, StyleSheet } from 'react-native';

const BAWAAL_ORANGE = '#FF5500';
const ICON_MUTED = require('../../assets/bmute.png');
const ICON_UNMUTED = require('../../assets/bunmute.png');

function MuteToggleButton({ muted, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
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
        tintColor={BAWAAL_ORANGE}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    zIndex: 99,
  },
  hitPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: BAWAAL_ORANGE,
  },
});

export default memo(MuteToggleButton);
