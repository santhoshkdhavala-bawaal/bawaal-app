/**
 * ChallengeCam pipeline host — Step 1 recorder → confirm → Arena / upload.
 */
import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import ChallengeCamRecorder from './ChallengeCamRecorder';
import { setLatestBattleClip } from './battleClipStore';
import { pushArenaPost } from './arenaFeedStore';
import { postBattleResponseToSupabase } from './src/services/battleResponseService';
import { RADIUS } from './theme';

export default function ChallengeScreen({ route, navigation }) {
  const reel = route?.params?.reel;
  const [resultModal, setResultModal] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);

  const handleClose = useCallback(() => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      navigation?.navigate?.('Main', { tab: 'Arena' });
    } catch (error) {
      console.warn('ChallengeScreen close failed:', error?.message || error);
    }
  }, [navigation]);

  const buildArenaPost = useCallback(
    (uri, meta = {}) => {
      const timestamp = meta.timestamp || Date.now();
      return {
        id: `local-${timestamp}`,
        uri,
        videoUri: meta.videoUri || uri,
        recordedVideoUri: meta.recordedVideoUri || uri,
        localVideoUri: meta.localVideoUri || uri,
        speedRate: meta.speedRate ?? 1,
        target: meta.target || reel?.statSticker || route?.params?.target || 'Battle response',
        timestamp,
        isMock: !!meta.isMock,
        opponent: meta.opponent || `@${reel?.creator || route?.params?.handle || 'Challenger'}`,
        durationSec: meta.durationSec || 30,
        durationMs: meta.durationMs || (meta.durationSec || 30) * 1000,
        facing: meta.facing || 'back',
        flash: meta.flash || 'off',
        videoQuality: meta.videoQuality || '720p',
        fps: meta.fps || 30,
        mimeType: meta.mimeType || 'video/mp4',
        creator: 'You',
        author: '@you',
        category: reel?.category || route?.params?.sport || 'GYM',
        challengeOf: reel?.creator || route?.params?.handle || 'Challenger',
      };
    },
    [reel, route?.params?.handle, route?.params?.sport, route?.params?.target]
  );

  const postToArena = useCallback(
    async (uri, meta = {}) => {
      if (isPosting) return;
      setIsPosting(true);

      const challengeId =
        route?.params?.battleId || reel?.battleId || reel?.id || undefined;

      const localUri = meta.localVideoUri || meta.recordedVideoUri || meta.videoUri || uri;
      const optimisticPost = buildArenaPost(localUri, {
        ...meta,
        videoUri: localUri,
        recordedVideoUri: localUri,
        localVideoUri: localUri,
        cloudUploaded: false,
        type: 'battle_thread',
        caption: meta.caption || reel?.statSticker || route?.params?.target || 'Arena drop',
        ...(challengeId ? { challengeId, battleId: challengeId } : { isBattle: true }),
        sport: reel?.category || meta.category || 'GYM',
      });

      pushArenaPost(optimisticPost);
      setLatestBattleClip(optimisticPost);
      setResultModal(null);
      setRecorderKey((k) => k + 1);

      if (navigation?.navigate) {
        navigation.navigate('Main', {
          tab: 'Arena',
          newArenaPost: optimisticPost,
        });
      } else {
        handleClose();
      }
      setIsPosting(false);

      if (!meta.cloudUploaded && uri && !String(uri).startsWith('emulator-mock://')) {
        postBattleResponseToSupabase(uri, {
          battleId: challengeId,
        }).catch(() => {});
      }
    },
    [
      buildArenaPost,
      handleClose,
      isPosting,
      navigation,
      reel,
      route?.params?.battleId,
      route?.params?.target,
    ]
  );

  const handleContinue = useCallback((uri, meta = {}) => {
    setResultModal({
      uri,
      meta: {
        ...meta,
        timestamp: meta.timestamp || Date.now(),
        videoUri: uri,
        recordedVideoUri: uri,
        localVideoUri: uri,
      },
      title: 'CHALLENGE RECORDED',
      body: 'Your battle response is ready. Continue to upload to the Arena.',
    });
  }, []);

  const dismissModal = () => setResultModal(null);

  const challengeLabel =
    reel?.statSticker ||
    route?.params?.target ||
    'BATTLE RESPONSE';

  return (
    <View style={styles.root}>
      <ChallengeCamRecorder
        key={recorderKey}
        onClose={handleClose}
        onContinue={handleContinue}
        maxDurationSec={
          route?.params?.challengeMaxDuration ||
          reel?.challengeMaxDuration ||
          reel?.durationSec ||
          30
        }
        challengeLabel={challengeLabel}
      />

      <Modal
        visible={!!resultModal}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={dismissModal}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.logoWrap}>
              <Image
                source={require('./assets/BAWAAL_white_icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>{resultModal?.title}</Text>
            <Text style={styles.body}>{resultModal?.body}</Text>
            {!!resultModal?.meta?.durationSec && (
              <Text style={styles.metaLine}>
                {resultModal.meta.durationSec}s · {resultModal.meta.facing || 'back'} cam
              </Text>
            )}

            <TouchableOpacity
              style={styles.postBtn}
              activeOpacity={0.85}
              disabled={isPosting}
              onPress={() =>
                postToArena(resultModal.uri, resultModal.meta || {})
              }
            >
              {isPosting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.postBtnText}>UPLOAD TO ARENA</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                dismissModal();
                setRecorderKey((k) => k + 1);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>RE-TAKE</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: RADIUS?.card || 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 22,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  body: {
    color: '#A0A0A0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  metaLine: {
    color: '#E8ECE9',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  postBtn: {
    marginTop: 20,
    backgroundColor: '#FACC15',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  postBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  secondaryBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
