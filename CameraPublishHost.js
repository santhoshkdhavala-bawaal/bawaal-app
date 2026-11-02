/**
 * Camera + VideoPublishModal host for SPARKS / ChallengeCam stack routes.
 * Captures onVideoRecorded → opens publish modal over the camera (no early pop-to-landing).
 */
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import UniversalCamera from './UniversalCamera';
import VideoPublishModal from './components/VideoPublishModal';
import { getActiveUser } from './src/services/activeUserProfile';
import { pushArenaPost } from './arenaFeedStore';

export default function CameraPublishHost({ navigation, route }) {
  const [capturedVideoUri, setCapturedVideoUri] = useState(null);
  const [publishModalVisible, setPublishModalVisible] = useState(false);

  const handleVideoRecorded = useCallback((uri) => {
    const next = typeof uri === 'string' ? uri.trim() : '';
    if (!next) return;
    setCapturedVideoUri(next);
    setPublishModalVisible(true);
  }, []);

  const handlePublishClose = useCallback(() => {
    setPublishModalVisible(false);
  }, []);

  const handlePublishSuccess = useCallback(
    (data) => {
      const cloudUrl =
        (typeof data?.video_url === 'string' && data.video_url) ||
        (typeof data?.url === 'string' && data.url) ||
        null;
      const playUri = cloudUrl || capturedVideoUri;
      const category =
        (typeof data?.category === 'string' && data.category) || 'COMBAT';
      const caption =
        (typeof data?.caption === 'string' && data.caption.trim()) ||
        'BAWAAL Drop';
      const mode =
        route?.params?.initialMode ||
        (route?.params?.isChallengeResponse ? 'BATTLE_REWIND' : 'SPARKS');

      const post = {
        id: data?.id || `publish-${Date.now()}`,
        mode,
        videoUri: playUri,
        uri: playUri,
        publicCloudUrl: cloudUrl,
        remoteVideoUri: cloudUrl,
        localVideoUri: capturedVideoUri,
        title: caption,
        caption,
        category,
        sport: category,
        timestamp: Date.now(),
        createdAt: Date.now(),
        feedTarget: 'ARENA',
        _freshPublish: true,
      };

      try {
        pushArenaPost(post);
      } catch (err) {
        console.warn(
          '[CameraPublishHost] pushArenaPost failed:',
          err?.message || err
        );
      }

      setCapturedVideoUri(null);
      setPublishModalVisible(false);

      navigation?.navigate?.('Main', {
        tab: 'Arena',
        newArenaPost: post,
      });
    },
    [capturedVideoUri, navigation, route?.params]
  );

  const active = getActiveUser?.() || {};

  return (
    <View style={styles.root}>
      <UniversalCamera
        navigation={navigation}
        route={route}
        onVideoRecorded={handleVideoRecorded}
      />
      <VideoPublishModal
        visible={publishModalVisible && !!capturedVideoUri}
        videoUri={capturedVideoUri}
        userId={active.userId || active.id}
        onClose={handlePublishClose}
        onSuccess={handlePublishSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
