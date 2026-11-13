/**
 * Profile avatar — remote Supabase URL with silent fallback to initials / local mark.
 * Never fetches when URI is null / empty / invalid — skips straight to placeholder.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_AVATAR_ASSET,
  normalizeRemoteImageUri,
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
 * @param {'initials'|'mark'} [props.fallback] — initials (default) or BAWAAL B mark
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
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => initialsFromName(name), [name]);

  useEffect(() => {
    setFailed(false);
  }, [remote]);

  const handleError = useCallback(() => {
    setFailed(true);
  }, []);

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: SURFACE,
    borderWidth: ringColor ? 2 : 1,
    borderColor: ringColor ? ring : WHITE,
  };

  // Only hit the network when we have a real non-empty URI
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

  if (fallback === 'mark') {
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
