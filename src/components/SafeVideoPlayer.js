/**
 * Minimal expo-video player for Arena feed clips.
 * Binds item.video_url, then item.uri, then item.url (or the uri prop).
 * Native controls own play / pause / scrub. A centered play glyph shows when paused.
 * Speed / slow-mo stay on publish preview only.
 * Pauses and releases the native player on unmount and when the app backgrounds.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveVideoSource } from '../utils/reelMediaFallback';
import { safeReleaseExpoVideoPlayer } from '../utils/safeUnloadVideo';

function firstPlayableUri(candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const parsed = resolveVideoSource(candidate);
    if (parsed?.uri) return parsed.uri;
  }
  return null;
}

function ClipStatus({ style, title, detail, busy }) {
  return (
    <View style={[styles.shell, style]}>
      <View style={styles.underlay} pointerEvents="none" />
      <View style={styles.fallback} pointerEvents="none">
        {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
        <Text style={styles.fallbackTitle}>{title}</Text>
        {detail ? <Text style={styles.fallbackDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function SafeVideoPlayer({
  item = null,
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
  const [buffering, setBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(!!autoPlay);
  const longPressTimer = useRef(null);
  const playerRef = useRef(null);
  /**
   * Post URL first (video_url → uri → url), then the explicit uri prop.
   * resolveVideoSource drops mock, blob, and empty strings.
   */
  const resolvedUri = useMemo(
    () =>
      firstPlayableUri([
        item?.video_url,
        item?.uri,
        item?.url,
        uri,
        item?.videoUrl,
        item?.videoUri,
      ]),
    [item?.video_url, item?.uri, item?.url, item?.videoUrl, item?.videoUri, uri]
  );
  const source = useMemo(
    () => (resolvedUri ? { uri: resolvedUri } : null),
    [resolvedUri]
  );

  const player = useVideoPlayer(source, (p) => {
    try {
      p.loop = true;
      p.muted = !!muted;
      p.playbackRate = 1.0;
      if (autoPlay && source?.uri) p.play();
      else p.pause();
    } catch {
      /* ignore setup races */
    }
  });
  playerRef.current = player;

  useEffect(() => {
    setFailed(false);
    setBuffering(!!resolvedUri);
    setIsPlaying(!!autoPlay && !!resolvedUri);
  }, [resolvedUri, autoPlay]);

  useEffect(() => {
    if (!player) return undefined;
    try {
      player.muted = !!muted;
      player.loop = loop !== false;
      if (!resolvedUri || !autoPlay) {
        player.pause();
        setIsPlaying(false);
      } else if (!player.playing) {
        player.play();
        setIsPlaying(true);
      }
    } catch (err) {
      // Keep the surface mounted — a play/pause race must not blank the cell.
      console.warn('[SafeVideoPlayer] sync failed:', err?.message || err);
    }
    return undefined;
  }, [player, muted, loop, resolvedUri, autoPlay]);

  useEffect(() => {
    if (!player) return undefined;
    let statusSub = null;
    let playingSub = null;
    try {
      statusSub = player.addListener?.('statusChange', ({ status, error }) => {
        try {
          if (status === 'loading') setBuffering(true);
          if (status === 'readyToPlay') setBuffering(false);
          if (status === 'error' || error) {
            console.warn(
              '[SafeVideoPlayer] status error:',
              error?.message || error
            );
            setBuffering(false);
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
            if (next) setBuffering(false);
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
    const activePlayer = player;
    return () => {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      if (!activePlayer) return;
      try {
        activePlayer.pause();
      } catch (_) {
        /* ignore */
      }
      safeReleaseExpoVideoPlayer(activePlayer);
    };
  }, [player]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const activePlayer = playerRef.current;
      if (!activePlayer) return;
      if (next === 'active') return;
      try {
        activePlayer.pause();
      } catch (_) {
        /* ignore */
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

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

  if (!resolvedUri) {
    return (
      <ClipStatus
        style={style}
        title="CLIP UNAVAILABLE"
        detail="No playable video URL"
      />
    );
  }

  if (failed) {
    return (
      <ClipStatus
        style={style}
        title="PLAYBACK FAILED"
        detail="This clip could not be loaded"
      />
    );
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
        nativeControls={true}
        fullscreenOptions={{ enable: false }}
        onFirstFrameRender={() => {
          try {
            setBuffering(false);
          } catch (_) {
            /* ignore */
          }
        }}
      />
      {buffering ? (
        <View style={styles.fallback} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.fallbackDetail}>LOADING</Text>
        </View>
      ) : null}
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
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  fallbackDetail: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});

export default memo(SafeVideoPlayer);
export { SafeVideoPlayer };
