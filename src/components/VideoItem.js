import React, { memo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

const VideoItem = memo(({ item, shouldPlay, isActive }) => {
  const videoUri = item?.video_url || item?.videoUrl || item?.uri || item?.videoUri;
  const thumbnailUri =
    item?.thumbnail_url || item?.thumbnail || item?.thumbnailUrl || item?.poster_url || item?.poster;

  return (
    <View style={styles.container}>
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : null}
      {isActive && videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={shouldPlay}
          isLooping={true}
          isMuted={false}
          useNativeControls={false}
          onError={(e) => console.log('VIDEO FAIL:', item?.id, videoUri, e)}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width, height, backgroundColor: '#000' },
  video: { width, height, position: 'absolute' },
});

export default VideoItem;
