/**
 * Crash-safe feed / reel video surface for BAWAAL (expo-video).
 * - Clean public Supabase URLs (.../object/public/bawaalvideos/...)
 * - Explicit 100% sized wrapper (Android black-surface fix)
 * - textureView on Android; loop + autoplay; no native controls
 * - Logs load/error instead of crashing; error boundary fallback
 */
import React, { Component, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  isRemoteHttpsUri,
  resolvePlayableVideoUri,
  toPublicFeedVideoUrl,
} from '../services/uploadService';

export { toPublicFeedVideoUrl };

export function resolveFeedVideoUri(source) {
  const fromHelper = resolvePlayableVideoUri(source);
  const normalized = toPublicFeedVideoUrl(fromHelper);
  if (normalized) return normalized;
  if (typeof source === 'string') return toPublicFeedVideoUrl(source);
  return null;
}

export function isPlayableFeedUri(uri) {
  if (uri == null || typeof uri !== 'string') return false;
  const t = uri.trim();
  if (!t || t === 'null' || t === 'undefined') return false;
  return (
    t.startsWith('https://') ||
    t.startsWith('http://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library://')
  );
}

class VideoErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.log('Video Player Error:', error?.message || error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback || (
          <View style={[styles.placeholder, this.props.style]}>
            <Text style={styles.placeholderText}>CLIP UNAVAILABLE</Text>
          </View>
        )
      );
    }
    return this.props.children;
  }
}

/**
 * expo-video equivalents of expo-av:
 *   resizeMode="cover"     → contentFit="cover"
 *   useNativeControls={false}
 *   shouldPlay={true}      → autoPlay + player.play()
 *   isLooping={true}       → player.loop = true
 */
export default function SafeFeedVideo({
  uri: uriProp,
  source,
  style,
  muted = true,
  loop = true,
  autoPlay = true,
  /** When true, keep player mounted but paused (no remount). */
  paused = false,
  contentFit = 'cover',
  label = null,
  nativeControls = false,
}) {
  const resolved = useMemo(() => {
    if (uriProp) return toPublicFeedVideoUrl(uriProp) || uriProp;
    return resolveFeedVideoUri(source);
  }, [uriProp, source]);

  const playable = isPlayableFeedUri(resolved);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);

  const playerSource =
    playable && !failed && resolved
      ? { uri: resolved, contentType: 'auto' }
      : null;

  const player = useVideoPlayer(playerSource, (p) => {
    try {
      p.loop = loop; // isLooping
      p.muted = muted;
      // Smooth start: keep ~15s ahead, resume after ~1.5s buffered (Android ExoPlayer)
      p.bufferOptions = {
        preferredForwardBufferDuration: 15,
        minBufferForPlayback: 1.5,
        prioritizeTimeOverSizeThreshold: true,
        waitsToMinimizeStalling: true,
      };
    } catch (err) {
      console.log('Video Player Error:', err);
    }
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.bufferOptions = {
        preferredForwardBufferDuration: 15,
        minBufferForPlayback: 1.5,
        prioritizeTimeOverSizeThreshold: true,
        waitsToMinimizeStalling: true,
      };
    } catch (_) {
      /* older runtimes may ignore */
    }
  }, [player]);

  useEffect(() => {
    if (!player || failed) return;
    try {
      if (paused) player.pause?.();
      else if (autoPlay) player.play?.();
    } catch (err) {
      console.log('Video Player Error:', err);
    }
  }, [player, paused, autoPlay, failed]);

  useEffect(() => {
    if (!player) return;
    try {
      player.muted = muted;
    } catch (err) {
      console.log('Video Player Error:', err);
    }
  }, [player, muted]);

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    setHasFrame(false);
  }, [resolved]);

  useEffect(() => {
    let cancelled = false;
    let statusSub = null;
    let playingSub = null;

    (async () => {
      if (!playable || !resolved || !player || failed) return;
      try {
        console.log('[SafeFeedVideo] loading URI:', resolved);
        if (typeof player.replaceAsync === 'function') {
          await player.replaceAsync({ uri: resolved, contentType: 'auto' });
        }
        if (cancelled) return;
        player.loop = loop;
        player.muted = muted;
        if (autoPlay && !paused) {
          // shouldPlay
          player.play?.();
        } else {
          player.pause?.();
        }
      } catch (e) {
        console.log('Video Player Error:', e?.message || e);
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    try {
      statusSub = player?.addListener?.('statusChange', ({ status, error }) => {
        if (cancelled) return;
        if (status === 'error') {
          console.log('Video Player Error:', error || status);
          setFailed(true);
          setLoading(false);
        } else if (status === 'readyToPlay' || status === 'loading') {
          if (status === 'readyToPlay') {
            console.log('[SafeFeedVideo] onLoad / readyToPlay:', resolved);
            setLoading(false);
            if (autoPlay && !paused) {
              try {
                player.play?.();
              } catch (err) {
                console.log('Video Player Error:', err);
              }
            }
          }
        }
      });
      playingSub = player?.addListener?.('playingChange', ({ isPlaying }) => {
        if (isPlaying && !cancelled) {
          setLoading(false);
        }
      });
    } catch (err) {
      console.log('Video Player Error:', err);
    }

    return () => {
      cancelled = true;
      try {
        statusSub?.remove?.();
        playingSub?.remove?.();
      } catch (_) {
        /* ignore */
      }
      // Do NOT call player.release() — useVideoPlayer owns lifecycle.
      // Double-release on unmount/tap was crashing ArenaReelViewer.
      try {
        player?.pause?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [player, resolved, playable, failed, loop, muted, autoPlay, paused]);

  const onFirstFrameRender = () => {
    console.log('[SafeFeedVideo] onLoad / first frame decoded:', resolved);
    setHasFrame(true);
    setLoading(false);
  };

  if (!playable || failed || !player) {
    return (
      <View style={[styles.shell, style]}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {label || (failed ? 'CLIP UNAVAILABLE' : 'BAWAAL CLIP')}
          </Text>
          {!!resolved && failed ? (
            <Text style={styles.placeholderSub} numberOfLines={2}>
              {isRemoteHttpsUri(resolved)
                ? 'Cloud clip failed to decode'
                : 'No playable URL'}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <VideoErrorBoundary
      resetKey={resolved}
      style={style}
      fallback={
        <View style={[styles.shell, style]}>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>CLIP UNAVAILABLE</Text>
          </View>
        </View>
      }
    >
      {/* Explicit dimensions — Android Surface/TextureView needs a sized parent */}
      <View style={[styles.shell, style]} pointerEvents="box-none">
        <VideoView
          style={styles.video}
          player={player}
          contentFit={contentFit}
          nativeControls={false}
          // Block native fullscreen intents — JS Pressables own all taps
          fullscreenOptions={{ enable: false }}
          pointerEvents="none"
          onFirstFrameRender={onFirstFrameRender}
          {...(Platform.OS === 'android'
            ? { surfaceType: 'textureView', useExoShutter: false }
            : {})}
        />
        {(loading || !hasFrame) && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
        {!!label && (
          <View style={styles.cornerTag} pointerEvents="none">
            <Text style={styles.cornerTagText}>{label}</Text>
          </View>
        )}
      </View>
    </VideoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  placeholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  placeholderSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  cornerTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cornerTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
