/**
 * Remote Image with silent local fallback.
 * Skips network entirely when URI is null / empty / invalid / previously 404'd.
 * onError → swap to `require(...)` placeholder (or black when fallbackSource={null}).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import {
  DEFAULT_MEDIA_PLACEHOLDER,
  hasFailedRemoteImageUri,
  normalizeRemoteImageUri,
  rememberFailedRemoteImageUri,
} from '../constants/mediaFallbacks';

function resolveRemoteUri(uri, source) {
  const fromProp = normalizeRemoteImageUri(uri);
  if (fromProp) return fromProp;
  if (source && typeof source === 'object' && typeof source.uri === 'string') {
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
  const [failed, setFailed] = useState(() =>
    Boolean(remoteUri && hasFailedRemoteImageUri(remoteUri))
  );

  useEffect(() => {
    setFailed(Boolean(remoteUri && hasFailedRemoteImageUri(remoteUri)));
  }, [remoteUri, isLocalRequire]);

  const handleError = useCallback(
    (e) => {
      if (remoteUri) rememberFailedRemoteImageUri(remoteUri);
      if (!failed) setFailed(true);
      if (!silent) onError?.(e);
    },
    [failed, onError, remoteUri, silent]
  );

  const renderBlack = () => (
    <View style={[style, { backgroundColor: '#000000' }]} />
  );

  const renderFallback = () => {
    if (fallbackSource == null) return renderBlack();
    return (
      <Image
        source={fallbackSource}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
      />
    );
  };

  // No usable URI and not a bundled require → never fetch; show placeholder
  if (!remoteUri && !isLocalRequire) {
    return renderFallback();
  }

  if (failed) {
    return renderFallback();
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
