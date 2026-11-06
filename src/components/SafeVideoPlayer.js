/**
 * Arena clip surface.
 * isMounted keeps the expo-video view in the tree so the clip stays buffered.
 * shouldPlay only calls play/pause — it does not unmount the player or reset position.
 * Rows outside the preload window render a poster and release the decoder.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
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
  onError,
  onLongPress,
}) {
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!!shouldPlay);
  const playerRef = useRef(null);
  const userPausedRef = useRef(false);
  const wasShouldPlayRef = useRef(false);
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
  }, [resolvedUri]);

  useEffect(() => {
    if (!player) return undefined;
    try {
      player.muted = !!muted;
      player.loop = true;
      if (loop === false) player.loop = false;
      if (shouldPlay && !wasShouldPlayRef.current) userPausedRef.current = false;
      wasShouldPlayRef.current = !!shouldPlay;
      if (shouldPlay && !userPausedRef.current) {
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
          }
          if (status === 'error' || error) {
            console.log('[Video Error]:', error);
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
            console.log('[Video Status]:', next ? 'playing' : 'paused');
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
    const activePlayer = player;
    return () => {
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

  const togglePlayback = useCallback(() => {
    if (!player || !shouldPlay) return;
    try {
      if (player.playing) {
        userPausedRef.current = true;
        pauseClip(player);
        setIsPlaying(false);
      } else {
        userPausedRef.current = false;
        playClip(player);
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('[SafeVideoPlayer] toggle failed:', err?.message || err);
    }
  }, [player, shouldPlay]);

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
    <TouchableWithoutFeedback
      onPress={togglePlayback}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause clip' : 'Play clip'}
    >
      <View style={[styles.shell, style]}>
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
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          pointerEvents="none"
        />
      </View>
    </TouchableWithoutFeedback>
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
      onError={onError}
      onLongPress={onLongPress}
    />
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
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
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
