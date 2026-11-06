import React, { memo } from 'react';
import { View, Dimensions, StyleSheet, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';

const { height, width } = Dimensions.get('window');

const VideoItem = memo(({ item, shouldPlay, isActive }) => {
  const videoUri = item?.video_url || item?.videoUrl || null;
  const handle = String(item?.username || item?.author || item?.handle || 'athlete').replace(
    /^@/,
    ''
  );

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: item?.thumbnail_url || item?.thumbnail || 'https://picsum.photos/400/800' }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      {isActive && videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={shouldPlay}
          isLooping={true}
          useNativeControls={false}
          onError={(e) => console.log('FAIL', item?.id, e)}
        />
      ) : null}
      <View style={styles.bottom} pointerEvents="none">
        <Text style={styles.user}>@{handle}</Text>
        <Text style={styles.caption}>{item?.caption || 'Arena drop'}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width, height, backgroundColor: '#000' },
  video: { width, height, position: 'absolute' },
  bottom: { position: 'absolute', bottom: 110, left: 16 },
  user: { color: '#fff', fontSize: 20, fontWeight: '800' },
  caption: { color: '#fff', fontSize: 16 },
});

export default VideoItem;
