/**
 * Minimal expo-video player for Arena feed clips.
 * No review chrome (play/pause/slow-mo stay on publish preview only).
 * Pauses + soft-releases the native player on unmount.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  onError,
}) {
  const [failed, setFailed] = useState(false);
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
  }, [uri]);

  useEffect(() => {
    if (!player || !source) return undefined;
    try {
      player.muted = !!muted;
      player.loop = loop !== false;
      if (autoPlay) player.play();
      else player.pause();
    } catch (err) {
      console.warn('[SafeVideoPlayer] sync failed:', err?.message || err);
      setFailed(true);
      onError?.(err);
    }
    return undefined;
  }, [player, muted, loop, source, autoPlay, onError]);

  useEffect(() => {
    if (!player) return undefined;
    let sub = null;
    try {
      sub = player.addListener?.('statusChange', ({ status, error }) => {
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
    } catch (_) {
      /* older expo-video without events */
    }
    return () => {
      try {
        sub?.remove?.();
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

  if (!source || failed) {
    return <View style={[styles.shell, style]} />;
  }

  return (
    <View style={[styles.shell, style]}>
      <View style={styles.underlay} pointerEvents="none" />
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        pointerEvents="none"
      />
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
});

export default memo(SafeVideoPlayer);
export { SafeVideoPlayer };
