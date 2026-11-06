import React, { memo, useEffect } from 'react';
import {
  AppState,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveVideoSource } from '../utils/reelMediaFallback';
import { safeReleaseExpoVideoPlayer } from '../utils/safeUnloadVideo';

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
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = loop !== false;
      player.muted = !!muted;
      if (shouldPlay) player.play();
      else player.pause();
    } catch (err) {
      console.log('VIDEO ERROR:', err, 'URL:', videoUri);
      onError?.(err);
    }
  }, [player, shouldPlay, muted, loop, videoUri, onError]);

  useEffect(() => {
    if (!player) return undefined;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      safeReleaseExpoVideoPlayer(player);
    };
  }, [player]);

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
            resizeMode="cover"
          />
        ) : null}
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
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
            resizeMode="cover"
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
