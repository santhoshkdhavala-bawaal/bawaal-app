/**
 * Arena / Battle feed clip player.
 * Plays with expo-av. Idle rows stay black, with an optional thumbnail.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  resolvePlayableVideoUri,
  sanitizePlayableFeedUri,
} from '../services/uploadService';
import { safeUnloadExpoAvVideo } from '../utils/safeUnloadVideo';
import {
  isUsablePlaybackUri,
  resolvePosterSource,
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

/** Real expo-av path — declarative source/shouldPlay only (no blocking setStatusAsync). */
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
  const posterSource = useMemo(
    () => resolvePosterSource(posterUri),
    [posterUri]
  );
  // URI-only source — never sync-swap to bundled mp4 (freezes the JS thread)
  const videoSource = useMemo(() => {
    if (!isUsablePlaybackUri(resolved)) return null;
    return { uri: String(resolved).trim() };
  }, [resolved]);

  useEffect(() => {
    setFailed(false);
    setLoading(!!videoSource);
    setPaused(!autoPlay);
  }, [autoPlay, resolved, videoSource]);

  // Soft unload on URI change / unmount — never await on the render path
  useEffect(() => {
    const node = videoRef.current;
    return () => {
      void safeUnloadExpoAvVideo(node);
    };
  }, [videoSource]);

  const togglePlay = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  if (!videoSource || failed) {
    return (
      <View style={[styles.shell, style, styles.fallback]}>
        <View style={styles.blackUnderlay} />
        <Text style={styles.fallbackTitle}>{label || 'CLIP UNAVAILABLE'}</Text>
      </View>
    );
  }

  return (
    <ClipShell
      style={style}
      onPress={togglePlay}
      accessibilityLabel={paused ? 'Play clip' : 'Pause clip'}
    >
      {/* Solid black underlay — never BAWAAL logo (avoids blink on recycle) */}
      <View style={styles.blackUnderlay} pointerEvents="none" />
      {posterSource ? (
        <Image
          source={posterSource}
          style={styles.poster}
          resizeMode="cover"
          pointerEvents="none"
        />
      ) : null}
      <AvVideo
        ref={videoRef}
        style={styles.videoPlayer}
        source={videoSource}
        resizeMode={AvResizeMode?.COVER || 'cover'}
        shouldPlay={!!autoPlay && !paused && !!active}
        isLooping={loop !== false}
        isMuted={!!muted}
        volume={muted ? 0 : 1}
        useNativeControls={false}
        usePoster={!!posterSource}
        posterSource={posterSource || undefined}
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
            setLoading(false);
          } catch (_) {
            /* ignore */
          }
        }}
        onError={(e) => {
          try {
            console.warn('[ArenaClipPlayer] render error:', e?.error || e);
            setFailed(true);
            setLoading(false);
          } catch (_) {
            /* never crash the native render path */
          }
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
  const resolved = useMemo(() => {
    // Prefer Supabase `video_url` then local / mapped URIs
    const fromUrl =
      source && typeof source === 'object'
        ? sanitizePlayableFeedUri(source.video_url || source.videoUrl)
        : null;
    if (fromUrl && isUsablePlaybackUri(fromUrl)) return fromUrl;
    return resolveClipUri(uriProp, source);
  }, [uriProp, source]);

  const posterUri = resolveClipPoster(source);

  // Off-screen recycle: solid black (+ optional real thumbnail) — no decoder, no logo blink
  if (!active) {
    const idlePoster = resolvePosterSource(posterUri);
    return (
      <View style={[styles.shell, style, styles.idle]}>
        <View style={styles.blackUnderlay} />
        {idlePoster ? (
          <Image
            source={idlePoster}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : null}
      </View>
    );
  }

  if (!AvVideo) {
    return (
      <View style={[styles.shell, style, styles.idle]}>
        <View style={styles.blackUnderlay} />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: 450,
    minHeight: 450,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  idle: {
    backgroundColor: '#000000',
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
