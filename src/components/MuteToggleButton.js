/**
 * Floating mute / unmute — icon only (no circle/box).
 * BAWAAL megaphone assets with neon-white glow for any video background.
 */
import React, { memo } from 'react';
import { Pressable, View, Image, StyleSheet, Platform } from 'react-native';

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
      {/* Transparent glow host — no fill/border/circle; shadow needs a View on Android */}
      <View style={styles.glow}>
        <Image
          source={muted ? ICON_MUTED : ICON_UNMUTED}
          style={styles.icon}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />
      </View>
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
  glow: {
    backgroundColor: 'transparent',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    ...Platform.select({
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  icon: {
    width: 28,
    height: 28,
    tintColor: '#FFFFFF',
  },
});

export default memo(MuteToggleButton);
