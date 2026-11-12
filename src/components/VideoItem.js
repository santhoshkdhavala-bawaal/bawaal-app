import React, { memo } from 'react';
import { View, Dimensions, StyleSheet, Text, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

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

function resolveUserTag(item) {
  const raw =
    item?.username ||
    item?.author ||
    item?.handle ||
    item?.host ||
    item?.creator ||
    item?.user_id ||
    'athlete';
  const s = String(raw || 'athlete').trim();
  if (!s || s === 'null' || s === 'undefined') return '@athlete';
  // Hide raw UUIDs in the user tag
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return '@athlete';
  }
  if (/^user-/i.test(s)) return `@${s.replace(/^@/, '')}`;
  return s.startsWith('@') ? s : `@${s.replace(/^@/, '')}`;
}

function resolveTitle(item) {
  const t =
    item?.title ||
    item?.caption ||
    item?.target ||
    item?.description ||
    'Arena drop';
  return String(t).trim() || 'Arena drop';
}

const VideoItem = memo(({ item, shouldPlay, isActive, muted = true, itemHeight, itemWidth }) => {
  const h = Number(itemHeight) > 0 ? Number(itemHeight) : WINDOW_HEIGHT;
  const w = Number(itemWidth) > 0 ? Number(itemWidth) : WINDOW_WIDTH;
  const handle = resolveUserTag(item);
  const title = resolveTitle(item);
  const playUri = resolveItemVideoUri(item);
  // Keep the player mounted for the active row and its neighbor
  const mountPlayer = !!isActive && !!playUri;
  // Web autoplay still needs mute until the user unmutes via the feed toggle
  const effectiveMuted =
    Platform.OS === 'web' ? !!muted || !shouldPlay : !!muted;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <View style={[StyleSheet.absoluteFill, styles.underlay]} />
      {mountPlayer ? (
        <Video
          source={{ uri: playUri }}
          style={[styles.video, { width: w, height: h }]}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!!shouldPlay}
          isLooping
          // Feed chrome is mute + ⋮ only — no native play/pause / download / PiP
          useNativeControls={false}
          controls={false}
          isMuted={effectiveMuted}
          onError={(e) => console.log('FAIL', item?.id, playUri, e)}
        />
      ) : null}
      {!playUri ? (
        <View style={styles.missingWrap} pointerEvents="none">
          <Text style={styles.missingText}>WAITING FOR CLIP</Text>
        </View>
      ) : null}
      {/* Profile overlay: handle + title only — Follow lives in the ⋮ sheet */}
      <View style={styles.bottom} pointerEvents="box-none">
        <Text style={styles.user} numberOfLines={1}>
          {handle}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </View>
  );
});

VideoItem.displayName = 'VideoItem';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  underlay: {
    backgroundColor: '#000000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  missingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  bottom: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
  },
  user: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 20,
  },
});

export default VideoItem;
