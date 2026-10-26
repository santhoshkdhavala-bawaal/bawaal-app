/**
 * PostCreationSheet — Arena / Battles dispatch + branded BAWAAL success modal.
 * Closes modals safely (setTimeout) before onSuccess / navigation to prevent crashes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  pushArenaPostAndPersist,
  pushArenaPost,
} from './arenaFeedStore';
import {
  pushBattleChallenge,
  pushHotFeatureBattle,
} from './battlesFeedStore';
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  resolvePlayableVideoUri,
  sanitizeVideoUriForUpload,
  uploadVideoToSupabase,
} from './src/services/uploadService';
import GalleryDeleteButton from './src/components/GalleryDeleteButton';
import { normalizeMediaLibraryAssetId } from './src/services/galleryMediaService';

/** Yield a frame so uploading indicators paint before native transfer starts. */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => requestAnimationFrame(() => setTimeout(resolve, 0));
    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(() => finish(), { timeout: 120 });
    } else {
      finish();
    }
  });
}

export type CreationMode =
  | 'SPARKS'
  | 'JOSH'
  | 'BATTLE_REWIND'
  | 'BATTLE_BAWAAL';

export const SPARTY_TAGLINES = [
  '#TalkCheap',
  '#RawPower',
  '#DailyGrind',
  '#TargetLocked',
] as const;

export type SportyTagline = (typeof SPARTY_TAGLINES)[number];

export type FeedPostCard = {
  id: string;
  mode: CreationMode;
  videoUri: string | null;
  localVideoUri?: string | null;
  publicCloudUrl?: string | null;
  remoteVideoUri?: string | null;
  title: string;
  caption?: string;
  tagline?: SportyTagline;
  targetReps?: number;
  timeLimit?: number;
  timeLimitSec?: number;
  timestamp: number;
  feedTarget: 'ARENA' | 'BATTLES';
  [key: string]: unknown;
};

export type PostCreationPayload = {
  mode: CreationMode;
  videoUri: string | null;
  localVideoUri?: string | null;
  publicCloudUrl?: string | null;
  remoteVideoUri?: string | null;
  title: string;
  tagline?: SportyTagline;
  targetReps?: number;
  timeLimitSec?: number;
  slowMoEnabled?: boolean;
  slowMoRate?: number;
  slowMoEndSec?: number;
  slowMoStartSec?: number;
  durationSec?: number;
  feedTarget?: 'ARENA' | 'BATTLES';
  newPost?: FeedPostCard;
  uploadSkipped?: boolean;
  uploadReason?: string;
};

export type PostCreationSheetProps = {
  mode: CreationMode;
  videoUri: string | null;
  slowMoEnabled?: boolean;
  slowMoRate?: number;
  slowMoStartSec?: number;
  slowMoEndSec?: number;
  durationSec?: number;
  /** Media-library asset id for optional "delete from gallery" control. */
  galleryAssetId?: string | null;
  onClose: () => void;
  onSuccess: (payload?: PostCreationPayload) => void;
  /** Kill any lingering preview / camera player audio before post or leave. */
  onStopMedia?: () => void;
  onGalleryAssetDeleted?: () => void;
};

/** Minimalist Black & White — never neon orange */
const ACCENT = '#FFFFFF';
const SHEET_BG = 'rgba(10,10,10,0.95)';

const MODE_DISPLAY: Record<CreationMode, string> = {
  SPARKS: '⚡ SPARKS',
  JOSH: '🔥 JOSH',
  BATTLE_REWIND: '🥊 BATTLE REWIND',
  BATTLE_BAWAAL: '⚔️ BATTLE BAWAAL',
};

function headerForMode(mode: CreationMode): string {
  switch (mode) {
    case 'SPARKS':
      return '⚡ Publish Spark (24h Story)';
    case 'JOSH':
      return '🔥 Publish Bawaal Josh Reel';
    case 'BATTLE_REWIND':
      return '🥊 Publish Battle Rewind Challenge';
    case 'BATTLE_BAWAAL':
      return '⚔️ Battle Bawaal (Live 1v1)';
    default:
      return 'Publish to BAWAAL';
  }
}

function titlePlaceholder(mode: CreationMode): string {
  switch (mode) {
    case 'SPARKS':
      return 'e.g., Who wants this heat?';
    case 'JOSH':
      return 'e.g., Brutal 150kg PB Deadlift';
    case 'BATTLE_REWIND':
      return 'e.g., 50 Clapper Pushups Challenge';
    case 'BATTLE_BAWAAL':
      return 'e.g., Live 100 Pushups Sprint';
    default:
      return 'Give it a hype phrase…';
  }
}

function safeStr(v: unknown, fallback = ''): string {
  if (typeof v === 'string' && v.trim()) return v;
  return fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** SPARKS/JOSH → arenaFeedStore · REWIND/BAWAAL → battlesFeedStore */
export async function dispatchToFeeds(
  payload: PostCreationPayload
): Promise<PostCreationPayload> {
  const timestamp = Date.now();
  const remoteRaw =
    (typeof payload.publicCloudUrl === 'string' && payload.publicCloudUrl) ||
    (typeof payload.remoteVideoUri === 'string' && payload.remoteVideoUri) ||
    (typeof payload.videoUri === 'string' && payload.videoUri) ||
    null;
  // Always force /storage/v1/object/public/bawaalvideos/...
  const remote =
    (remoteRaw && ensurePublicBawaalVideoUrl(remoteRaw)) || remoteRaw || null;
  const local =
    (typeof payload.localVideoUri === 'string' && payload.localVideoUri) ||
    null;
  // Prefer HTTPS cloud URL for feed playback; keep local as fallback only
  const videoUri =
    resolvePlayableVideoUri({
      publicCloudUrl: remote,
      remoteVideoUri: remote,
      videoUri: payload.videoUri,
      localVideoUri: local,
    }) || remote || null;
  const title = safeStr(payload.title, 'BAWAAL Drop');
  const mediaMeta = {
    videoUri,
    uri: videoUri,
    recordedVideoUri: videoUri,
    localVideoUri: local || null,
    publicCloudUrl: remote,
    remoteVideoUri: remote,
  };

  if (payload.mode === 'SPARKS' || payload.mode === 'JOSH') {
    const arenaPayload = {
      id: `arena-${payload.mode.toLowerCase()}-${timestamp}`,
      type: 'reel' as const,
      mode: payload.mode,
      ...mediaMeta,
      title,
      caption: payload.tagline ? `${title} ${payload.tagline}` : title,
      tagline: payload.tagline || '#DailyGrind',
      creator: 'You',
      author: '@you',
      // GYM default so sport-tab filters still show the new post (ALL tab shows all)
      category: 'GYM',
      sport: 'GYM',
      target: title,
      timestamp,
      createdAt: timestamp,
      durationSec: safeNum(payload.durationSec, 30),
      slowMoEnabled: !!payload.slowMoEnabled,
      slowMoRate: safeNum(payload.slowMoRate, 1),
      slowMoStartSec: safeNum(payload.slowMoStartSec, 0),
      slowMoEndSec: safeNum(
        payload.slowMoEndSec,
        safeNum(payload.durationSec, 30)
      ),
      hypeCount: 0,
      feed: 'ARENA',
    };
    // Prepend local feed + await bawaal_posts upsert
    const arenaCard =
      (await pushArenaPostAndPersist(arenaPayload)) ||
      pushArenaPost(arenaPayload) ||
      arenaPayload;

    const newPost: FeedPostCard = {
      id: safeStr(arenaCard?.id, `arena-${timestamp}`),
      mode: payload.mode,
      ...mediaMeta,
      title,
      caption: safeStr(arenaCard?.caption, title),
      tagline: payload.tagline,
      timestamp,
      feedTarget: 'ARENA',
      ...(arenaCard || {}),
    };

    return { ...payload, title, ...mediaMeta, feedTarget: 'ARENA', newPost };
  }

  if (payload.mode === 'BATTLE_REWIND') {
    const battleCard = pushBattleChallenge({
      id: `rewind-${timestamp}`,
      sport: 'GYM',
      title,
      target: title,
      description: payload.tagline || null,
      host: '@MUMBAI_STRIKER',
      responses: 0,
      status: 'OPEN',
      ...mediaMeta,
      videoUri: videoUri || undefined,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      source: 'BATTLE_REWIND',
      isHotFeature: false,
    });

    const newPost: FeedPostCard = {
      id: safeStr(battleCard?.id, `rewind-${timestamp}`),
      mode: 'BATTLE_REWIND',
      ...mediaMeta,
      title,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      feedTarget: 'BATTLES',
      ...(battleCard || {}),
    };

    return { ...payload, title, ...mediaMeta, feedTarget: 'BATTLES', newPost };
  }

  if (payload.mode === 'BATTLE_BAWAAL') {
    const hotCard = pushHotFeatureBattle({
      id: `live-bawaal-${timestamp}`,
      challengeTitle: title,
      title,
      target: title,
      host: '@MUMBAI_STRIKER',
      hostFlag: '🇮🇳',
      hostLabel: 'INDIA',
      ...mediaMeta,
      videoUri: videoUri || undefined,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      status: 'LIVE',
      isHotFeature: true,
      source: 'BATTLE_BAWAAL',
    });

    const newPost: FeedPostCard = {
      id: safeStr(hotCard?.id, `live-bawaal-${timestamp}`),
      mode: 'BATTLE_BAWAAL',
      ...mediaMeta,
      title,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      feedTarget: 'BATTLES',
      ...(hotCard || {}),
    };

    return { ...payload, title, ...mediaMeta, feedTarget: 'BATTLES', newPost };
  }

  return {
    ...payload,
    title,
    ...mediaMeta,
    newPost: {
      id: `post-${timestamp}`,
      mode: payload.mode,
      ...mediaMeta,
      title,
      timestamp,
      feedTarget: 'ARENA',
    },
  };
}

function BawaalSuccessModal({
  visible,
  mode,
  onDone,
}: {
  visible: boolean;
  mode: CreationMode;
  onDone: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <Image
            source={require('./assets/bawaal-full-logo.png')}
            style={styles.successLogo}
            resizeMode="contain"
          />
          <Text style={styles.successEyebrow}>BAWAAL</Text>
          <Text style={styles.successTitle}>
            🔥 Success! Your video was posted successfully to{' '}
            {MODE_DISPLAY[mode]}
          </Text>
          <Text style={styles.successSub}>
            It will appear at the top of your feed.
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={onDone}
            activeOpacity={0.9}
          >
            <Text style={styles.successBtnText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function InlineError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <TouchableOpacity style={styles.inlineError} onPress={onDismiss} activeOpacity={0.9}>
      <Text style={styles.inlineErrorText}>{message}</Text>
    </TouchableOpacity>
  );
}

function PostCreationSheet({
  mode,
  videoUri,
  slowMoEnabled = false,
  slowMoRate = 0.5,
  slowMoStartSec = 0,
  slowMoEndSec,
  durationSec,
  galleryAssetId = null,
  onClose,
  onSuccess,
  onStopMedia,
  onGalleryAssetDeleted,
}: PostCreationSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState<SportyTagline>('#DailyGrind');
  const [targetReps, setTargetReps] = useState('50');
  const [timeLimit, setTimeLimit] = useState(
    String(durationSec && durationSec > 0 ? durationSec : 30)
  );
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadErrorDetail, setUploadErrorDetail] = useState('');
  /** Cleared after user deletes from gallery — avoids syncing prop via useEffect. */
  const [clearedGalleryAssetId, setClearedGalleryAssetId] = useState<
    string | null
  >(null);
  const safeGalleryAssetId = normalizeMediaLibraryAssetId(galleryAssetId);
  const linkedGalleryAssetId =
    safeGalleryAssetId && safeGalleryAssetId !== clearedGalleryAssetId
      ? safeGalleryAssetId
      : null;
  const [successVisible, setSuccessVisible] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PostCreationPayload | null>(
    null
  );

  const showTaglines = mode === 'SPARKS' || mode === 'JOSH';
  const showBattleFields =
    mode === 'BATTLE_REWIND' || mode === 'BATTLE_BAWAAL';

  const stopMedia = useCallback(() => {
    try {
      onStopMedia?.();
    } catch (err) {
      console.warn('[PostCreationSheet] onStopMedia failed:', err);
    }
  }, [onStopMedia]);

  // Ghost-audio shield: stop preview players when this sheet mounts / unmounts
  useEffect(() => {
    stopMedia();
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  const clipHint = useMemo(() => {
    if (!videoUri) return 'No clip attached';
    const short = videoUri.split('/').pop() || videoUri;
    return short.length > 42 ? `${short.slice(0, 39)}…` : short;
  }, [videoUri]);

  const finishSuccess = () => {
    const payload = pendingPayload;
    setSuccessVisible(false);
    setPendingPayload(null);
    stopMedia();
    // Crash shield: close sheet, then delay onSuccess / goBack (unmount race)
    onClose();
    setTimeout(() => {
      try {
        onSuccess(payload || undefined);
      } catch (err) {
        console.warn('[PostCreationSheet] onSuccess failed:', err);
      }
    }, 300);
  };

  /**
   * Android bare paths must be `file://` / `content://` before upload.
   * Multipart FormData to Supabase `/object/...` stores boundary junk as the
   * "video" → black screen + player crash. We send raw MP4 bytes instead
   * (Content-Type: video/mp4) via `uploadVideoToSupabase`.
   */
  const formatVideoUriForUpload = (rawUri: string): string => {
    const fromHelper = sanitizeVideoUriForUpload(rawUri);
    if (fromHelper) return fromHelper;
    if (
      Platform.OS === 'android' &&
      !rawUri.startsWith('file://') &&
      !rawUri.startsWith('content://')
    ) {
      return `file://${rawUri}`;
    }
    return rawUri;
  };

  /**
   * Upload clip → public HTTPS URL, or null (caller must NOT create a feed post).
   * Local file:// → Blob/ArrayBuffer → Supabase `bawaalvideos` (see uploadService).
   */
  const uploadClipOrAbort = useCallback(
    async (rawLocalUri: string): Promise<string | null> => {
      const formattedUri = formatVideoUriForUpload(rawLocalUri);
      const fileName = `video_${Date.now()}.mp4`;
      setUploadErrorDetail('');

      console.log('[PostCreationSheet] formattedUri ->', formattedUri);
      console.log('[PostCreationSheet] upload fileName ->', fileName);
      console.log('[PostCreationSheet] platform ->', Platform.OS);

      try {
        const remoteUrl = await uploadVideoToSupabase(formattedUri, fileName, {
          onProgress: (pct: number) => setUploadPct(pct),
          onError: (msg: string) => setUploadErrorDetail(String(msg || '')),
        });

        if (typeof remoteUrl === 'string' && isRemoteHttpsUri(remoteUrl)) {
          console.log('[PostCreationSheet] cloud URL ready:', remoteUrl);
          return remoteUrl.trim();
        }

        console.error(
          '[PostCreationSheet] Storage upload failed or returned non-HTTPS URL:',
          remoteUrl
        );
        return null;
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        console.error('[PostCreationSheet] upload threw:', msg);
        setUploadErrorDetail(msg);
        return null;
      }
    },
    []
  );

  const handlePost = async () => {
    setFormError('');
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError('Please give your post a quick title!');
      return;
    }
    if (!videoUri && mode !== 'BATTLE_BAWAAL') {
      setFormError('Record a video before posting.');
      return;
    }
    if (uploading) return;

    let reps: number | undefined;
    let secs: number | undefined;
    if (showBattleFields) {
      reps = Number.parseInt(targetReps.replace(/[^0-9]/g, ''), 10);
      secs = Number.parseInt(timeLimit.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(reps) || reps <= 0) {
        setFormError('Enter a valid target reps number.');
        return;
      }
      if (!Number.isFinite(secs) || secs <= 0) {
        setFormError('Enter a valid time limit in seconds.');
        return;
      }
    }

    // Kill any lingering preview audio BEFORE upload / navigation
    stopMedia();

    // Paint loading UI first, then run upload after the next idle/frame
    setUploading(true);
    setUploadPct(0);
    const localVideoUri: string | null = videoUri || null;

    await yieldToUI();

    try {
      let publicCloudUrl: string | null = null;

      // Modes with a clip MUST get a cloud HTTPS URL — never save a broken local-only post
      const requiresCloudVideo = Boolean(localVideoUri) && mode !== 'BATTLE_BAWAAL';

      if (localVideoUri && isRemoteHttpsUri(localVideoUri)) {
        publicCloudUrl =
          ensurePublicBawaalVideoUrl(localVideoUri) || localVideoUri.trim();
        setUploadPct(100);
      } else if (localVideoUri) {
        const uploaded = await uploadClipOrAbort(localVideoUri);
        publicCloudUrl = uploaded
          ? ensurePublicBawaalVideoUrl(uploaded) || uploaded
          : null;
        if (!publicCloudUrl) {
          Alert.alert(
            'Upload failed',
            uploadErrorDetail
              ? `Could not upload to BAWAAL cloud storage:\n${uploadErrorDetail}`
              : 'Could not upload a playable video to BAWAAL cloud storage. Your post was not published.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (requiresCloudVideo) {
        Alert.alert('Missing clip', 'Record a video before posting.', [{ text: 'OK' }]);
        return;
      }

      // Exact public URL: .../storage/v1/object/public/bawaalvideos/battles/...
      const playbackUri = publicCloudUrl
        ? ensurePublicBawaalVideoUrl(publicCloudUrl) || publicCloudUrl
        : null;
      if (requiresCloudVideo && !playbackUri) {
        console.error(
          '[PostCreationSheet] aborting post — missing publicCloudUrl after upload'
        );
        Alert.alert(
          'Upload failed',
          'Video upload did not complete. Your post was not published.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (
        playbackUri &&
        /\/storage\/v1\/object\//.test(playbackUri) &&
        !playbackUri.includes('/object/public/')
      ) {
        console.error(
          '[PostCreationSheet] refusing non-public Storage URL:',
          playbackUri
        );
        Alert.alert(
          'Upload failed',
          'Cloud video URL is missing /public/ and cannot play. Post was not published.',
          [{ text: 'OK' }]
        );
        return;
      }
      console.log('[PostCreationSheet] public playback URL:', playbackUri);

      const payload: PostCreationPayload = {
        mode,
        videoUri: playbackUri,
        localVideoUri,
        publicCloudUrl: playbackUri,
        remoteVideoUri: playbackUri,
        title: trimmed,
        slowMoEnabled: !!slowMoEnabled,
        slowMoRate: slowMoEnabled ? safeNum(slowMoRate, 0.5) : 1,
        slowMoStartSec: safeNum(slowMoStartSec, 0),
        slowMoEndSec: safeNum(slowMoEndSec, safeNum(durationSec, 30)),
        durationSec: safeNum(durationSec, 30),
        uploadSkipped: false,
      };

      if (showTaglines) payload.tagline = tagline;
      if (showBattleFields) {
        payload.targetReps = reps;
        payload.timeLimitSec = secs;
      }

      const dispatched = await dispatchToFeeds(payload);
      console.log(
        '[PostCreationSheet] feed dispatch ok:',
        dispatched?.feedTarget,
        dispatched?.newPost?.id,
        dispatched?.newPost?.videoUri || dispatched?.videoUri
      );
      if (dispatched?.newPost?._persistOk === false) {
        const detail = String(
          dispatched?.newPost?._persistError || 'Unknown database error'
        );
        console.error(
          '[PostCreationSheet] cloud DB persist failed after storage upload:',
          detail
        );
        Alert.alert(
          'Cloud save failed',
          `Video reached storage, but the Arena database row failed:\n\n${detail}`,
          [{ text: 'OK' }]
        );
      } else if (dispatched?.newPost?._persistWarning) {
        // Soft success — Storage meta fallback while bawaal_posts is missing
        console.warn(
          '[PostCreationSheet] persist warning:',
          dispatched.newPost._persistWarning
        );
        Alert.alert(
          'Posted to cloud',
          `Your video is live. For full Arena database posts, run ENSURE_BAWAAL_POSTS.sql in the Supabase SQL editor once.\n\n${dispatched.newPost._persistWarning}`,
          [{ text: 'OK' }]
        );
      }
      setPendingPayload(dispatched);
      setSuccessVisible(true);
    } catch (err) {
      console.error('[PostCreationSheet] post failed:', err);
      Alert.alert(
        'Could not post',
        'Something went wrong while publishing. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={styles.dismissHit}
        activeOpacity={1}
        onPress={() => {
          stopMedia();
          onClose();
        }}
        accessibilityLabel="Dismiss post sheet"
      />

      <View
        style={[
          styles.sheetContainer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {headerForMode(mode)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              stopMedia();
              onClose();
            }}
            hitSlop={12}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.clipHintRow}>
          <Text style={styles.clipHint} numberOfLines={1}>
            🎬 {clipHint}
            {slowMoEnabled ? ' · SLOW-MO REGION ON' : ''}
          </Text>
          {linkedGalleryAssetId ? (
            <GalleryDeleteButton
              compact
              assetId={linkedGalleryAssetId}
              label="Delete this clip only"
              onDeleted={(id: string) => {
                setClearedGalleryAssetId(id || linkedGalleryAssetId);
                onGalleryAssetDeleted?.();
              }}
            />
          ) : null}
        </View>

        <InlineError message={formError} onDismiss={() => setFormError('')} />

        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Title / Hype Phrase</Text>
          <TextInput
            style={styles.input}
            placeholder={titlePlaceholder(mode)}
            placeholderTextColor="#64748B"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            returnKeyType="done"
          />

          {showTaglines && (
            <>
              <Text style={styles.label}>Sporty Tagline</Text>
              <View style={styles.tagRow}>
                {SPARTY_TAGLINES.map((tag) => {
                  const active = tagline === tag;
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, active && styles.activeTagChip]}
                      onPress={() => setTagline(tag)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.tagText, active && styles.activeTagText]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {showBattleFields && (
            <View style={styles.battleFieldsRow}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Target Reps</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={targetReps}
                  onChangeText={setTargetReps}
                  maxLength={4}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Time Limit (sec)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={timeLimit}
                  onChangeText={setTimeLimit}
                  maxLength={4}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.postBtn, uploading && styles.postBtnDisabled]}
            onPress={() => {
              void handlePost();
            }}
            activeOpacity={0.9}
            disabled={uploading}
          >
            {uploading ? (
              <View style={styles.postBtnRow}>
                <ActivityIndicator color="#000000" size="small" />
                <Text style={styles.postBtnText}>
                  {uploadPct > 0 ? `UPLOADING ${uploadPct}%` : 'UPLOADING…'}
                </Text>
              </View>
            ) : (
              <Text style={styles.postBtnText}>
                {showBattleFields ? 'POST TO BATTLES' : 'POST TO ARENA'}
              </Text>
            )}
          </TouchableOpacity>

          {uploading ? (
            <View style={styles.uploadTrack} accessibilityLabel="Upload progress">
              <View
                style={[
                  styles.uploadFill,
                  { width: `${Math.max(4, Math.min(100, uploadPct))}%` },
                ]}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>

      {/* Full-sheet loading veil — keeps UI responsive while native upload runs */}
      {uploading ? (
        <View style={styles.uploadVeil} pointerEvents="auto">
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.uploadVeilText}>
            {uploadPct > 0
              ? `Uploading to BAWAAL cloud… ${uploadPct}%`
              : 'Preparing upload…'}
          </Text>
        </View>
      ) : null}

      <BawaalSuccessModal
        visible={successVisible}
        mode={mode}
        onDone={finishSuccess}
      />
    </KeyboardAvoidingView>
  );
}

export default PostCreationSheet;

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  dismissHit: { ...ABSOLUTE_FILL },
  sheetContainer: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderColor: ACCENT,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555555',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    color: ACCENT,
    fontSize: 16,
    fontWeight: '800',
  },
  closeText: { color: '#A3A3A3', fontSize: 18, fontWeight: '700' },
  clipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  clipHint: { color: '#737373', fontSize: 11, flex: 1 },
  inlineError: {
    backgroundColor: 'rgba(255,59,48,0.18)',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  inlineErrorText: { color: '#FF8A80', fontSize: 12, fontWeight: '700' },
  formContent: { gap: 14, paddingBottom: 8 },
  label: {
    color: '#A3A3A3',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#111111',
    color: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 14,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeTagChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#FFFFFF',
  },
  tagText: { color: '#A3A3A3', fontSize: 11, fontWeight: '700' },
  activeTagText: { color: '#FFFFFF' },
  battleFieldsRow: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  postBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  postBtnDisabled: {
    opacity: 0.7,
  },
  postBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  uploadTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 10,
  },
  uploadFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  uploadVeil: {
    ...ABSOLUTE_FILL,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 20,
  },
  uploadVeilText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  successOverlay: {
    ...ABSOLUTE_FILL,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: SHEET_BG,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: 'center',
  },
  successLogo: { width: 120, height: 48, marginBottom: 8 },
  successEyebrow: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  successTitle: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  successSub: {
    color: '#A3A3A3',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  successBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.6,
  },
});
