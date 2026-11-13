/**
 * Profile avatar — remote Supabase URL with silent fallback to local require(...)
 * or initials. Never fetches when URI is null / empty / invalid / previously 404'd.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_AVATAR_ASSET,
  hasFailedRemoteImageUri,
  normalizeRemoteImageUri,
  rememberFailedRemoteImageUri,
} from '../constants/mediaFallbacks';

const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const BORDER = 'rgba(255,255,255,0.22)';

function initialsFromName(name) {
  return String(name || '?')
    .replace(/^@/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * @param {object} props
 * @param {string|null} [props.uri]
 * @param {string} [props.name]
 * @param {number} [props.size]
 * @param {string} [props.ringColor]
 * @param {'initials'|'mark'} [props.fallback] — empty-URI fallback; onError always uses mark asset
 */
const SafeAvatar = memo(function SafeAvatar({
  uri,
  name,
  size = 56,
  ringColor,
  fallback = 'initials',
  style,
}) {
  const ring = ringColor || BORDER;
  const remote = useMemo(() => normalizeRemoteImageUri(uri), [uri]);
  const [failed, setFailed] = useState(() =>
    Boolean(remote && hasFailedRemoteImageUri(remote))
  );
  const initials = useMemo(() => initialsFromName(name), [name]);

  useEffect(() => {
    setFailed(Boolean(remote && hasFailedRemoteImageUri(remote)));
  }, [remote]);

  const handleError = useCallback(() => {
    if (remote) rememberFailedRemoteImageUri(remote);
    setFailed(true);
  }, [remote]);

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: SURFACE,
    borderWidth: ringColor ? 2 : 1,
    borderColor: ringColor ? ring : WHITE,
  };

  // Only hit the network when we have a real non-empty URI that has not 404'd
  if (remote && !failed) {
    return (
      <Image
        source={{ uri: remote }}
        style={[frame, style]}
        resizeMode="cover"
        onError={handleError}
        fadeDuration={0}
        accessibilityRole="image"
        accessibilityLabel={name ? `${name} avatar` : 'Athlete avatar'}
      />
    );
  }

  // Storage 404 / explicit mark fallback → local require(...) (no further network)
  if (failed || fallback === 'mark') {
    return (
      <View style={[frame, styles.markWrap, style]}>
        <Image
          source={DEFAULT_AVATAR_ASSET}
          style={{ width: size * 0.55, height: size * 0.55 }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  return (
    <View style={[frame, styles.initialsWrap, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: WHITE,
    fontWeight: '800',
  },
});

export default SafeAvatar;
