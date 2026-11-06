import React, { memo, useEffect, useRef } from 'react';
import {
  AppState,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { resolveVideoSource } from '../utils/reelMediaFallback';
import { safeUnloadExpoAvVideo } from '../utils/safeUnloadVideo';

function firstPlayableUri(candidates) {
  for (const candidate of candidates) {
    const parsed = resolveVideoSource(candidate);
    if (parsed?.uri) return parsed.uri;
  }
  return null;
}

function ActiveClip({
  videoUri,
  thumbnailUri,
  shouldPlay,
  muted,
  loop,
  onError,
  onLongPress,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      videoRef.current?.pauseAsync?.().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    return () => {
      void safeUnloadExpoAvVideo(node);
    };
  }, [videoUri]);

  return (
    <TouchableWithoutFeedback
      onLongPress={onLongPress}
      delayLongPress={450}
      disabled={!onLongPress}
    >
      <View style={styles.container}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!!shouldPlay}
          isLooping={loop !== false}
          isMuted={!!muted}
          useNativeControls={false}
          onError={(err) => {
            console.log('VIDEO ERROR:', err, 'URL:', videoUri);
            onError?.(err);
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const SafeVideoPlayer = memo(function SafeVideoPlayer({
  item,
  uri,
  shouldPlay = false,
  isMounted = true,
  muted = false,
  loop = true,
  style,
  onError,
  onLongPress,
}) {
  const videoUri = firstPlayableUri([
    item?.videoUrl,
    item?.video_url,
    item?.uri,
    item?.url,
    uri,
  ]);
  const thumbnailUri = firstPlayableUri([
    item?.thumbnail_url,
    item?.thumbnail,
    item?.thumbnailUrl,
    item?.poster_url,
    item?.poster,
  ]);
  const showVideo = isMounted !== false && !!videoUri;

  if (!showVideo) {
    return (
      <View style={[styles.container, style]}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]}>
      <ActiveClip
        videoUri={videoUri}
        thumbnailUri={thumbnailUri}
        shouldPlay={!!shouldPlay}
        muted={!!muted}
        loop={loop}
        onError={onError}
        onLongPress={onLongPress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

export default SafeVideoPlayer;
export { SafeVideoPlayer };
