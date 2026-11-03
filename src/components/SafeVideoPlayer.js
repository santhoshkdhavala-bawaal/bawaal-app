/**
 * Minimal expo-video player for Arena feed clips.
 * Tap toggles play/pause with a centered play glyph when paused.
 * Speed / slow-mo stay on publish preview only.
 * Pauses + soft-releases the native player on unmount.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { isUsablePlaybackUri } from '../utils/reelMediaFallback';
import { safeReleaseExpoVideoPlayer } from '../utils/safeUnloadVideo';

function SafeVideoPlayer({
  uri,
  muted = true,
  loop = true,
  style,
  contentFit = 'cover',
  autoPlay = true,
  /** Arena card: tap video to play/pause. */
  tapToToggle = true,
  onError,
  onLongPress,
}) {
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!!autoPlay);
  const source = useMemo(() => {
    if (!isUsablePlaybackUri(uri)) return null;
    return { uri: String(uri).trim() };
  }, [uri]);

  const player = useVideoPlayer(source, (p) => {
    try {
      p.loop = loop !== false;
      p.muted = !!muted;
      p.playbackRate = 1.0;
      if (autoPlay) p.play();
      else p.pause();
    } catch {
      /* ignore setup races */
    }
  });

  useEffect(() => {
    setFailed(false);
    setIsPlaying(!!autoPlay);
  }, [uri, autoPlay]);

  useEffect(() => {
    if (!player || !source) return undefined;
    try {
      player.muted = !!muted;
      player.loop = loop !== false;
      if (autoPlay) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('[SafeVideoPlayer] sync failed:', err?.message || err);
      setFailed(true);
      onError?.(err);
    }
    return undefined;
  }, [player, muted, loop, source, autoPlay, onError]);

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

  const togglePlayback = useCallback(() => {
    if (!player) return;
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('[SafeVideoPlayer] toggle failed:', err?.message || err);
    }
  }, [player]);

  if (!source || failed) {
    return <View style={[styles.shell, style]} />;
  }

  const body = (
    <>
      <View style={styles.underlay} pointerEvents="none" />
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        pointerEvents="none"
      />
      {tapToToggle && !isPlaying ? (
        <View style={styles.playIconOverlay} pointerEvents="none">
          <Ionicons name="play" size={50} color="#FFFFFF" />
        </View>
      ) : null}
    </>
  );

  if (!tapToToggle) {
    return <View style={[styles.shell, style]}>{body}</View>;
  }

  return (
    <Pressable
      style={[styles.shell, style]}
      onPress={togglePlayback}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause clip' : 'Play clip'}
    >
      {body}
    </Pressable>
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
