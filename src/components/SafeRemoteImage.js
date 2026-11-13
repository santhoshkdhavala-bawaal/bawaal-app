/**
 * Remote Image with silent local fallback.
 * Skips network entirely when URI is null / empty / invalid.
 * Pass `fallbackSource={null}` for black underlay (Arena posters — no logo blink).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import {
  DEFAULT_MEDIA_PLACEHOLDER,
  normalizeRemoteImageUri,
} from '../constants/mediaFallbacks';

function resolveRemoteUri(uri, source) {
  const fromProp = normalizeRemoteImageUri(uri);
  if (fromProp) return fromProp;
  if (source && typeof source === 'object') {
    return normalizeRemoteImageUri(source.uri);
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
  const remoteUri = useMemo(() => resolveRemoteUri(uri, source), [uri, source]);
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

  const renderBlack = () => (
    <View style={[style, { backgroundColor: '#000000' }]} {...rest} />
  );

  // No usable URI and not a bundled require → never fetch; show placeholder
  if (!remoteUri && !isLocalRequire) {
    if (fallbackSource == null) return renderBlack();
    return (
      <Image
        source={fallbackSource}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
        {...rest}
      />
    );
  }

  if (failed) {
    if (fallbackSource == null) return renderBlack();
    return (
      <Image
        source={fallbackSource}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
        {...rest}
      />
    );
  }

  const resolved = isLocalRequire ? source : { uri: remoteUri };

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
