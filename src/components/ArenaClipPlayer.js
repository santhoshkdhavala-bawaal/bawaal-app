/**
 * Arena / Battle feed clip player — expo-av Video with local file:// + https support.
 * Tap toggles play/pause; auto-loops by default.
 * When Metro stubs expo-av (Expo Go), shows a labeled placeholder instead of a black box.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  resolvePlayableVideoUri,
} from '../services/uploadService';

function loadExpoAv() {
  try {
    return require('expo-av');
  } catch (err) {
    console.warn('[ArenaClipPlayer] expo-av missing:', err?.message || err);
    return null;
  }
}

const ExpoAv = loadExpoAv();
const Video = ExpoAv?.Video || null;
const ResizeMode = ExpoAv?.ResizeMode || null;
const isStubVideo =
  !Video ||
  Video.displayName === 'StubExpoAvVideo' ||
  String(Video.displayName || '').includes('Stub');

function resolveClipUri(uri, source) {
  if (typeof uri === 'string' && uri.trim()) {
    return ensurePublicBawaalVideoUrl(uri) || uri.trim();
  }
  if (source && typeof source === 'object') {
    const fromHelper = resolvePlayableVideoUri(source);
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
      if (typeof c === 'string' && c.trim()) {
        return ensurePublicBawaalVideoUrl(c) || c.trim();
      }
    }
  }
  return null;
}

function isPlayable(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const t = uri.trim();
  return (
    t.startsWith('https://') ||
    t.startsWith('http://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library://')
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
  const videoRef = useRef(null);
  const resolved = useMemo(
    () => resolveClipUri(uriProp, source),
    [uriProp, source]
  );
  const playable = isPlayable(resolved);
  // Parent keys this player by URI — remount resets pause/load/error state
  const [paused, setPaused] = useState(!autoPlay);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !playable || failed || isStubVideo) return undefined;
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
          console.warn('[ArenaClipPlayer] status:', err?.message || err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, autoPlay, failed, loop, muted, paused, playable, resolved]);

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
    if (!playable || failed) return;
    setPaused((p) => !p);
  }, [failed, playable]);

  if (!active) {
    return <View style={[styles.shell, style, styles.idle]} />;
  }

  if (!playable || failed || isStubVideo || !Video) {
    const localHint =
      resolved && !isRemoteHttpsUri(resolved) ? 'LOCAL CLIP READY' : null;
    return (
      <View style={[styles.shell, style]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>
            {failed ? 'CLIP UNAVAILABLE' : label || 'BAWAAL CLIP'}
          </Text>
          <Text style={styles.fallbackSub}>
            {isStubVideo
              ? 'Use npm start (dev client) for live playback'
              : localHint || 'Waiting for video URI'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.shell, style]}
      onPress={togglePlay}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play clip' : 'Pause clip'}
    >
      <Video
        ref={videoRef}
        style={styles.video}
        source={{ uri: resolved || source?.videoUri || source?.uri }}
        resizeMode={ResizeMode?.COVER || 'cover'}
        shouldPlay={!!autoPlay && !paused && active}
        isLooping={!!loop}
        isMuted={!!muted}
        volume={muted ? 0 : 1}
        useNativeControls={false}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onReadyForDisplay={() => setLoading(false)}
        onError={(e) => {
          console.warn('[ArenaClipPlayer] error:', e?.error || e);
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
    </Pressable>
  );
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
export { resolveClipUri, isPlayable as isPlayableClipUri };
