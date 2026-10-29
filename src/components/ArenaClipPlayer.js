/**
 * Arena / Battle feed clip player.
 * Prefers real expo-av Video; falls back to expo-video so clips still loop
 * when Metro stubs expo-av (no "dev client" text wall).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import SportsFeedPlaceholder from './SportsFeedPlaceholder';

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
  if (direct) return direct;
  if (source && typeof source === 'object') {
    const fromHelper = sanitizePlayableFeedUri(resolvePlayableVideoUri(source));
    if (fromHelper) return fromHelper;
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
      if (ok) return ok;
    }
  }
  return null;
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
}) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(!autoPlay);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || failed || !AvVideo) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await node.setStatusAsync({
          shouldPlay: !!autoPlay && !paused && active,
          isLooping: !!loop,
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
  }, [active, autoPlay, failed, loop, muted, paused, resolved]);

  useEffect(() => {
    const node = videoRef.current;
    return () => {
      try {
        node?.stopAsync?.().catch?.(() => {});
        node?.unloadAsync?.().catch?.(() => {});
      } catch {
        /* ignore */
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (failed) return;
    setPaused((p) => !p);
  }, [failed]);

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
      <AvVideo
        ref={videoRef}
        style={styles.video}
        source={{ uri: resolved }}
        resizeMode={AvResizeMode?.COVER || 'cover'}
        shouldPlay={!!autoPlay && !paused && active}
        isLooping={!!loop}
        isMuted={!!muted}
        volume={muted ? 0 : 1}
        useNativeControls={false}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onReadyForDisplay={() => setLoading(false)}
        onError={(e) => {
          console.warn('[ArenaClipPlayer] av error:', e?.error || e);
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
      try {
        player?.pause?.();
      } catch {
        /* ignore */
      }
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

  if (!active) {
    return <View style={[styles.shell, style, styles.idle]} />;
  }

  if (!resolved) {
    return (
      <View style={[styles.shell, style, styles.fallback]}>
        <Text style={styles.fallbackTitle}>{label || 'BAWAAL CLIP'}</Text>
        <Text style={styles.fallbackSub}>Waiting for video</Text>
      </View>
    );
  }

  // Prefer native expo-av when the real module is present (npm start / EAS)
  if (AvVideo) {
    return (
      <ExpoAvClipPlayer
        key={`av-${resolved}`}
        resolved={resolved}
        style={style}
        label={label}
        muted={muted}
        loop={loop}
        autoPlay={autoPlay}
        active={active}
      />
    );
  }

  // Fallback: expo-video auto-loop when expo-av is stubbed — plays file:// + https
  return (
    <ExpoVideoErrorBoundary style={style} label={label} seed={resolved}>
      <ExpoVideoClipPlayer
        key={`ev-${resolved}`}
        resolved={resolved}
        style={style}
        label={label}
        muted={muted}
        loop={loop}
        autoPlay={autoPlay}
        active={active}
      />
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
  },
  idle: {
    backgroundColor: '#000000',
  },
  video: {
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
