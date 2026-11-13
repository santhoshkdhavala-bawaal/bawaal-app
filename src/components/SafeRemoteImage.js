/**
 * Remote Image with silent local fallback on load / 404 failure.
 * Pass `fallbackSource={null}` for black underlay (Arena posters — no logo blink).
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { DEFAULT_MEDIA_PLACEHOLDER } from '../constants/mediaFallbacks';

function resolveRemoteUri(uri, source) {
  if (typeof uri === 'string' && uri.trim()) return uri.trim();
  if (source && typeof source === 'object' && typeof source.uri === 'string') {
    const u = source.uri.trim();
    return u || null;
  }
  return null;
}

/**
 * @param {object} props
 * @param {string} [props.uri]
 * @param {object|number} [props.source] — remote `{ uri }` or local require
 * @param {number|object|null} [props.fallbackSource] — local require, or `null` for black shell
 * @param {boolean} [props.silent] — swallow errors (default true)
 */
const SafeRemoteImage = memo(function SafeRemoteImage({
  uri,
  source,
  fallbackSource = DEFAULT_MEDIA_PLACEHOLDER,
  style,
  resizeMode = 'cover',
  onError,
  silent = true,
  ...rest
}) {
  const remoteUri = resolveRemoteUri(uri, source);
  const isLocalRequire = typeof source === 'number';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [remoteUri, isLocalRequire]);

  const handleError = useCallback(
    (e) => {
      if (!failed) setFailed(true);
      if (!silent) onError?.(e);
    },
    [failed, onError, silent]
  );

  if (failed && fallbackSource == null) {
    return <View style={[style, { backgroundColor: '#000000' }]} {...rest} />;
  }

  let resolved;
  if (failed) {
    resolved = fallbackSource;
  } else if (isLocalRequire) {
    resolved = source;
  } else if (remoteUri) {
    resolved = { uri: remoteUri };
  } else if (source && typeof source === 'object' && !source.uri) {
    resolved = source;
  } else if (fallbackSource != null) {
    resolved = fallbackSource;
  } else {
    return <View style={[style, { backgroundColor: '#000000' }]} {...rest} />;
  }

  return (
    <Image
      source={resolved}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
      fadeDuration={0}
      {...rest}
    />
  );
});

export default SafeRemoteImage;
