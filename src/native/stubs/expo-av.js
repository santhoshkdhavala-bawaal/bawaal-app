/**
 * Metro stub for `expo-av` while bundling for Expo Go.
 * Prevents `Cannot find native module ExponentAV` by keeping the real
 * package out of the dependency graph.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

function MockVideo({ style, children, ...rest }) {
  return (
    <View
      {...rest}
      style={[styles.black, style]}
      pointerEvents="none"
      accessibilityLabel="Video unavailable in Expo Go"
    >
      {children}
    </View>
  );
}

MockVideo.displayName = 'StubExpoAvVideo';

export const Video = MockVideo;

export const ResizeMode = Object.freeze({
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
});

/** Minimal Audio surface — no native ExponentAV calls. */
export const Audio = Object.freeze({
  Sound: {
    createAsync: async () => ({
      sound: {
        playAsync: async () => {},
        pauseAsync: async () => {},
        stopAsync: async () => {},
        unloadAsync: async () => {},
        setStatusAsync: async () => {},
        getStatusAsync: async () => ({ isLoaded: false }),
      },
      status: { isLoaded: false },
    }),
  },
  setAudioModeAsync: async () => {},
  setIsEnabledAsync: async () => {},
});

export default {
  Video,
  ResizeMode,
  Audio,
};

const styles = StyleSheet.create({
  black: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
});
