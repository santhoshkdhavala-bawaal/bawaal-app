/**
 * Instagram-style floating mute / unmute control for feed & reel video.
 * Geometric speaker glyph (no emoji) — BAWAAL B&W.
 */
import React, { memo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

function SpeakerIcon({ muted }) {
  return (
    <View style={styles.iconRoot}>
      <View style={styles.cone} />
      <View style={styles.body} />
      {!muted ? (
        <>
          <View style={[styles.wave, styles.waveNear]} />
          <View style={[styles.wave, styles.waveFar]} />
        </>
      ) : (
        <View style={styles.muteSlash} />
      )}
    </View>
  );
}

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
      <SpeakerIcon muted={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  iconRoot: {
    width: 20,
    height: 16,
    justifyContent: 'center',
  },
  body: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 5,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  cone: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  wave: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 1.5,
    borderRadius: 10,
  },
  waveNear: {
    left: 12,
    top: 3,
    width: 4,
    height: 10,
  },
  waveFar: {
    left: 15,
    top: 1,
    width: 5,
    height: 14,
  },
  muteSlash: {
    position: 'absolute',
    left: 8,
    top: 1,
    width: 1.5,
    height: 14,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '35deg' }],
  },
});

export default memo(MuteToggleButton);
