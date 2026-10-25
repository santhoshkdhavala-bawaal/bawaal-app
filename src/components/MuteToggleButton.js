/**
 * Floating mute / unmute — icon only (no circle/box).
 * White megaphone + crisp black drop shadow over any video frame.
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
      {/* Transparent host only — never a filled circle / bubble */}
      <View style={styles.shadowHost}>
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
  shadowHost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    ...Platform.select({
      android: {
        elevation: 6,
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
