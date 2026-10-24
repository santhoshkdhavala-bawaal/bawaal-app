/**
 * PostCreationSheet — Arena / Battles dispatch + branded BAWAAL success modal.
 * Closes modals safely (setTimeout) before onSuccess / navigation to prevent crashes.
 */
import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addPost as addArenaPost, pushArenaPost } from './arenaFeedStore';
import {
  pushBattleChallenge,
  pushHotFeatureBattle,
} from './battlesFeedStore';

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
  title: string;
  tagline?: SportyTagline;
  targetReps?: number;
  timeLimitSec?: number;
  slowMoEnabled?: boolean;
  slowMoRate?: number;
  slowMoStartSec?: number;
  slowMoEndSec?: number;
  durationSec?: number;
  feedTarget?: 'ARENA' | 'BATTLES';
  newPost?: FeedPostCard;
};

export type PostCreationSheetProps = {
  mode: CreationMode;
  videoUri: string | null;
  slowMoEnabled?: boolean;
  slowMoRate?: number;
  slowMoStartSec?: number;
  slowMoEndSec?: number;
  durationSec?: number;
  onClose: () => void;
  onSuccess: (payload?: PostCreationPayload) => void;
};

const NEON_ORANGE = '#FF5722';

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
export function dispatchToFeeds(
  payload: PostCreationPayload
): PostCreationPayload {
  const timestamp = Date.now();
  const videoUri =
    typeof payload.videoUri === 'string' && payload.videoUri.length > 0
      ? payload.videoUri
      : null;
  const title = safeStr(payload.title, 'BAWAAL Drop');

  if (payload.mode === 'SPARKS' || payload.mode === 'JOSH') {
    const arenaPayload = {
      id: `arena-${payload.mode.toLowerCase()}-${timestamp}`,
      type: 'reel' as const,
      mode: payload.mode,
      uri: videoUri,
      videoUri,
      recordedVideoUri: videoUri,
      localVideoUri: videoUri,
      title,
      caption: payload.tagline ? `${title} ${payload.tagline}` : title,
      tagline: payload.tagline || '#DailyGrind',
      creator: 'You',
      author: '@you',
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
    // Prefer addPost alias — never throws; falls back to pushArenaPost
    const arenaCard =
      addArenaPost(arenaPayload) || pushArenaPost(arenaPayload) || arenaPayload;

    const newPost: FeedPostCard = {
      id: safeStr(arenaCard?.id, `arena-${timestamp}`),
      mode: payload.mode,
      videoUri,
      title,
      caption: safeStr(arenaCard?.caption, title),
      tagline: payload.tagline,
      timestamp,
      feedTarget: 'ARENA',
      ...(arenaCard || {}),
    };

    return { ...payload, title, videoUri, feedTarget: 'ARENA', newPost };
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
      videoUri,
      title,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      feedTarget: 'BATTLES',
      ...(battleCard || {}),
    };

    return { ...payload, title, videoUri, feedTarget: 'BATTLES', newPost };
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
      videoUri,
      title,
      targetReps: safeNum(payload.targetReps, 50),
      timeLimit: safeNum(payload.timeLimitSec, 30),
      timeLimitSec: safeNum(payload.timeLimitSec, 30),
      timestamp,
      feedTarget: 'BATTLES',
      ...(hotCard || {}),
    };

    return { ...payload, title, videoUri, feedTarget: 'BATTLES', newPost };
  }

  return {
    ...payload,
    title,
    videoUri,
    newPost: {
      id: `post-${timestamp}`,
      mode: payload.mode,
      videoUri,
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
  onClose,
  onSuccess,
}: PostCreationSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState<SportyTagline>('#DailyGrind');
  const [targetReps, setTargetReps] = useState('50');
  const [timeLimit, setTimeLimit] = useState(
    String(durationSec && durationSec > 0 ? durationSec : 30)
  );
  const [formError, setFormError] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PostCreationPayload | null>(
    null
  );

  const showTaglines = mode === 'SPARKS' || mode === 'JOSH';
  const showBattleFields =
    mode === 'BATTLE_REWIND' || mode === 'BATTLE_BAWAAL';

  const clipHint = useMemo(() => {
    if (!videoUri) return 'No clip attached';
    const short = videoUri.split('/').pop() || videoUri;
    return short.length > 42 ? `${short.slice(0, 39)}…` : short;
  }, [videoUri]);

  const finishSuccess = () => {
    const payload = pendingPayload;
    setSuccessVisible(false);
    setPendingPayload(null);
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

  const handlePost = () => {
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

    const payload: PostCreationPayload = {
      mode,
      videoUri: videoUri || null,
      title: trimmed,
      slowMoEnabled: !!slowMoEnabled,
      slowMoRate: slowMoEnabled ? safeNum(slowMoRate, 0.5) : 1,
      slowMoStartSec: safeNum(slowMoStartSec, 0),
      slowMoEndSec: safeNum(slowMoEndSec, safeNum(durationSec, 30)),
      durationSec: safeNum(durationSec, 30),
    };

    if (showTaglines) payload.tagline = tagline;

    if (showBattleFields) {
      const reps = Number.parseInt(targetReps.replace(/[^0-9]/g, ''), 10);
      const secs = Number.parseInt(timeLimit.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(reps) || reps <= 0) {
        setFormError('Enter a valid target reps number.');
        return;
      }
      if (!Number.isFinite(secs) || secs <= 0) {
        setFormError('Enter a valid time limit in seconds.');
        return;
      }
      payload.targetReps = reps;
      payload.timeLimitSec = secs;
    }

    try {
      const dispatched = dispatchToFeeds(payload);
      setPendingPayload(dispatched);
      setSuccessVisible(true);
    } catch (err) {
      console.error('[PostCreationSheet] dispatch failed:', err);
      setFormError('Could not post. Please try again.');
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
        onPress={onClose}
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
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.clipHint} numberOfLines={1}>
          🎬 {clipHint}
          {slowMoEnabled ? ' · SLOW-MO REGION ON' : ''}
        </Text>

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
            style={styles.postBtn}
            onPress={handlePost}
            activeOpacity={0.9}
          >
            <Text style={styles.postBtnText}>
              {showBattleFields ? 'POST TO BATTLES' : 'POST TO ARENA'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderColor: '#1F293D',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  closeText: { color: '#94A3B8', fontSize: 18, fontWeight: '700' },
  clipHint: { color: '#64748B', fontSize: 11, marginBottom: 10 },
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
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#0A0E1A',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTagChip: {
    backgroundColor: NEON_ORANGE,
    borderColor: NEON_ORANGE,
  },
  tagText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  activeTagText: { color: '#FFFFFF' },
  battleFieldsRow: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  postBtn: {
    backgroundColor: NEON_ORANGE,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  successOverlay: {
    ...ABSOLUTE_FILL,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: NEON_ORANGE,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: 'center',
  },
  successLogo: { width: 120, height: 48, marginBottom: 8 },
  successEyebrow: {
    color: NEON_ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  successSub: {
    color: '#8A99AD',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  successBtn: {
    backgroundColor: NEON_ORANGE,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.6,
  },
});
