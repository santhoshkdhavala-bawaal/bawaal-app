/**
 * Instagram-style floating mute / unmute control.
 * Uses BAWAAL megaphone assets: bmute.png / bunmute.png.
 * Neon-white glow chip — readable on any video background.
 */
import React, { memo } from 'react';
import { Pressable, Image, StyleSheet, Platform } from 'react-native';

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
        // Force crisp bright white against dark glass chip
        tintColor="#FFFFFF"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // iOS neon white glow
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    // Android glow
    elevation: 6,
    ...Platform.select({
      android: {
        // elevation alone is gray — reinforce edge with border
        borderColor: 'rgba(255,255,255,0.95)',
      },
      default: {},
    }),
  },
  btnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF',
  },
});

export default memo(MuteToggleButton);
