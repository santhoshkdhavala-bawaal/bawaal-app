/**
 * PostCreationSheet — publishes SPARKS/JOSH → Arena, REWIND/BAWAAL → Battles.
 * Always prepends into persistent feed stores and returns `newPost` via onSuccess.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pushArenaPost } from './arenaFeedStore';
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
  durationSec?: number;
  feedTarget?: 'ARENA' | 'BATTLES';
  /** Fully constructed card that was prepended to the feed store */
  newPost?: FeedPostCard;
};

export type PostCreationSheetProps = {
  mode: CreationMode;
  videoUri: string | null;
  slowMoEnabled?: boolean;
  slowMoRate?: number;
  durationSec?: number;
  onClose: () => void;
  /** Called with payload including `newPost` so Arena / Battles can refresh immediately */
  onSuccess: (payload?: PostCreationPayload) => void;
};

const NEON_ORANGE = '#FF5722';

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

/**
 * Build + prepend feed cards, then return payload with `newPost` for navigation refresh.
 */
export function dispatchToFeeds(
  payload: PostCreationPayload
): PostCreationPayload {
  const timestamp = Date.now();
  const videoUri = payload.videoUri || null;

  if (payload.mode === 'SPARKS' || payload.mode === 'JOSH') {
    const arenaCard = pushArenaPost({
      id: `arena-${payload.mode.toLowerCase()}-${timestamp}`,
      type: 'reel',
      mode: payload.mode,
      uri: videoUri,
      videoUri,
      recordedVideoUri: videoUri,
      localVideoUri: videoUri,
      title: payload.title,
      caption: payload.tagline
        ? `${payload.title} ${payload.tagline}`
        : payload.title,
      tagline: payload.tagline,
      creator: 'You',
      author: '@you',
      category: 'GYM',
      sport: 'GYM',
      target: payload.title,
      timestamp,
      createdAt: timestamp,
      durationSec: payload.durationSec || 30,
      slowMoEnabled: !!payload.slowMoEnabled,
      slowMoRate: payload.slowMoRate ?? 1,
      hypeCount: 0,
      feed: 'ARENA',
    });

    const newPost: FeedPostCard = {
      ...(arenaCard as object),
      id: arenaCard?.id || `arena-${timestamp}`,
      mode: payload.mode,
      videoUri,
      title: payload.title,
      caption: arenaCard?.caption || payload.title,
      tagline: payload.tagline,
      timestamp,
      feedTarget: 'ARENA',
    };

    return { ...payload, feedTarget: 'ARENA', newPost };
  }

  if (payload.mode === 'BATTLE_REWIND') {
    const battleCard = pushBattleChallenge({
      id: `rewind-${timestamp}`,
      sport: 'GYM',
      title: payload.title,
      target: payload.title,
      description: payload.tagline || null,
      host: '@MUMBAI_STRIKER',
      responses: 0,
      status: 'OPEN',
      videoUri: videoUri || undefined,
      targetReps: payload.targetReps,
      timeLimit: payload.timeLimitSec,
      timeLimitSec: payload.timeLimitSec,
      timestamp,
      source: 'BATTLE_REWIND',
      isHotFeature: false,
    });

    const newPost: FeedPostCard = {
      ...(battleCard as object),
      id: battleCard?.id || `rewind-${timestamp}`,
      mode: 'BATTLE_REWIND',
      videoUri,
      title: payload.title,
      targetReps: payload.targetReps,
      timeLimit: payload.timeLimitSec,
      timeLimitSec: payload.timeLimitSec,
      timestamp,
      feedTarget: 'BATTLES',
    };

    return { ...payload, feedTarget: 'BATTLES', newPost };
  }

  if (payload.mode === 'BATTLE_BAWAAL') {
    const hotCard = pushHotFeatureBattle({
      id: `live-bawaal-${timestamp}`,
      challengeTitle: payload.title,
      title: payload.title,
      target: payload.title,
      host: '@MUMBAI_STRIKER',
      hostFlag: '🇮🇳',
      hostLabel: 'INDIA',
      videoUri: videoUri || undefined,
      targetReps: payload.targetReps,
      timeLimit: payload.timeLimitSec,
      timeLimitSec: payload.timeLimitSec,
      timestamp,
      status: 'LIVE',
      isHotFeature: true,
      source: 'BATTLE_BAWAAL',
    });

    const newPost: FeedPostCard = {
      ...(hotCard as object),
      id: hotCard?.id || `live-bawaal-${timestamp}`,
      mode: 'BATTLE_BAWAAL',
      videoUri,
      title: payload.title,
      targetReps: payload.targetReps,
      timeLimit: payload.timeLimitSec,
      timeLimitSec: payload.timeLimitSec,
      timestamp,
      feedTarget: 'BATTLES',
    };

    return { ...payload, feedTarget: 'BATTLES', newPost };
  }

  return payload;
}

function PostCreationSheet({
  mode,
  videoUri,
  slowMoEnabled = false,
  slowMoRate = 0.5,
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

  const showTaglines = mode === 'SPARKS' || mode === 'JOSH';
  const showBattleFields =
    mode === 'BATTLE_REWIND' || mode === 'BATTLE_BAWAAL';

  const clipHint = useMemo(() => {
    if (!videoUri) return 'No clip attached';
    const short = videoUri.split('/').pop() || videoUri;
    return short.length > 42 ? `${short.slice(0, 39)}…` : short;
  }, [videoUri]);

  const handlePost = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Missing Title', 'Please give your post a quick title!');
      return;
    }

    if (!videoUri && mode !== 'BATTLE_BAWAAL') {
      Alert.alert('Missing Clip', 'Record a video before posting.');
      return;
    }

    const payload: PostCreationPayload = {
      mode,
      videoUri,
      title: trimmed,
      slowMoEnabled,
      slowMoRate: slowMoEnabled ? slowMoRate : 1,
      durationSec,
    };

    if (showTaglines) {
      payload.tagline = tagline;
    }

    if (showBattleFields) {
      const reps = Number.parseInt(targetReps.replace(/[^0-9]/g, ''), 10);
      const secs = Number.parseInt(timeLimit.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(reps) || reps <= 0) {
        Alert.alert('Target Reps', 'Enter a valid target reps number.');
        return;
      }
      if (!Number.isFinite(secs) || secs <= 0) {
        Alert.alert('Time Limit', 'Enter a valid time limit in seconds.');
        return;
      }
      payload.targetReps = reps;
      payload.timeLimitSec = secs;
    }

    const dispatched = dispatchToFeeds(payload);
    const destination =
      dispatched.feedTarget === 'BATTLES'
        ? 'BAWAAL Battles'
        : 'BAWAAL Arena';

    Alert.alert('🔥 Success!', `${mode} posted to ${destination}!`, [
      {
        text: 'OK',
        onPress: () => onSuccess(dispatched),
      },
    ]);
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
          {slowMoEnabled ? ' · SLOW-MO ON' : ''}
        </Text>

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
  clipHint: { color: '#64748B', fontSize: 11, marginBottom: 14 },
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
});
