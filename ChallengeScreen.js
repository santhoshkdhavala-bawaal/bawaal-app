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
      const playUri = cloudUri || localUri || uri;
      return {
        id: `local-${timestamp}`,
        type: 'battle_thread',
        uri: playUri,
        videoUri: playUri,
        recordedVideoUri: playUri,
        localVideoUri: localUri,
        publicCloudUrl: cloudUri,
        remoteVideoUri: cloudUri,
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
        cloudUploaded: !!cloudUri,
        _freshPublish: true,
        ...extras,
      };
    },
    [reel, route?.params?.handle, route?.params?.sport, route?.params?.target]
  );

  /**
   * Continue → async Storage upload → https URL → persistArenaPostToSupabase.
   * Offline / upload miss → still prepend local file:// so feed is not a black card.
   */
  const handleContinue = useCallback(
    async (uri, meta = {}) => {
      const challengeId =
        route?.params?.battleId || reel?.battleId || reel?.id || undefined;
      const localUri = uri;
      const onProgress =
        typeof meta.onUploadProgress === 'function'
          ? meta.onUploadProgress
          : undefined;

      setStatusNote('Uploading clip…');

      // 1) Optimistic local feed (skip DB until we have https)
      const optimistic = buildArenaPost(localUri, meta, {
        localVideoUri: localUri,
        publicCloudUrl: null,
        cloudUploaded: false,
        _skipPersist: true,
        ...(challengeId
          ? { challengeId, battleId: challengeId }
          : { isBattle: true }),
      });
      pushArenaPost(optimistic);

      // 2) Upload local file:// → public https://…/bawaalvideos/…
      let publicUrl = null;
      let lockedLocal = localUri;
      try {
        const uploaded = await uploadLockedClip(localUri, {
          fileName: makeBawaalClipFileName(),
          onProgress,
          onError: (msg) => {
            console.warn('[ChallengeScreen] upload error:', msg);
            setStatusNote(String(msg || 'Upload failed — using local clip'));
          },
        });
        lockedLocal = uploaded.localUri || localUri;
        if (uploaded.ok && uploaded.publicUrl && isRemoteHttpsUri(uploaded.publicUrl)) {
          publicUrl =
            ensurePublicBawaalVideoUrl(uploaded.publicUrl) || uploaded.publicUrl;
        }
      } catch (err) {
        console.warn('[ChallengeScreen] upload threw:', err?.message || err);
        setStatusNote('Upload pending — showing local recording');
      }

      // 3) Persist only with verified https URL
      if (publicUrl) {
        const cloudPost = buildArenaPost(publicUrl, meta, {
          localVideoUri: lockedLocal,
          publicCloudUrl: publicUrl,
          remoteVideoUri: publicUrl,
          cloudUploaded: true,
          _skipPersist: true,
          ...(challengeId
            ? { challengeId, battleId: challengeId }
            : { isBattle: true }),
        });

        try {
          const card =
            (await pushArenaPostAndPersist(cloudPost)) ||
            pushArenaPost({ ...cloudPost, _skipPersist: true }) ||
            cloudPost;

          // Explicit persist call with https video_url (guards missing-https skip)
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

          // Legacy battle response row (soft)
          postBattleResponseToSupabase(publicUrl, {
            battleId: challengeId,
          }).catch(() => {});

          setStatusNote(null);
          goArenaWithPost({
            ...card,
            videoUri: publicUrl,
            uri: publicUrl,
            publicCloudUrl: publicUrl,
            localVideoUri: lockedLocal,
            cloudUploaded: true,
            _freshPublish: true,
          });
          return;
        } catch (err) {
          console.warn(
            '[ChallengeScreen] cloud publish threw:',
            err?.message || err
          );
        }
      }

      // 4) Graceful local fallback — feed plays file:// immediately
      const localPost = buildArenaPost(lockedLocal, meta, {
        localVideoUri: lockedLocal,
        publicCloudUrl: null,
        cloudUploaded: false,
        _skipPersist: true,
        ...(challengeId
          ? { challengeId, battleId: challengeId }
          : { isBattle: true }),
      });
      pushArenaPost(localPost);
      setStatusNote(null);
      goArenaWithPost(localPost);
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
