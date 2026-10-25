/**
 * Instagram-style floating mute / unmute control.
 * Uses BAWAAL megaphone assets: bmute.png / bunmute.png.
 */
import React, { memo } from 'react';
import { Pressable, Image, StyleSheet } from 'react-native';

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
        styles.btn,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      <Image
        source={muted ? ICON_MUTED : ICON_UNMUTED}
        style={styles.icon}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: 22,
    height: 22,
  },
});

export default memo(MuteToggleButton);
