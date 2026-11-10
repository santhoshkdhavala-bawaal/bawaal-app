import React, { memo } from 'react';
import { View, Dimensions, StyleSheet, Text, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';

const { height, width } = Dimensions.get('window');

/**
 * Resolve the playable URI from Arena / battle row fields.
 * Prefer cloud `video_url`, then aliases / local URIs.
 */
function resolveItemVideoUri(item) {
  if (!item || typeof item !== 'object') return null;
  const candidates = [
    item.video_url,
    item.videoUrl,
    item.videoUri,
    item.uri,
    item.remoteVideoUri,
    item.publicCloudUrl,
    item.openerVideoUri,
    item.challengeVideoUri,
    item.recordedVideoUri,
    item.localVideoUri,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

const VideoItem = memo(({ item, shouldPlay, isActive }) => {
  const handle = String(
    item?.username || item?.author || item?.handle || 'athlete'
  ).replace(/^@/, '');
  const playUri = resolveItemVideoUri(item);

  return (
    <View style={styles.container}>
      <Image
        source={{
          uri:
            item?.thumbnail_url ||
            item?.thumbnail ||
            'https://picsum.photos/400/800',
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      {isActive && playUri ? (
        <Video
          source={{ uri: playUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!!shouldPlay}
          isLooping
          // Fully interactive player (web stub maps this to HTML5 controls={true})
          useNativeControls
          controls={true}
          isMuted={Platform.OS === 'web' ? !shouldPlay : false}
          onError={(e) => console.log('FAIL', item?.id, playUri, e)}
        />
      ) : null}
      <View style={styles.bottom} pointerEvents="box-none">
        <Text style={styles.user}>@{handle}</Text>
        <Text style={styles.caption}>
          {item?.caption || item?.title || 'Arena drop'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width, height, backgroundColor: '#000' },
  video: { width, height, position: 'absolute' },
  bottom: { position: 'absolute', bottom: 110, left: 16, right: 16 },
  user: { color: '#fff', fontSize: 20, fontWeight: '800' },
  caption: { color: '#fff', fontSize: 16 },
});

export default VideoItem;
