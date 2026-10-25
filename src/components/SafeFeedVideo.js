/**
 * Crash-safe feed / reel video surface for BAWAAL.
 * - Prefers full Supabase public HTTPS URLs
 * - Android uses textureView so overlays don't blank the SurfaceView
 * - Never mounts VideoView without a playable URI; swallows render errors
 */
import React, { Component, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

function releasePlayer(player) {
  if (!player) return;
  try {
    player.pause?.();
  } catch (_) {
    /* ignore */
  }
  try {
    if (typeof player.release === 'function') player.release();
  } catch (_) {
    /* ignore */
  }
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
    console.warn('[SafeFeedVideo] render error:', error?.message || error);
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
 * @param {{ uri?: string|null, source?: object, style?: object, muted?: boolean, loop?: boolean, autoPlay?: boolean, contentFit?: 'cover'|'contain'|'fill', label?: string|null, nativeControls?: boolean }} props
 */
export default function SafeFeedVideo({
  uri: uriProp,
  source,
  style,
  muted = true,
  loop = true,
  autoPlay = true,
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

  const playerSource =
    playable && !failed && resolved
      ? { uri: resolved, contentType: 'auto' }
      : null;

  const player = useVideoPlayer(playerSource, (p) => {
    try {
      p.loop = loop;
      p.muted = muted;
    } catch (_) {
      /* ignore */
    }
  });

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  useEffect(() => {
    let cancelled = false;
    let statusSub = null;

    (async () => {
      if (!playable || !resolved || !player || failed) return;
      try {
        if (typeof player.replaceAsync === 'function') {
          await player.replaceAsync({ uri: resolved, contentType: 'auto' });
        }
        if (cancelled) return;
        player.loop = loop;
        player.muted = muted;
        if (autoPlay) player.play?.();
      } catch (e) {
        console.warn('[SafeFeedVideo] load failed:', e?.message || e);
        if (!cancelled) setFailed(true);
      }
    })();

    try {
      statusSub = player?.addListener?.('statusChange', ({ status, error }) => {
        if (status === 'error') {
          console.warn('[SafeFeedVideo] player status error:', error);
          if (!cancelled) setFailed(true);
        }
      });
    } catch (_) {
      /* ignore */
    }

    return () => {
      cancelled = true;
      try {
        statusSub?.remove?.();
      } catch (_) {
        /* ignore */
      }
      releasePlayer(player);
    };
  }, [player, resolved, playable, failed, loop, muted, autoPlay]);

  if (!playable || failed || !player) {
    return (
      <View style={[styles.placeholder, style]}>
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
    );
  }

  return (
    <VideoErrorBoundary
      resetKey={resolved}
      style={style}
      fallback={
        <View style={[styles.placeholder, style]}>
          <Text style={styles.placeholderText}>CLIP UNAVAILABLE</Text>
        </View>
      }
    >
      <View style={[styles.wrap, style]}>
        <VideoView
          style={StyleSheet.absoluteFillObject}
          player={player}
          contentFit={contentFit}
          nativeControls={nativeControls}
          {...(Platform.OS === 'android'
            ? { surfaceType: 'textureView', useExoShutter: false }
            : {})}
        />
        {!!label && (
          <View style={styles.cornerTag}>
            <Text style={styles.cornerTagText}>{label}</Text>
          </View>
        )}
      </View>
    </VideoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  placeholder: {
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
