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
  Alert,
} from 'react-native';
import ChallengeCam from './ChallengeCam';
import { setLatestBattleClip } from './battleClipStore';
import { postBattleResponseToSupabase } from './src/services/battleResponseService';
import { COLORS, RADIUS } from './theme';

/**
 * Arena challenge route — hosts CameraView via ChallengeCam.
 * On POST TO ARENA, forwards a local post payload to ArenaFeed.
 */
export default function ChallengeScreen({ route, navigation }) {
  const reel = route?.params?.reel;
  const [resultModal, setResultModal] = useState(null);
  const [camResetToken, setCamResetToken] = useState(0);
  const [isPosting, setIsPosting] = useState(false);

  const handleClose = useCallback(() => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      navigation?.navigate?.('Arena');
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
        speedRate: meta.speedRate ?? 1,
        target: meta.target || reel?.statSticker || '140 KG x 3 Reps',
        timestamp,
        isMock: !!meta.isMock,
        opponent: meta.opponent || `@${reel?.creator || 'Yuki_Lift'}`,
        durationSec: meta.durationSec || 60,
        durationMs: meta.durationMs || (meta.durationSec || 60) * 1000,
        facing: meta.facing || 'back',
        videoQuality: meta.videoQuality || '1080p',
        fps: meta.fps || 30,
        mimeType: meta.mimeType || 'video/mp4',
        creator: 'You',
        category: reel?.category || 'GYM',
        challengeOf: reel?.creator || 'Yuki_Lift',
      };
    },
    [reel]
  );

  const postToArena = useCallback(
    async (uri, meta = {}) => {
      if (isPosting) return;
      setIsPosting(true);
      let finalUri = uri;
      try {
        // Upload if ChallengeCam has not already pushed this clip to Supabase
        if (!meta.cloudUploaded && uri && !String(uri).startsWith('emulator-mock://')) {
          const cloud = await postBattleResponseToSupabase(uri, {
            battleId: route?.params?.battleId || reel?.battleId || reel?.id,
            slowMoStartSec: meta.slowMoStartSec,
            slowMoEndSec: meta.slowMoEndSec,
            slowMoRate: meta.slowMoEnabled ? meta.slowMoRate : 1,
          });
          if (cloud?.publicCloudUrl) {
            finalUri = cloud.publicCloudUrl;
          } else if (cloud?.localUri) {
            finalUri = cloud.localUri;
          }
          // missing-local-file / not-configured → still navigate with local/mock preview
          if (cloud?.skipped && cloud.reason === 'missing-local-file') {
            console.warn(
              'Local video missing at POST — continuing with Arena local preview:',
              cloud.error
            );
          }
        }

        const newArenaPost = buildArenaPost(finalUri, {
          ...meta,
          videoUri: finalUri,
          recordedVideoUri: finalUri,
          localVideoUri: meta.localVideoUri || uri,
          cloudUploaded: true,
        });
        setLatestBattleClip(newArenaPost);
        setCamResetToken((t) => t + 1);
        if (navigation?.navigate) {
          navigation.navigate('Arena', {
            newArenaPost,
            videoUri: newArenaPost.videoUri || finalUri,
            recordedVideoUri: newArenaPost.recordedVideoUri || finalUri,
          });
        } else {
          handleClose();
        }
      } catch (err) {
        console.error('Failed to post battle response:', err);
        Alert.alert(
          'Post failed',
          err?.message || 'Error posting to Arena. Please check your connection.'
        );
      } finally {
        setIsPosting(false);
      }
    },
    [navigation, buildArenaPost, handleClose, isPosting, route?.params?.battleId, reel]
  );

  const handleVideoCaptured = useCallback((uri, meta = {}) => {
    const isMock =
      meta?.isMock || (typeof uri === 'string' && uri.startsWith('emulator-mock://'));
    setResultModal({
      uri,
      meta: {
        ...meta,
        isMock,
        timestamp: meta.timestamp || Date.now(),
      },
      title: isMock ? 'FALLBACK CLIP READY' : 'CHALLENGE RECORDED',
      body: isMock
        ? 'Emulator camera was unavailable, so a safe placeholder clip was created. Post it to continue the flow.'
        : 'Your battle response is ready for the arena.',
    });
  }, []);

  const dismissModal = () => setResultModal(null);

  return (
    <View style={styles.root}>
      <ChallengeCam
        route={route}
        navigation={navigation}
        targetUser={reel?.creator || route?.params?.handle || 'Yuki_Lift'}
        challengeTarget={reel?.statSticker || route?.params?.target || '140 KG x 3 Reps'}
        challengeMaxDuration={
          route?.params?.challengeMaxDuration ||
          reel?.challengeMaxDuration ||
          reel?.durationSec ||
          30
        }
        onClose={handleClose}
        onVideoCaptured={handleVideoCaptured}
        resetToken={camResetToken}
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
            {!!resultModal?.meta?.speedRate && (
              <Text style={styles.metaLine}>
                SPEED {resultModal.meta.speedRate}x · {resultModal.meta.target}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, isPosting && styles.primaryBtnDisabled]}
              activeOpacity={0.85}
              disabled={isPosting}
              onPress={() => {
                const payload = resultModal;
                if (!payload?.uri || isPosting) return;
                postToArena(payload.uri, payload.meta || {}).then(() => {
                  dismissModal();
                });
              }}
            >
              {isPosting ? (
                <ActivityIndicator color="#05070A" />
              ) : (
                <Text style={styles.primaryBtnText}>POST TO ARENA ⚡</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.stayBtn} activeOpacity={0.7} onPress={dismissModal}>
              <Text style={styles.stayBtnText}>STAY</Text>
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
    backgroundColor: '#05070A',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.CARD_CHARCOAL,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  logoWrap: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    height: 50,
    width: '100%',
  },
  title: {
    color: COLORS.OFF_WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: COLORS.TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  metaLine: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 18,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.PLATINUM_BASE,
    borderRadius: RADIUS.cta,
    minHeight: 48,
    paddingVertical: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: COLORS.INK,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  stayBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    borderRadius: RADIUS.cta,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stayBtnText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});
