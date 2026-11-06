/**
 * Minimal expo-video player for Arena feed clips.
 * Source URI is the post video URL string — expo-video rebinds via replaceAsync.
 * Native controls own play / pause / scrub. A centered play glyph shows when paused.
 * Speed / slow-mo stay on publish preview only.
 * Pauses + soft-releases the native player on unmount.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveVideoSource } from '../utils/reelMediaFallback';
import { safeReleaseExpoVideoPlayer } from '../utils/safeUnloadVideo';

function SafeVideoPlayer({
  uri,
  muted = true,
  loop = true,
  style,
  contentFit = 'cover',
  autoPlay = true,
  /** Arena card: show the centered play glyph while paused. */
  tapToToggle = true,
  onError,
  onLongPress,
}) {
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!!autoPlay);
  const longPressTimer = useRef(null);
  /** String URI so useVideoPlayer's source key tracks the post URL. */
  const playbackUri = useMemo(() => {
    const resolved = resolveVideoSource(uri);
    return resolved?.uri || null;
  }, [uri]);

  const player = useVideoPlayer(playbackUri, (p) => {
    try {
      p.loop = loop !== false;
      p.muted = !!muted;
      p.playbackRate = 1.0;
      if (autoPlay && playbackUri) p.play();
      else p.pause();
    } catch {
      /* ignore setup races */
    }
  });

  useEffect(() => {
    setFailed(false);
    setIsPlaying(!!autoPlay);
  }, [playbackUri, autoPlay]);

  useEffect(() => {
    if (!player) return undefined;
    try {
      player.muted = !!muted;
      player.loop = loop !== false;
      if (!playbackUri || !autoPlay) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (err) {
      // Keep the surface mounted — a play/pause race must not blank the cell.
      console.warn('[SafeVideoPlayer] sync failed:', err?.message || err);
    }
    return undefined;
  }, [player, muted, loop, playbackUri, autoPlay]);

  useEffect(() => {
    if (!player) return undefined;
    let statusSub = null;
    let playingSub = null;
    try {
      statusSub = player.addListener?.('statusChange', ({ status, error }) => {
        try {
          if (status === 'error' || error) {
            console.warn(
              '[SafeVideoPlayer] status error:',
              error?.message || error
            );
            setFailed(true);
            onError?.(error);
          }
        } catch (_) {
          /* never crash native path */
        }
      });
      playingSub = player.addListener?.(
        'playingChange',
        ({ isPlaying: next }) => {
          try {
            setIsPlaying(!!next);
          } catch (_) {
            /* ignore */
          }
        }
      );
    } catch (_) {
      /* older expo-video without events */
    }
    return () => {
      try {
        statusSub?.remove?.();
      } catch (_) {
        /* ignore */
      }
      try {
        playingSub?.remove?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [player, onError]);

  useEffect(() => {
    return () => {
      if (player) {
        try {
          player.pause();
        } catch (_) {
          /* ignore */
        }
        safeReleaseExpoVideoPlayer(player);
      }
    };
  }, [player]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const onVideoTouchStart = useCallback(() => {
    if (!onLongPress) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      try {
        onLongPress();
      } catch (err) {
        console.warn('[SafeVideoPlayer] long-press failed:', err?.message || err);
      }
    }, 450);
  }, [clearLongPress, onLongPress]);

  if (!playbackUri || failed) {
    return <View style={[styles.shell, style]} />;
  }

  return (
    <View
      style={[styles.shell, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={isPlaying ? 'Pause clip' : 'Play clip'}
      onTouchStart={onVideoTouchStart}
      onTouchMove={clearLongPress}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <View style={styles.underlay} pointerEvents="none" />
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
        nativeControls
        fullscreenOptions={{ enable: false }}
      />
      {tapToToggle && !isPlaying ? (
        <View style={styles.playIconOverlay} pointerEvents="none">
          <Ionicons name="play" size={50} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});

export default memo(SafeVideoPlayer);
export { SafeVideoPlayer };
