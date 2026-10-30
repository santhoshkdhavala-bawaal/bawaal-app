/**
 * Crash-safe Arena feed video surface.
 *
 * Expo Go → SportsFeedPlaceholder (never imports / mounts expo-av).
 * Dev-client & release → lazy-requires NativeFeedVideo (expo-av).
 */
import React, { memo, useMemo } from 'react';
import {
  resolvePlayableVideoUri,
  toPublicFeedVideoUrl,
} from '../services/uploadService';
import { isExpoGo, canUseNativeVideo } from '../utils/runtimeEnv';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';

export { toPublicFeedVideoUrl };

export function resolveFeedVideoUri(source) {
  const fromHelper = resolvePlayableVideoUri(source);
  const normalized = toPublicFeedVideoUrl(fromHelper);
  if (normalized) return normalized;
  if (typeof source === 'string') {
    return toPublicFeedVideoUrl(source) || source.trim() || null;
  }
  // Cloud miss → keep local file:// / content:// so feed cards are not black
  if (source && typeof source === 'object') {
    const locals = [
      source.localVideoUri,
      source.videoUri,
      source.uri,
      source.recordedVideoUri,
      source.video_url,
    ];
    for (const c of locals) {
      if (typeof c === 'string' && c.trim()) {
        return toPublicFeedVideoUrl(c) || c.trim();
      }
    }
  }
  return null;
}

export function isPlayableFeedUri(uri) {
  if (uri == null || typeof uri !== 'string') return false;
  const t = uri.trim();
  if (!t || t === 'null' || t === 'undefined') return false;
  if (/^(mock|placeholder|local:|blob:)/i.test(t)) return false;
  return (
    t.startsWith('https://') ||
    t.startsWith('http://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library://')
  );
}

function hashSeed(value) {
  const s = String(value || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** JS-only path — no expo-av / ExponentAV. */
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

let NativeFeedVideoComponent = null;

function getNativeFeedVideo() {
  if (NativeFeedVideoComponent) return NativeFeedVideoComponent;
  try {
    // eslint-disable-next-line global-require
    NativeFeedVideoComponent = require('./NativeFeedVideo').default;
  } catch (err) {
    console.warn('[SafeFeedVideo] native player unavailable:', err?.message || err);
    NativeFeedVideoComponent = null;
  }
  return NativeFeedVideoComponent;
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
  posterUri = null,
}) {
  const resolved = useMemo(() => {
    if (uriProp) return toPublicFeedVideoUrl(uriProp) || uriProp;
    return resolveFeedVideoUri(source);
  }, [uriProp, source]);

  const poster = useMemo(() => {
    if (posterUri) return posterUri;
    if (source && typeof source === 'object') {
      return (
        source.thumbnailUrl ||
        source.thumbnail_url ||
        source.posterUri ||
        source.avatarUrl ||
        null
      );
    }
    return null;
  }, [posterUri, source]);

  // Expo Go / missing native AV → solid placeholder, zero ExponentAV touch.
  if (isExpoGo || !canUseNativeVideo) {
    return (
      <ExpoGoFeedPlaceholder
        style={style}
        label={label}
        sport={sport}
        resolved={resolved}
      />
    );
  }

  const NativeFeedVideo = getNativeFeedVideo();
  if (!NativeFeedVideo) {
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
      posterUri={poster}
    />
  );
}

export default memo(SafeFeedVideo);
