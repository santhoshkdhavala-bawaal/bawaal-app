import React, { useEffect, useRef, useState, memo } from 'react';
import { View, Dimensions, StyleSheet, Image, AppState, TouchableWithoutFeedback } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { resolveVideoSource } from '../utils/reelMediaFallback';
import { safeUnloadExpoAvVideo } from '../utils/safeUnloadVideo';

const { width, height } = Dimensions.get('window');

function firstPlayableUri(candidates) {
  for (const candidate of candidates) {
    const parsed = resolveVideoSource(candidate);
    if (parsed?.uri) return parsed.uri;
  }
  return null;
}

const SafeVideoPlayer = memo(({
  item,
  uri,
  shouldPlay = false,
  isMounted = true,
  muted = false,
  loop = true,
  style,
  onError,
  onLongPress,
}) => {
  const videoRef = useRef(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const videoUri = firstPlayableUri([
    item?.video_url,
    item?.videoUrl,
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

  useEffect(() => {
    setIsBuffering(true);
  }, [videoUri]);

  useEffect(() => {
    return () => {
      safeUnloadExpoAvVideo(videoRef);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      videoRef.current?.pauseAsync?.().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const showVideo = isMounted !== false && !!videoUri;

  return (
    <TouchableWithoutFeedback
      onLongPress={onLongPress}
      delayLongPress={450}
      disabled={!onLongPress}
    >
      <View style={[styles.container, style]}>
        {showVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={!!shouldPlay}
            isLooping={loop !== false}
            isMuted={!!muted}
            useNativeControls={false}
            bufferConfig={{
              minBufferMs: 1500,
              maxBufferMs: 3000,
              bufferForPlaybackMs: 500,
              bufferForPlaybackAfterRebufferMs: 1000,
            }}
            onLoad={() => setIsBuffering(false)}
            onError={(e) => {
              console.log('VIDEO ERROR:', e, 'URL:', videoUri);
              onError?.(e);
            }}
          />
        ) : null}
        {thumbnailUri && (!showVideo || isBuffering) ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
      </View>
    </TouchableWithoutFeedback>
  );
});

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: 'black',
  },
  video: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
});

export default SafeVideoPlayer;
export { SafeVideoPlayer };
