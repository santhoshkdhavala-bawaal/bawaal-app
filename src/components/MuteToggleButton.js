/**
 * LOCKED — top-right flat mute / unmute (BAWAAL orange, no backdrop).
 * Geometry from `src/constants/arenaReelOverlay.js`.
 */
import React, { memo } from 'react';
import { Pressable, Image, StyleSheet } from 'react-native';
import {
  BAWAAL_ORANGE,
  REEL_MUTE,
} from '../constants/arenaReelOverlay';

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
    width: REEL_MUTE.width,
    height: REEL_MUTE.height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    zIndex: REEL_MUTE.zIndex,
  },
  hitPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: REEL_MUTE.iconSize,
    height: REEL_MUTE.iconSize,
    tintColor: BAWAAL_ORANGE,
  },
});

export default memo(MuteToggleButton);
