/**
 * Camera + VideoPublishModal host for SPARKS / ChallengeCam stack routes.
 * Recording only sets URI + opens publish modal — navigation waits for Success or Cancel.
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
  const [isPublishing, setIsPublishing] = useState(false);

  const leaveToArena = useCallback(
    (params = {}) => {
      setPublishModalVisible(false);
      setIsPublishing(false);
      setCapturedVideoUri(null);
      try {
        if (params && (params.newArenaPost || params.tab)) {
          navigation?.navigate?.('Main', {
            tab: 'Arena',
            ...params,
          });
          return;
        }
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation?.navigate?.('Main', { tab: 'Arena' });
      } catch (err) {
        console.warn(
          '[CameraPublishHost] leaveToArena failed:',
          err?.message || err
        );
      }
    },
    [navigation]
  );

  /** Recording finished — freeze URI + open publish; do not clear until Success/Cancel. */
  const handleVideoRecorded = useCallback((uri) => {
    const next = typeof uri === 'string' ? uri.trim() : '';
    if (!next) return;
    // Keep prior URI if same clip re-notifies; never null on stop
    setCapturedVideoUri(next);
    setIsPublishing(true);
    setPublishModalVisible(true);
  }, []);

  /** Cancel — leave camera after explicitly dismissing publish. */
  const handlePublishClose = useCallback(() => {
    leaveToArena();
  }, [leaveToArena]);

  /** Upload finished — then navigate / refresh Arena. */
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

      leaveToArena({ newArenaPost: post });
    },
    [capturedVideoUri, leaveToArena, route?.params]
  );

  const active = getActiveUser?.() || {};

  return (
    <View style={styles.root}>
      <UniversalCamera
        navigation={navigation}
        route={route}
        onVideoRecorded={handleVideoRecorded}
        publishHold={isPublishing || publishModalVisible}
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
