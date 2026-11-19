/**
 * Shared expo-video player for Arena / preview / camera review.
 * Replaces expo-av <Video> with VideoView + createVideoPlayer.
 * currentTime / duration / seek use seconds (expo-video), with ms shims
 * for legacy setPositionAsync / onPlaybackStatusUpdate callers.
 */
import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { createVideoPlayer, VideoView } from 'expo-video';
import { safeReleaseExpoVideoPlayer } from '../utils/safeUnloadVideo';

function resolveUri(source) {
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

function mapContentFit(contentFit, resizeMode) {
  const raw = contentFit || resizeMode;
  if (raw === 'contain' || raw === 'CONTAIN') return 'contain';
  if (raw === 'fill' || raw === 'stretch' || raw === 'STRETCH') return 'fill';
  return 'cover';
}

const BawaalExpoVideo = forwardRef(function BawaalExpoVideo(
  {
    source,
    uri: uriProp,
    style,
    shouldPlay = false,
    isLooping = true,
    isMuted = true,
    volume = null,
    contentFit,
    resizeMode,
    playbackRate = 1,
    rate,
    nativeControls = false,
    useNativeControls,
    allowsFullscreen = false,
    timeUpdateIntervalSec = 0.25,
    onLoadStart = null,
    onLoad = null,
    onReadyForDisplay = null,
    onError = null,
    onPlaybackStatusUpdate = null,
    children,
  },
  ref
) {
  const uri = useMemo(
    () => resolveUri(uriProp != null ? uriProp : source),
    [uriProp, source]
  );
  const playerRef = useRef(null);
  if (playerRef.current == null) {
    playerRef.current = createVideoPlayer(uri ? { uri } : null);
  }
  const player = playerRef.current;

  const showControls =
    nativeControls === true || useNativeControls === true;
  const fit = mapContentFit(contentFit, resizeMode);
  const effectiveRate =
    typeof rate === 'number' && Number.isFinite(rate)
      ? rate
      : typeof playbackRate === 'number' && Number.isFinite(playbackRate)
        ? playbackRate
        : 1;

  useImperativeHandle(
    ref,
    () => ({
      get player() {
        return player;
      },
      play: () => {
        try {
          player.play();
        } catch (_) {
          /* soft-fail */
        }
      },
      pause: () => {
        try {
          player.pause();
        } catch (_) {
          /* soft-fail */
        }
      },
      seekTo: (sec) => {
        try {
          player.currentTime = Math.max(0, Number(sec) || 0);
        } catch (_) {
          /* soft-fail */
        }
      },
      setRate: (nextRate) => {
        try {
          player.playbackRate = Number(nextRate) || 1;
        } catch (_) {
          /* soft-fail */
        }
      },
      /** Legacy expo-av shims (ms → seconds). */
      playAsync: async () => {
        player.play();
      },
      pauseAsync: async () => {
        player.pause();
      },
      stopAsync: async () => {
        try {
          player.pause();
          player.currentTime = 0;
        } catch (_) {
          /* soft-fail */
        }
      },
      unloadAsync: async () => {
        safeReleaseExpoVideoPlayer(player);
      },
      setPositionAsync: async (ms) => {
        player.currentTime = Math.max(0, (Number(ms) || 0) / 1000);
      },
      setRateAsync: async (nextRate) => {
        player.playbackRate = Number(nextRate) || 1;
      },
      setStatusAsync: async (status = {}) => {
        try {
          if (status.rate != null) {
            player.playbackRate = Number(status.rate) || 1;
          }
          if (status.positionMillis != null) {
            player.currentTime = Math.max(
              0,
              (Number(status.positionMillis) || 0) / 1000
            );
          }
          if (typeof status.isLooping === 'boolean') {
            player.loop = status.isLooping;
          }
          if (typeof status.isMuted === 'boolean') {
            player.muted = status.isMuted;
          }
          if (status.shouldPlay === true) player.play();
          if (status.shouldPlay === false) player.pause();
        } catch (_) {
          /* soft-fail */
        }
      },
    }),
    [player]
  );

  // Replace source when URI changes
  useEffect(() => {
    try {
      onLoadStart?.();
      if (uri) {
        player.replace({ uri });
      } else {
        player.replace(null);
      }
    } catch (err) {
      onError?.(err);
    }
  }, [uri, player, onLoadStart, onError]);

  // Sync declarative playback props
  useEffect(() => {
    try {
      player.loop = isLooping !== false;
    } catch (_) {
      /* soft-fail */
    }
  }, [isLooping, player]);

  useEffect(() => {
    try {
      player.muted = !!isMuted;
      if (typeof volume === 'number' && Number.isFinite(volume)) {
        player.volume = Math.max(0, Math.min(1, volume));
      } else {
        player.volume = isMuted ? 0 : 1;
      }
    } catch (_) {
      /* soft-fail */
    }
  }, [isMuted, volume, player]);

  useEffect(() => {
    try {
      player.playbackRate = effectiveRate;
    } catch (_) {
      /* soft-fail */
    }
  }, [effectiveRate, player]);

  useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch (_) {
      /* soft-fail */
    }
  }, [shouldPlay, uri, player]);

  // Status / time listeners (seconds natively; emit ms-compatible status for legacy)
  useEffect(() => {
    let statusSub;
    let timeSub;
    let playingSub;
    try {
      player.timeUpdateEventInterval = Math.max(
        0,
        Number(timeUpdateIntervalSec) || 0
      );
    } catch (_) {
      /* soft-fail */
    }

    const emitLegacyStatus = () => {
      if (!onPlaybackStatusUpdate) return;
      try {
        const duration = Number(player.duration) || 0;
        const currentTime = Number(player.currentTime) || 0;
        onPlaybackStatusUpdate({
          isLoaded: player.status === 'readyToPlay' || duration > 0,
          isPlaying: !!player.playing,
          isMuted: !!player.muted,
          isLooping: !!player.loop,
          rate: Number(player.playbackRate) || 1,
          positionMillis: Math.round(currentTime * 1000),
          durationMillis: Math.round(duration * 1000),
          currentTime,
          duration,
        });
      } catch (_) {
        /* soft-fail */
      }
    };

    try {
      statusSub = player.addListener('statusChange', ({ status, error }) => {
        if (status === 'readyToPlay') {
          try {
            onLoad?.({
              duration: player.duration,
              durationMillis: Math.round((Number(player.duration) || 0) * 1000),
            });
            onReadyForDisplay?.();
          } catch (_) {
            /* soft-fail */
          }
        }
        if (status === 'error' || error) {
          onError?.(error || { message: 'video status error' });
        }
        emitLegacyStatus();
      });
      timeSub = player.addListener('timeUpdate', () => {
        emitLegacyStatus();
      });
      playingSub = player.addListener('playingChange', () => {
        emitLegacyStatus();
      });
    } catch (err) {
      onError?.(err);
    }

    return () => {
      try {
        statusSub?.remove?.();
      } catch (_) {
        /* soft-fail */
      }
      try {
        timeSub?.remove?.();
      } catch (_) {
        /* soft-fail */
      }
      try {
        playingSub?.remove?.();
      } catch (_) {
        /* soft-fail */
      }
    };
  }, [
    player,
    onPlaybackStatusUpdate,
    onLoad,
    onReadyForDisplay,
    onError,
    timeUpdateIntervalSec,
  ]);

  // Release on unmount
  useEffect(() => {
    return () => {
      safeReleaseExpoVideoPlayer(player);
      playerRef.current = null;
    };
  }, [player]);

  if (!uri) {
    return <View style={[styles.shell, style]}>{children}</View>;
  }

  return (
    <View style={[styles.shell, style]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit={fit}
        nativeControls={showControls}
        fullscreenOptions={{ enable: !!allowsFullscreen }}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => {
          try {
            onReadyForDisplay?.();
          } catch (_) {
            /* soft-fail */
          }
        }}
      />
      {children}
    </View>
  );
});

BawaalExpoVideo.displayName = 'BawaalExpoVideo';

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
});

export default memo(BawaalExpoVideo);
export { resolveUri as resolveBawaalVideoUri, mapContentFit };
