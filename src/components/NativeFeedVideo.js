/**
 * Native-only feed video (expo-av).
 * Never import this file from Expo Go boot paths — SafeFeedVideo lazy-requires
 * it only when `canUseNativeVideo` is true.
 *
 * Declarative source / shouldPlay only — no blocking setStatusAsync loops
 * and no mid-playback sync swap to bundled mp4 (avoids black-screen freezes).
 */
import React, {
  Component,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';
import {
  isUsablePlaybackUri,
  resolvePosterSource,
} from '../utils/reelMediaFallback';
import { safeUnloadExpoAvVideo } from '../utils/safeUnloadVideo';
import SafeRemoteImage from './SafeRemoteImage';

function isPlayableFeedUri(uri) {
  return isUsablePlaybackUri(uri);
}

function loadNativeAvBinding() {
  try {
    // eslint-disable-next-line global-require
    const { loadExpoAv } = require('../native/safeNative');
    const ExpoAv = loadExpoAv();
    return {
      Video: ExpoAv?.Video || null,
      ResizeMode: ExpoAv?.ResizeMode || null,
    };
  } catch (err) {
    console.warn('[NativeFeedVideo] expo-av unavailable:', err?.message || err);
    return { Video: null, ResizeMode: null };
  }
}

const { Video, ResizeMode } = loadNativeAvBinding();

function mapContentFit(contentFit) {
  if (!ResizeMode) return undefined;
  if (contentFit === 'contain') return ResizeMode.CONTAIN;
  if (contentFit === 'fill' || contentFit === 'stretch') return ResizeMode.STRETCH;
  return ResizeMode.COVER;
}

function hashSeed(value) {
  const s = String(value || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
    try {
      console.warn('[NativeFeedVideo] boundary:', error?.message || error);
    } catch (_) {
      /* ignore */
    }
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

function NativeFeedVideo({
  resolved,
  style,
  muted,
  loop,
  autoPlay,
  paused,
  contentFit,
  label,
  nativeControls,
  sport,
  posterUri = null,
  onPlaybackError = null,
}) {
  const playable = isPlayableFeedUri(resolved);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);
  const videoRef = useRef(null);
  const readyFallback = useRef(null);

  // URI-only — never sync-swap to bundled sample_challenge.mp4
  const videoSource = useMemo(() => {
    if (!playable || failed) return null;
    return { uri: String(resolved).trim() };
  }, [failed, playable, resolved]);

  const posterSource = useMemo(
    () => resolvePosterSource(posterUri),
    [posterUri]
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFailed(false);
    setLoading(!!playable);
    setHasFrame(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (readyFallback.current) clearTimeout(readyFallback.current);
    readyFallback.current = setTimeout(() => {
      setLoading(false);
    }, 1400);
    return () => {
      if (readyFallback.current) clearTimeout(readyFallback.current);
    };
  }, [playable, resolved]);

  // Soft unload on URI change / unmount — fire-and-forget, never await on render
  useEffect(() => {
    const node = videoRef.current;
    return () => {
      void safeUnloadExpoAvVideo(node);
    };
  }, [videoSource]);

  if (!Video) {
    return (
      <View style={[styles.shell, style]}>
        <SportsFeedPlaceholder
          style={StyleSheet.absoluteFill}
          sport={sport}
          label={label || 'BAWAAL CLIP'}
          seed={hashSeed(resolved || label)}
          showExpoBadge={false}
        />
      </View>
    );
  }

  if (!videoSource) {
    return (
      <View style={[styles.shell, style]}>
        <View style={styles.blackUnderlay} />
        {posterSource ? (
          <SafeRemoteImage
            source={posterSource}
            style={styles.poster}
            resizeMode="cover"
            fallbackSource={null}
            silent
          />
        ) : null}
        <Text style={styles.placeholderText}>
          {label || 'CLIP UNAVAILABLE'}
        </Text>
      </View>
    );
  }

  return (
    <VideoErrorBoundary
      resetKey={String(resolved || 'fallback')}
      style={style}
      fallback={
        <View style={[styles.shell, style]}>
          <View style={styles.blackUnderlay} />
          {posterSource ? (
            <SafeRemoteImage
              source={posterSource}
              style={styles.poster}
              resizeMode="contain"
              fallbackSource={null}
              silent
            />
          ) : null}
          <SportsFeedPlaceholder
            style={StyleSheet.absoluteFill}
            label="CLIP UNAVAILABLE"
            showExpoBadge={false}
            seed={hashSeed(resolved)}
          />
        </View>
      }
    >
      <View style={[styles.shell, style]} pointerEvents="box-none">
        {/* Solid black underlay — avoid BAWAAL logo blink while buffering */}
        <View style={styles.blackUnderlay} pointerEvents="none" />
        {posterSource ? (
          <SafeRemoteImage
            source={posterSource}
            style={styles.poster}
            resizeMode="cover"
            pointerEvents="none"
            fallbackSource={null}
            silent
          />
        ) : null}

        <Video
          ref={videoRef}
          style={styles.videoPlayer}
          source={videoSource}
          resizeMode={mapContentFit(contentFit)}
          shouldPlay={!!autoPlay && !paused}
          isLooping={loop !== false}
          isMuted={!!muted}
          volume={muted ? 0 : 1}
          useNativeControls={!!nativeControls}
          usePoster={false}
          posterStyle={styles.poster}
          progressUpdateIntervalMillis={1000}
          onLoadStart={() => {
            try {
              setLoading(true);
            } catch (_) {
              /* ignore */
            }
          }}
          onLoad={() => {
            try {
              setLoading(false);
            } catch (_) {
              /* ignore */
            }
          }}
          onReadyForDisplay={() => {
            try {
              setHasFrame(true);
              setLoading(false);
            } catch (_) {
              /* ignore */
            }
          }}
          onError={(err) => {
            try {
              console.warn('[NativeFeedVideo] render error:', err?.error || err);
              setFailed(true);
              setLoading(false);
              onPlaybackError?.(err);
            } catch (_) {
              /* never crash the native render path */
            }
          }}
        />

        {loading && !hasFrame ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}

        {!!label && (
          <View style={styles.cornerTag} pointerEvents="none">
            <Text style={styles.cornerTagText}>{label}</Text>
          </View>
        )}
      </View>
    </VideoErrorBoundary>
  );
}

export default memo(NativeFeedVideo);

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: 450,
    minHeight: 450,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  blackUnderlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: 450,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
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
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
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
