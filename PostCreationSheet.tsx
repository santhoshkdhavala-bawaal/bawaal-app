/**
 * PostCreationSheet — dark bottom sheet for publishing SPARKS / JOSH / BATTLE_REWIND clips.
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

export type PostCreationPayload = {
  mode: CreationMode;
  videoUri: string | null;
  title: string;
  tagline?: SportyTagline;
  targetReps?: number;
  timeLimitSec?: number;
};

export type PostCreationSheetProps = {
  mode: CreationMode;
  videoUri: string | null;
  onClose: () => void;
  onSuccess: (payload?: PostCreationPayload) => void;
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
    default:
      return 'Give it a hype phrase…';
  }
}

function PostCreationSheet({
  mode,
  videoUri,
  onClose,
  onSuccess,
}: PostCreationSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState<SportyTagline>('#DailyGrind');
  const [targetReps, setTargetReps] = useState('50');
  const [timeLimit, setTimeLimit] = useState('30');

  const showTaglines = mode === 'SPARKS' || mode === 'JOSH';
  const showBattleFields = mode === 'BATTLE_REWIND';

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

    const payload: PostCreationPayload = {
      mode,
      videoUri,
      title: trimmed,
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

    Alert.alert('🔥 Success!', `${mode} posted successfully to BAWAAL!`, [
      {
        text: 'OK',
        onPress: () => onSuccess(payload),
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
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.clipHint} numberOfLines={1}>
          🎬 {clipHint}
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
            accessibilityRole="button"
            accessibilityLabel="Publish to BAWAAL"
          >
            <Text style={styles.postBtnText}>POST TO BAWAAL</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

export default PostCreationSheet;

/** Mirrors StyleSheet.absoluteFillObject (typed as absoluteFill on this RN version). */
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
  dismissHit: {
    ...ABSOLUTE_FILL,
  },
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
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  clipHint: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 14,
  },
  formContent: {
    gap: 14,
    paddingBottom: 8,
  },
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTagChip: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  tagText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  activeTagText: {
    color: '#FFFFFF',
  },
  battleFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  postBtn: {
    backgroundColor: '#00BCD4',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  postBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
