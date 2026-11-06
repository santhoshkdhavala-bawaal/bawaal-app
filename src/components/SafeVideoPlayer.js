/**
 * Arena clip surface.
 * isMounted keeps the expo-video view in the tree so the clip stays buffered.
 * shouldPlay only calls play/pause — it does not unmount the player or reset position.
 * Rows outside the preload window render a poster and release the decoder.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, Text, View } from 'react-native';
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

function posterUriFrom(item) {
  return firstPlayableUri([
    item?.thumbnail_url,
    item?.poster,
    item?.poster_url,
    item?.thumbnailUrl,
    item?.posterUrl,
  ]);
}

function playClip(player) {
  if (!player) return;
  if (typeof player.playAsync === 'function') {
    player.playAsync();
    return;
  }
  player.play();
}

function pauseClip(player) {
  if (!player) return;
  if (typeof player.pauseAsync === 'function') {
    player.pauseAsync();
    return;
  }
  player.pause();
}

/** Decoder lives here so leaving the screen unmounts it immediately. */
function ActiveClipPlayer({
  resolvedUri,
  posterUri = null,
  muted,
  loop,
  shouldPlay = true,
  style,
  contentFit,
  tapToToggle,
  onError,
  onLongPress,
}) {
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!!shouldPlay);
  const longPressTimer = useRef(null);
  const playerRef = useRef(null);
  const source = useMemo(() => ({ uri: resolvedUri }), [resolvedUri]);

  const player = useVideoPlayer(source, (p) => {
    try {
      p.loop = true;
      p.muted = !!muted;
      p.playbackRate = 1.0;
      if (shouldPlay && source?.uri) playClip(p);
      else pauseClip(p);
    } catch {
      /* ignore setup races */
    }
  });
  playerRef.current = player;

  useEffect(() => {
    console.log('[Video URI]:', resolvedUri);
  }, [resolvedUri]);

  useEffect(() => {
    setFailed(false);
    setBuffering(true);
    setHasFrame(false);
  }, [resolvedUri]);

  useEffect(() => {
    if (!player) return undefined;
    try {
      player.muted = !!muted;
      player.loop = true;
      if (loop === false) player.loop = false;
      if (shouldPlay) {
        playClip(player);
        setIsPlaying(true);
      } else {
        pauseClip(player);
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('[SafeVideoPlayer] sync failed:', err?.message || err);
    }
    return undefined;
  }, [player, muted, loop, shouldPlay]);

  useEffect(() => {
    if (!player) return undefined;
    let statusSub = null;
    let playingSub = null;
    try {
      statusSub = player.addListener?.('statusChange', ({ status, error }) => {
        try {
          console.log('[Video Status]:', status);
          if (status === 'loading') {
            console.log('[Video Status]:', 'buffering');
            setBuffering(true);
          }
          if (status === 'readyToPlay') setBuffering(false);
          if (status === 'error' || error) {
            console.log('[Video Error]:', error);
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
            console.log('[Video Status]:', next ? 'playing' : 'paused');
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
        pauseClip(activePlayer);
      } catch (_) {
        /* ignore */
      }
      safeReleaseExpoVideoPlayer(activePlayer);
    };
  }, [player]);

  useEffect(() => {
    if (!resolvedUri) return undefined;
    const timer = setTimeout(() => {
      const status = playerRef.current?.status;
      if (status === 'loading' || status === 'idle') {
        console.log(
          '[Video Error]:',
          new Error(`Video stream timed out for ${resolvedUri}`)
        );
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [resolvedUri]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const activePlayer = playerRef.current;
      if (!activePlayer) return;
      if (next === 'active') return;
      try {
        pauseClip(activePlayer);
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
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={styles.video}
          resizeMode="cover"
        />
      ) : null}
      <VideoView
        style={styles.video}
        player={player}
        contentFit={contentFit}
        nativeControls={true}
        fullscreenOptions={{ enable: false }}
        onFirstFrameRender={() => {
          try {
            setHasFrame(true);
            setBuffering(false);
          } catch (_) {
            /* ignore */
          }
        }}
      />
      {buffering && !hasFrame ? (
        <View style={styles.fallback} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.fallbackDetail}>LOADING</Text>
        </View>
      ) : null}
      {tapToToggle && shouldPlay && !isPlaying ? (
        <View style={styles.playIconOverlay} pointerEvents="none">
          <Ionicons name="play" size={50} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

function HiddenClipFrame({ style, posterUri }) {
  const [broken, setBroken] = useState(false);
  const showPoster = !!posterUri && !broken;
  return (
    <View style={[styles.shell, style]}>
      <View style={styles.underlay} pointerEvents="none" />
      {showPoster ? (
        <Image
          source={{ uri: posterUri }}
          style={styles.video}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      ) : null}
    </View>
  );
}

function SafeVideoPlayer({
  isVisible = true,
  shouldPlay,
  isMounted,
  item = null,
  uri,
  muted = true,
  loop = true,
  style,
  contentFit = 'cover',
  /** Arena card: show the centered play glyph while paused. */
  tapToToggle = true,
  onError,
  onLongPress,
}) {
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
  const posterUri = useMemo(
    () => posterUriFrom(item),
    [
      item?.thumbnail_url,
      item?.poster,
      item?.poster_url,
      item?.thumbnailUrl,
      item?.posterUrl,
    ]
  );

  const mounted = isMounted != null ? !!isMounted : !!isVisible;
  const playing = shouldPlay != null ? !!shouldPlay : !!isVisible;

  if (!mounted) {
    return <HiddenClipFrame style={style} posterUri={posterUri} />;
  }

  if (!resolvedUri) {
    return (
      <ClipStatus
        style={style}
        title="CLIP UNAVAILABLE"
        detail="No playable video URL"
      />
    );
  }

  return (
    <ActiveClipPlayer
      resolvedUri={resolvedUri}
      posterUri={posterUri}
      muted={muted}
      loop={loop !== false}
      shouldPlay={playing}
      style={style}
      contentFit={contentFit}
      tapToToggle={tapToToggle}
      onError={onError}
      onLongPress={onLongPress}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: 450,
    alignSelf: 'stretch',
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
