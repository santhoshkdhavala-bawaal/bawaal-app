/**
 * Metro stub for `expo-av` while bundling for Expo Go / web without native AV.
 * - Web: real HTML5 <video> for https / blob / http URIs (Arena CLIP READY → playable).
 * - Native Expo Go: labeled slate (no ExponentAV).
 */
import React, { createElement, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

function resolveSourceUri(source) {
  if (source == null) return null;
  if (typeof source === 'string' && source.trim()) return source.trim();
  if (typeof source === 'object') {
    if (typeof source.uri === 'string' && source.uri.trim()) {
      return source.uri.trim();
    }
    if (typeof source.url === 'string' && source.url.trim()) {
      return source.url.trim();
    }
  }
  return null;
}

function WebHtml5Video({
  style,
  source,
  shouldPlay = false,
  isLooping = false,
  isMuted,
  useNativeControls,
  controls,
  resizeMode,
  onError,
  children,
  ...rest
}) {
  const videoRef = useRef(null);
  const uri = resolveSourceUri(source);
  // Always interactive on web unless explicitly disabled
  const showControls =
    controls === true ||
    useNativeControls === true ||
    (controls !== false && useNativeControls !== false);
  // Default muted on autoplay to satisfy browser policies; controls let the user unmute.
  const muted = typeof isMuted === 'boolean' ? isMuted : !!shouldPlay;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !uri) return undefined;
    try {
      if (shouldPlay) {
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            console.warn('[expo-av stub] web autoplay blocked:', err?.message || err);
          });
        }
      } else {
        el.pause();
      }
    } catch (err) {
      console.warn('[expo-av stub] web play/pause failed:', err?.message || err);
    }
    return undefined;
  }, [shouldPlay, uri]);

  if (!uri) {
    return (
      <View style={[styles.shell, style]} accessibilityLabel="No video URI">
        <View style={styles.labelWrap}>
          <Text style={styles.label}>CLIP READY</Text>
          <Text style={styles.sub}>Waiting for video URL…</Text>
        </View>
        {children}
      </View>
    );
  }

  const objectFit =
    resizeMode === 'contain' || resizeMode === 'CONTAIN'
      ? 'contain'
      : resizeMode === 'stretch' || resizeMode === 'STRETCH'
        ? 'fill'
        : 'cover';

  return (
    <View style={[styles.shell, { backgroundColor: '#000' }, style]}>
      {createElement('video', {
        ref: videoRef,
        src: uri,
        controls: showControls === true,
        autoPlay: !!shouldPlay,
        loop: !!isLooping,
        muted,
        playsInline: true,
        preload: 'metadata',
        style: {
          width: '100%',
          height: '100%',
          objectFit,
          backgroundColor: '#000',
          display: 'block',
        },
        onError: (e) => {
          console.warn('[expo-av stub] HTML5 video error:', uri, e);
          try {
            onError?.(e);
          } catch (_) {
            /* ignore */
          }
        },
      })}
      {children}
    </View>
  );
}

function NativeExpoGoPlaceholder({ style, children, ...rest }) {
  return (
    <View
      {...rest}
      style={[styles.shell, style]}
      pointerEvents="none"
      accessibilityLabel="Video unavailable in Expo Go — use npm start (dev client)"
    >
      <View style={styles.labelWrap}>
        <Text style={styles.label}>CLIP READY</Text>
        <Text style={styles.sub}>Dev client required for playback</Text>
      </View>
      {children}
    </View>
  );
}

function MockVideo(props) {
  if (Platform.OS === 'web') {
    return <WebHtml5Video {...props} />;
  }
  return <NativeExpoGoPlaceholder {...props} />;
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
  shell: {
    backgroundColor: '#121212',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  label: {
    color: '#E8ECE9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  sub: {
    color: '#A0A0A0',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
