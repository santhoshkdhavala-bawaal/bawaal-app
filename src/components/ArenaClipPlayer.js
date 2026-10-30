/**
 * Arena / Battle feed clip player.
 * Prefers real expo-av Video; falls back to expo-video so clips still loop
 * when Metro stubs expo-av (no "dev client" text wall).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  resolvePlayableVideoUri,
  sanitizePlayableFeedUri,
} from '../services/uploadService';
import {
  safeReleaseExpoVideoPlayer,
  safeUnloadExpoAvVideo,
} from '../utils/safeUnloadVideo';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';
import {
  isUsablePlaybackUri,
  resolvePosterSource,
  resolveVideoSource,
} from '../utils/reelMediaFallback';

function loadRealExpoAv() {
  try {
    // Prefer safeNative gate (null in Expo Go; real module in npm start / EAS)
    const { loadExpoAv } = require('../native/safeNative');
    const mod = typeof loadExpoAv === 'function' ? loadExpoAv() : null;
    if (mod?.Video && isRealVideoComponent(mod.Video)) {
      return mod;
    }
  } catch {
    /* fall through */
  }
  try {
    const mod = require('expo-av');
    if (mod?.Video && isRealVideoComponent(mod.Video)) {
      return { Video: mod.Video, ResizeMode: mod.ResizeMode };
    }
  } catch (err) {
    console.warn('[ArenaClipPlayer] expo-av unavailable:', err?.message || err);
  }
  return null;
}

function isRealVideoComponent(VideoComp) {
  if (!VideoComp) return false;
  const name = String(VideoComp.displayName || VideoComp.name || '');
  if (/stub|mock/i.test(name)) return false;
  return true;
}

const RealAv = loadRealExpoAv();
const AvVideo = RealAv?.Video || null;
const AvResizeMode = RealAv?.ResizeMode || null;

function resolveClipUri(uri, source) {
  const direct = sanitizePlayableFeedUri(uri);
  if (direct && isUsablePlaybackUri(direct)) return direct;
  if (source && typeof source === 'object') {
    const fromHelper = sanitizePlayableFeedUri(resolvePlayableVideoUri(source));
    if (fromHelper && isUsablePlaybackUri(fromHelper)) return fromHelper;
    const candidates = [
      source.videoUri,
      source.video_url,
      source.uri,
      source.publicCloudUrl,
      source.remoteVideoUri,
      source.recordedVideoUri,
      source.localVideoUri,
    ];
    for (const c of candidates) {
      const ok = sanitizePlayableFeedUri(c);
      if (ok && isUsablePlaybackUri(ok)) return ok;
    }
  }
  return null;
}

function resolveClipPoster(source) {
  if (!source || typeof source !== 'object') return null;
  return (
    source.thumbnailUrl ||
    source.thumbnail_url ||
    source.posterUri ||
    null
  );
}

function ClipShell({ style, children, onPress, accessibilityLabel }) {
  if (onPress) {
    return (
      <Pressable
        style={[styles.shell, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.shell, style]}>{children}</View>;
}

/** Real expo-av path (dev client / release). */
function ExpoAvClipPlayer({
  resolved,
  style,
  label,
  muted,
  loop,
  autoPlay,
  active,
  posterUri = null,
}) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(!autoPlay);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [useFallbackAsset, setUseFallbackAsset] = useState(
    !isUsablePlaybackUri(resolved)
  );
  const posterSource = useMemo(
    () => resolvePosterSource(posterUri),
    [posterUri]
  );
  const videoSource = useMemo(() => {
    if (failed || useFallbackAsset || !isUsablePlaybackUri(resolved)) {
      return resolveVideoSource(null);
    }
    return resolveVideoSource(resolved);
  }, [failed, resolved, useFallbackAsset]);

  useEffect(() => {
    setFailed(false);
    setUseFallbackAsset(!isUsablePlaybackUri(resolved));
    setLoading(true);
  }, [resolved]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !AvVideo) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!active) {
          await node.setStatusAsync({ shouldPlay: false });
          return;
        }
        await node.setStatusAsync({
          shouldPlay: !!autoPlay && !paused && active,
          isLooping: loop !== false,
          isMuted: !!muted,
          volume: muted ? 0 : 1,
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('[ArenaClipPlayer] av status:', err?.message || err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, autoPlay, loop, muted, paused, videoSource]);

  // Full native teardown on unmount / URI swap — prevents camera→feed memory crashes
  useEffect(() => {
    const node = videoRef.current;
    return () => {
      void safeUnloadExpoAvVideo(node);
    };
  }, [videoSource]);

  const togglePlay = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  return (
    <ClipShell
      style={style}
      onPress={togglePlay}
      accessibilityLabel={paused ? 'Play clip' : 'Pause clip'}
    >
      <Image
        source={posterSource}
        style={styles.poster}
        resizeMode="cover"
        pointerEvents="none"
      />
      <AvVideo
        ref={videoRef}
        style={styles.video}
        source={videoSource}
        resizeMode={AvResizeMode?.COVER || 'cover'}
        shouldPlay={!!autoPlay && !paused && active}
        isLooping={loop !== false}
        isMuted={!!muted}
        volume={muted ? 0 : 1}
        useNativeControls={false}
        usePoster
        posterSource={posterSource}
        posterStyle={styles.poster}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onReadyForDisplay={() => setLoading(false)}
        onError={(e) => {
          console.warn('[ArenaClipPlayer] av error:', e?.error || e);
          if (!useFallbackAsset) {
            setUseFallbackAsset(true);
            setLoading(true);
            return;
          }
          setFailed(true);
          setLoading(false);
        }}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      {paused ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Text style={styles.playBadgeText}>▶ PLAY</Text>
        </View>
      ) : null}
      {!!label ? (
        <View style={styles.corner} pointerEvents="none">
          <Text style={styles.cornerText}>{label}</Text>
        </View>
      ) : null}
    </ClipShell>
  );
}

/** expo-video fallback — works when expo-av is Metro-stubbed. */
function ExpoVideoClipPlayer({
  resolved,
  style,
  label,
  muted,
  loop,
  autoPlay,
  active,
}) {
  const [paused, setPaused] = useState(!autoPlay);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const player = useVideoPlayer(resolved ? { uri: resolved } : null, (p) => {
    try {
      p.loop = !!loop;
      p.muted = !!muted;
      if (autoPlay) p.play();
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    if (!player || !resolved) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        player.muted = !!muted;
        player.loop = !!loop;
        if (active && autoPlay && !paused) player.play();
        else player.pause();
        setLoading(false);
      } catch (err) {
        console.warn('[ArenaClipPlayer] expo-video status:', err?.message || err);
        setFailed(true);
        setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, autoPlay, loop, muted, paused, player, resolved]);

  useEffect(() => {
    return () => {
      safeReleaseExpoVideoPlayer(player);
    };
  }, [player]);

  const togglePlay = useCallback(() => {
    if (failed || !player) return;
    setPaused((p) => {
      const next = !p;
      try {
        if (next) player.pause();
        else player.play();
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [failed, player]);

  if (failed) {
    return (
      <View style={[styles.shell, style, styles.fallback]}>
        <Text style={styles.fallbackTitle}>CLIP UNAVAILABLE</Text>
      </View>
    );
  }

  return (
    <ClipShell
      style={style}
      onPress={togglePlay}
      accessibilityLabel={paused ? 'Play clip' : 'Pause clip'}
    >
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      {paused ? (
        <View style={styles.playBadge} pointerEvents="none">
          <Text style={styles.playBadgeText}>▶ PLAY</Text>
        </View>
      ) : null}
      {!!label ? (
        <View style={styles.corner} pointerEvents="none">
          <Text style={styles.cornerText}>{label}</Text>
        </View>
      ) : null}
    </ClipShell>
  );
}

function ArenaClipPlayer({
  uri: uriProp,
  source,
  style,
  label = null,
  muted = true,
  loop = true,
  autoPlay = true,
  active = true,
}) {
  const resolved = useMemo(
    () => resolveClipUri(uriProp, source),
    [uriProp, source]
  );

  const posterUri = resolveClipPoster(source);

  if (!active) {
    return (
      <View style={[styles.shell, style, styles.idle]}>
        <Image
          source={resolvePosterSource(posterUri)}
          style={styles.poster}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Prefer native expo-av when the real module is present (npm start / EAS)
  // Missing URI → player still mounts with bundled sample_challenge.mp4
  if (AvVideo) {
    return (
      <ExpoAvClipPlayer
        key={`av-${resolved || 'fallback'}`}
        resolved={resolved}
        style={style}
        label={label}
        muted={muted}
        loop={loop}
        autoPlay={autoPlay}
        active={active}
        posterUri={posterUri}
      />
    );
  }

  // Fallback: expo-video auto-loop when expo-av is stubbed — plays file:// + https
  const expoVideoUri = resolved || null;
  return (
    <ExpoVideoErrorBoundary
      style={style}
      label={label}
      seed={resolved || 'fallback'}
    >
      {expoVideoUri ? (
        <ExpoVideoClipPlayer
          key={`ev-${expoVideoUri}`}
          resolved={expoVideoUri}
          style={style}
          label={label}
          muted={muted}
          loop={loop}
          autoPlay={autoPlay}
          active={active}
        />
      ) : (
        <View style={[styles.shell, style, styles.fallback]}>
          <Image
            source={resolvePosterSource(posterUri)}
            style={styles.poster}
            resizeMode="cover"
          />
          <Text style={styles.fallbackTitle}>{label || 'BAWAAL CLIP'}</Text>
          <Text style={styles.fallbackSub}>Loading clip…</Text>
        </View>
      )}
    </ExpoVideoErrorBoundary>
  );
}

class ExpoVideoErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[ArenaClipPlayer] expo-video crashed:', error?.message || error);
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={[styles.shell, this.props.style]}>
          <SportsFeedPlaceholder
            style={StyleSheet.absoluteFill}
            label={this.props.label || 'BAWAAL CLIP'}
            seed={String(this.props.seed || 'clip').length}
            variant="feed"
            showExpoBadge={false}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
    position: 'relative',
  },
  idle: {
    backgroundColor: '#0A0A0A',
  },
  poster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0A0A',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(59,130,246,0.9)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  corner: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cornerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#121212',
  },
  fallbackTitle: {
    color: '#E8ECE9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  fallbackSub: {
    color: '#A0A0A0',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default memo(ArenaClipPlayer);
export { resolveClipUri };
export function isPlayableClipUri(uri) {
  return Boolean(sanitizePlayableFeedUri(uri));
}
