/**
 * ChallengeCam pipeline host — Step 1 recorder → Storage upload → Arena persist.
 */
import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import ChallengeCamRecorder from './ChallengeCamRecorder';
import { setLatestBattleClip } from './battleClipStore';
import {
  pushArenaPost,
  pushArenaPostAndPersist,
} from './arenaFeedStore';
import {
  makeBawaalClipFileName,
  uploadLockedClip,
} from './src/services/recordToPostService';
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
} from './src/services/uploadService';
import { persistArenaPostToSupabase } from './src/services/arenaPostsService';
import { postBattleResponseToSupabase } from './src/services/battleResponseService';

export default function ChallengeScreen({ route, navigation }) {
  const reel = route?.params?.reel;
  const [recorderKey, setRecorderKey] = useState(0);
  const [statusNote, setStatusNote] = useState(null);

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

  const goArenaWithPost = useCallback(
    (post) => {
      setLatestBattleClip(post);
      setRecorderKey((k) => k + 1);
      if (navigation?.navigate) {
        navigation.navigate('Main', {
          tab: 'Arena',
          newArenaPost: post,
        });
      } else {
        handleClose();
      }
    },
    [handleClose, navigation]
  );

  const buildArenaPost = useCallback(
    (uri, meta = {}, extras = {}) => {
      const timestamp = meta.timestamp || Date.now();
      const localUri = extras.localVideoUri || meta.localVideoUri || uri;
      const cloudUri = extras.publicCloudUrl || meta.publicCloudUrl || null;
      // Playback URI for Arena battle cards — always a concrete string
      const playUri = cloudUri || localUri || uri;
      const challengeSeed =
        extras.challengeVideoUri ||
        meta.challengeVideoUri ||
        reel?.videoUri ||
        reel?.challengeVideoUri ||
        route?.params?.reel?.videoUri ||
        null;
      const finalVideoUri = extras.videoUri || playUri;
      const finalLocalUri = extras.localVideoUri || localUri;
      return {
        id: extras.id || `local-${timestamp}`,
        type: 'battle_thread',
        uri: extras.uri || finalVideoUri,
        videoUri: finalVideoUri,
        recordedVideoUri: extras.recordedVideoUri || finalVideoUri,
        localVideoUri: finalLocalUri,
        publicCloudUrl: extras.publicCloudUrl !== undefined ? extras.publicCloudUrl : cloudUri,
        remoteVideoUri: extras.remoteVideoUri !== undefined ? extras.remoteVideoUri : cloudUri,
        // Opponent seed clip (left pane); athlete response is videoUri (right pane)
        challengeVideoUri:
          extras.challengeVideoUri !== undefined
            ? extras.challengeVideoUri
            : challengeSeed,
        isBattleResponse: true,
        speedRate: meta.speedRate ?? 1,
        target:
          meta.target ||
          reel?.statSticker ||
          route?.params?.target ||
          'Battle response',
        caption:
          meta.caption ||
          reel?.statSticker ||
          route?.params?.target ||
          'Arena drop',
        timestamp,
        createdAt: timestamp,
        isMock: !!meta.isMock,
        opponent:
          meta.opponent ||
          `@${reel?.creator || route?.params?.handle || 'Challenger'}`,
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
        sport: reel?.category || route?.params?.sport || meta.category || 'GYM',
        challengeOf: reel?.creator || route?.params?.handle || 'Challenger',
        cloudUploaded:
          extras.cloudUploaded !== undefined
            ? extras.cloudUploaded
            : !!cloudUri,
        _freshPublish: true,
        _skipPersist: extras._skipPersist,
        challengeId: extras.challengeId,
        battleId: extras.battleId,
        isBattle: extras.isBattle,
      };
    },
    [reel, route?.params?.handle, route?.params?.reel?.videoUri, route?.params?.sport, route?.params?.target]
  );

  /**
   * Continue → hand recorded URI into Arena immediately, then cloud upload in background.
   */
  const handleContinue = useCallback(
    async (uri, meta = {}) => {
      const challengeId =
        route?.params?.battleId || reel?.battleId || reel?.id || undefined;
      const localUri = typeof uri === 'string' && uri.trim() ? uri.trim() : null;
      if (!localUri) {
        console.warn('[ChallengeScreen] Continue with empty video URI');
        setStatusNote('Recording missing — retake the clip');
        return;
      }
      const onProgress =
        typeof meta.onUploadProgress === 'function'
          ? meta.onUploadProgress
          : undefined;

      const battleIds = challengeId
        ? { challengeId, battleId: challengeId }
        : { isBattle: true };

      // 1) Instant Arena hand-off — post.videoUri = recorded file:// (or https later)
      const optimistic = buildArenaPost(localUri, meta, {
        localVideoUri: localUri,
        videoUri: localUri,
        uri: localUri,
        publicCloudUrl: null,
        cloudUploaded: false,
        _skipPersist: true,
        ...battleIds,
      });
      console.log('[ChallengeScreen] Arena hand-off videoUri ->', optimistic.videoUri);
      pushArenaPost(optimistic);
      goArenaWithPost(optimistic);

      // 2) Background: Storage upload → https → refresh feed + persist
      setStatusNote(null);
      void (async () => {
        let publicUrl = null;
        let lockedLocal = localUri;
        try {
          const uploaded = await uploadLockedClip(localUri, {
            fileName: makeBawaalClipFileName(),
            onProgress,
            onError: (msg) => {
              console.warn('[ChallengeScreen] upload error:', msg);
            },
          });
          lockedLocal = uploaded.localUri || localUri;
          if (
            uploaded.ok &&
            uploaded.publicUrl &&
            isRemoteHttpsUri(uploaded.publicUrl)
          ) {
            publicUrl =
              ensurePublicBawaalVideoUrl(uploaded.publicUrl) ||
              uploaded.publicUrl;
          }
        } catch (err) {
          console.warn('[ChallengeScreen] upload threw:', err?.message || err);
        }

        if (!publicUrl) return;

        const cloudPost = buildArenaPost(publicUrl, meta, {
          id: optimistic.id,
          localVideoUri: lockedLocal,
          videoUri: publicUrl,
          uri: publicUrl,
          publicCloudUrl: publicUrl,
          remoteVideoUri: publicUrl,
          cloudUploaded: true,
          _skipPersist: true,
          ...battleIds,
        });

        try {
          const card =
            (await pushArenaPostAndPersist(cloudPost)) ||
            pushArenaPost({ ...cloudPost, _skipPersist: true }) ||
            cloudPost;
          const persistRes = await persistArenaPostToSupabase({
            ...card,
            videoUri: publicUrl,
            uri: publicUrl,
            publicCloudUrl: publicUrl,
            _fromRemote: false,
            _skipPersist: false,
          });
          if (!persistRes?.ok && !persistRes?.skipped) {
            console.warn(
              '[ChallengeScreen] persist missed (clip is live):',
              persistRes?.error || persistRes?.reason
            );
          }
          postBattleResponseToSupabase(publicUrl, {
            battleId: challengeId,
          }).catch(() => {});
        } catch (err) {
          console.warn(
            '[ChallengeScreen] cloud publish threw:',
            err?.message || err
          );
          pushArenaPost({ ...cloudPost, _skipPersist: true });
        }
      })();
    },
    [
      buildArenaPost,
      goArenaWithPost,
      reel,
      route?.params?.battleId,
    ]
  );

  const challengeLabel =
    reel?.statSticker || route?.params?.target || 'BATTLE RESPONSE';

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
      {statusNote ? (
        <View style={styles.statusBanner} pointerEvents="none">
          <ActivityIndicator color="#FACC15" size="small" />
          <Text style={styles.statusText}>{statusNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  statusBanner: {
    position: 'absolute',
    top: '42%',
    left: 24,
    right: 24,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.45)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statusText: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
});
