/**
 * Floating mute / unmute — top-left video overlay, BAWAAL orange.
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
      hitSlop={10}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: BAWAAL_ORANGE,
    borderRadius: 18,
    zIndex: 99,
  },
  hitPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: 22,
    height: 22,
    tintColor: BAWAAL_ORANGE,
  },
});

export default memo(MuteToggleButton);
