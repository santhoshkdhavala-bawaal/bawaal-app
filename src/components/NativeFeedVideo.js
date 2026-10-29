/**
 * Native-only feed video (expo-av).
 * Never import this file from Expo Go boot paths — SafeFeedVideo lazy-requires
 * it only when `canUseNativeVideo` is true.
 */
import React, {
  Component,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { isRemoteHttpsUri } from '../services/uploadService';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';

function isPlayableFeedUri(uri) {
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
    if (!node || !playable || failed || !Video) return undefined;
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
        node.setStatusAsync?.({ shouldPlay: false }).catch?.(() => {});
      } catch (_) {
        /* ignore */
      }
      try {
        node.pauseAsync?.().catch?.(() => {});
      } catch (_) {
        /* ignore */
      }
      try {
        node.stopAsync?.().catch?.(() => {});
      } catch (_) {
        /* ignore */
      }
      try {
        node.unloadAsync?.().catch?.(() => {});
      } catch (_) {
        /* ignore */
      }
    };
  }, [resolved]);

  if (!Video || !playable || failed) {
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

export default memo(NativeFeedVideo);

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
