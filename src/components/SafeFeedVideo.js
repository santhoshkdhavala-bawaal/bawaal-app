/**
 * Crash-safe Arena feed video surface.
 *
 * Expo Go (`Constants.appOwnership === 'expo'`) → SportsFeedPlaceholder
 * (never mounts expo-av / ExponentAV). Dev-client & release → expo-av `<Video>`.
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
import {
  isRemoteHttpsUri,
  resolvePlayableVideoUri,
  toPublicFeedVideoUrl,
} from '../services/uploadService';
import { isExpoGo, canUseNativeVideo } from '../utils/runtimeEnv';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';

export { toPublicFeedVideoUrl };

/**
 * Never touch expo-av / ExponentAV inside Expo Go.
 * Dev-client loads AV lazily so a missing native module cannot crash boot.
 */
function loadNativeAvBinding() {
  if (isExpoGo || !canUseNativeVideo) {
    return { Video: null, ResizeMode: null };
  }
  try {
    // eslint-disable-next-line global-require
    const { loadExpoAv } = require('../native/safeNative');
    const ExpoAv = loadExpoAv();
    return {
      Video: ExpoAv?.Video || null,
      ResizeMode: ExpoAv?.ResizeMode || null,
    };
  } catch (err) {
    console.warn('[SafeFeedVideo] expo-av unavailable:', err?.message || err);
    return { Video: null, ResizeMode: null };
  }
}

const { Video, ResizeMode } = loadNativeAvBinding();

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

/** JS-only path — no hooks that depend on native Video. */
function ExpoGoFeedPlaceholder({ style, label, sport, resolved }) {
  return (
    <SportsFeedPlaceholder
      style={style}
      sport={sport}
      label={label || 'BAWAAL CLIP'}
      seed={hashSeed(resolved || label)}
      variant="feed"
    />
  );
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
}) {
  const playable = isPlayableFeedUri(resolved);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);
  const videoRef = useRef(null);
  const readyFallback = useRef(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFailed(false);
    setLoading(true);
    setHasFrame(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (readyFallback.current) clearTimeout(readyFallback.current);
    readyFallback.current = setTimeout(() => {
      setLoading(false);
    }, 1400);
    return () => {
      if (readyFallback.current) clearTimeout(readyFallback.current);
    };
  }, [resolved]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !playable || failed) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await node.setStatusAsync({
          shouldPlay: !!autoPlay && !paused,
          isLooping: !!loop,
          isMuted: !!muted,
          volume: muted ? 0 : 1,
          progressUpdateIntervalMillis: 800,
        });
      } catch (err) {
        if (!cancelled) {
          console.log('Video Player Error:', err?.message || err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPlay, paused, muted, loop, playable, failed, resolved]);

  useEffect(() => {
    const node = videoRef.current;
    return () => {
      if (!node) return;
      try {
        node.stopAsync?.().catch?.(() => {});
        node.unloadAsync?.().catch?.(() => {});
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  if (!playable || failed) {
    return (
      <View style={[styles.shell, style]}>
        <SportsFeedPlaceholder
          style={StyleSheet.absoluteFill}
          sport={sport}
          label={label || (failed ? 'CLIP UNAVAILABLE' : 'BAWAAL CLIP')}
          subtitle={
            failed
              ? isRemoteHttpsUri(resolved)
                ? 'Cloud clip failed to decode'
                : 'No playable URL'
              : undefined
          }
          seed={hashSeed(resolved || label)}
          showExpoBadge={false}
        />
      </View>
    );
  }

  return (
    <VideoErrorBoundary
      resetKey={resolved}
      style={style}
      fallback={
        <View style={[styles.shell, style]}>
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
        <View style={styles.underlay} pointerEvents="none">
          <Text style={styles.placeholderText}>{label || 'BAWAAL'}</Text>
        </View>

        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: resolved }}
          resizeMode={mapContentFit(contentFit)}
          shouldPlay={!!autoPlay && !paused}
          isLooping={!!loop}
          isMuted={!!muted}
          volume={muted ? 0 : 1}
          useNativeControls={!!nativeControls}
          progressUpdateIntervalMillis={800}
          onLoadStart={() => {
            setLoading(true);
          }}
          onLoad={() => {
            setLoading(false);
          }}
          onReadyForDisplay={() => {
            setHasFrame(true);
            setLoading(false);
          }}
          onError={(err) => {
            console.log('Video Player Error:', err?.error || err);
            setFailed(true);
            setLoading(false);
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

function SafeFeedVideo({
  uri: uriProp,
  source,
  style,
  muted = true,
  loop = true,
  autoPlay = true,
  paused = false,
  contentFit = 'cover',
  label = null,
  nativeControls = false,
  sport = null,
}) {
  const resolved = useMemo(() => {
    if (uriProp) return toPublicFeedVideoUrl(uriProp) || uriProp;
    return resolveFeedVideoUri(source);
  }, [uriProp, source]);

  if (isExpoGo || !Video) {
    return (
      <ExpoGoFeedPlaceholder
        style={style}
        label={label}
        sport={sport}
        resolved={resolved}
      />
    );
  }

  return (
    <NativeFeedVideo
      resolved={resolved}
      style={style}
      muted={muted}
      loop={loop}
      autoPlay={autoPlay}
      paused={paused}
      contentFit={contentFit}
      label={label}
      nativeControls={nativeControls}
      sport={sport}
    />
  );
}

export default memo(SafeFeedVideo);

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
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
