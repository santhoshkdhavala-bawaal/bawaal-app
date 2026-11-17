import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ARENA_DASHBOARD_CATEGORY_PILLS,
  GAME_ON_SPORT_SECTIONS,
} from '../constants/gameOnSports';

export type ArenaTier =
  | 'reel'
  | 'story'
  | 'group_battle'
  | 'dark_arena'
  | 'pro_faceoff'
  | 'war_cry_live';

/** Arena landing shelves — maps to dashboard Supabase tables. */
export type ArenaShelf =
  | 'sparks_josh'
  | 'battle_bawaal'
  | 'face_off';

export type DestinationPublishPayload = {
  tier: ArenaTier;
  title: string;
  hashtag: string;
  category: string;
  shelf: ArenaShelf;
  sport: string;
};

const ACCENT = '#FF5500';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const CARD = '#1A1A1A';
const BG = '#0A0A0A';

const CATEGORY_OPTIONS = ARENA_DASHBOARD_CATEGORY_PILLS.filter(
  (label) => label !== 'All'
);

const SHELF_OPTIONS: { id: ArenaShelf; title: string; hint: string }[] = [
  {
    id: 'sparks_josh',
    title: 'Sparks & Josh',
    hint: 'Stories + reels shelf',
  },
  {
    id: 'battle_bawaal',
    title: 'Battle Bawaal',
    hint: 'Group battle shelf',
  },
  {
    id: 'face_off',
    title: 'Face Off',
    hint: 'Open response challenges',
  },
];

function defaultShelfForMode(mode?: string | null): ArenaShelf {
  const m = String(mode || '').toUpperCase();
  if (m === 'FACEOFF' || m === 'DARK_ARENA') return 'face_off';
  if (m === 'BAWAAL_BATTLE' || m === 'BATTLE_REWIND') return 'battle_bawaal';
  return 'sparks_josh';
}

function defaultTierForMode(mode?: string | null): ArenaTier {
  const m = String(mode || '').toUpperCase();
  if (m === 'SPARKS') return 'story';
  if (m === 'FACEOFF') return 'pro_faceoff';
  if (m === 'BAWAAL_BATTLE' || m === 'BATTLE_REWIND') return 'group_battle';
  if (m === 'DARK_ARENA') return 'dark_arena';
  return 'reel';
}

/** First sport label inside a GAME ON section (fallback OTHERS). */
function sportSeedForCategory(categoryTitle: string): string {
  const section = GAME_ON_SPORT_SECTIONS.find((s) => s.title === categoryTitle);
  if (section?.sports?.[0]) return String(section.sports[0]).toUpperCase();
  return 'OTHERS';
}

interface CreationDestinationProps {
  videoUri: string;
  isProUser: boolean;
  /** Active Hub mode — seeds shelf / tier defaults. */
  mode?: string | null;
  onPublish: (payload: DestinationPublishPayload) => void;
}

export const PostDestinationSelector: React.FC<CreationDestinationProps> = ({
  videoUri: _videoUri,
  isProUser,
  mode = null,
  onPublish,
}) => {
  const [selectedTier, setSelectedTier] = useState<ArenaTier>(() =>
    defaultTierForMode(mode)
  );
  const [selectedShelf, setSelectedShelf] = useState<ArenaShelf>(() =>
    defaultShelfForMode(mode)
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    CATEGORY_OPTIONS[0] || 'Others'
  );
  const [title, setTitle] = useState('');
  const [hashtag, setHashtag] = useState('');

  const sport = useMemo(
    () => sportSeedForCategory(selectedCategory),
    [selectedCategory]
  );

  const handleTierSelect = (tier: ArenaTier) => {
    if ((tier === 'pro_faceoff' || tier === 'war_cry_live') && !isProUser) {
      Alert.alert(
        'Pro Arena Locked',
        'Face Off and War Cry are reserved for verified Pro Athletes.'
      );
      return;
    }
    setSelectedTier(tier);
    if (tier === 'story' || tier === 'reel') setSelectedShelf('sparks_josh');
    if (tier === 'group_battle') setSelectedShelf('battle_bawaal');
    if (tier === 'pro_faceoff' || tier === 'dark_arena') {
      setSelectedShelf('face_off');
    }
  };

  const handlePublish = () => {
    if (!title.trim()) {
      Alert.alert(
        'Missing Title',
        'Please enter a title for your post or challenge.'
      );
      return;
    }

    const isChallengeTier =
      selectedTier === 'dark_arena' || selectedTier === 'pro_faceoff';
    if (isChallengeTier && !hashtag.trim()) {
      Alert.alert(
        'Missing Hashtag',
        'Challenges require a custom hashtag (e.g. 100PushUpWar).'
      );
      return;
    }

    const formattedHashtag = hashtag.replace('#', '').trim();

    onPublish({
      tier: selectedTier,
      title: title.trim(),
      hashtag: formattedHashtag,
      category: selectedCategory,
      shelf: selectedShelf,
      sport,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>Select Destination</Text>
      <Text style={styles.subTitle}>
        Tag category + shelf, then drop into Arena
      </Text>

      <Text style={styles.sectionHeader}>ARENA CATEGORY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        keyboardShouldPersistTaps="handled"
      >
        {CATEGORY_OPTIONS.map((label) => {
          const active = selectedCategory === label;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setSelectedCategory(label)}
              activeOpacity={0.85}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionHeader}>TARGET SHELF</Text>
      {SHELF_OPTIONS.map((shelf) => {
        const active = selectedShelf === shelf.id;
        return (
          <TouchableOpacity
            key={shelf.id}
            style={[styles.fullCard, active && styles.selectedCard]}
            onPress={() => setSelectedShelf(shelf.id)}
            activeOpacity={0.88}
          >
            <Text style={styles.cardTitle}>{shelf.title}</Text>
            <Text style={styles.cardDesc}>{shelf.hint}</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.sectionHeader}>STANDARD SOCIAL</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.card, selectedTier === 'reel' && styles.selectedCard]}
          onPress={() => handleTierSelect('reel')}
        >
          <Text style={styles.cardTitle}>Reel</Text>
          <Text style={styles.cardDesc}>Main social feed clip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, selectedTier === 'story' && styles.selectedCard]}
          onPress={() => handleTierSelect('story')}
        >
          <Text style={styles.cardTitle}>Story</Text>
          <Text style={styles.cardDesc}>24-hour temporary post</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>BAWAAL BATTLES & ARENAS</Text>

      <TouchableOpacity
        style={[
          styles.fullCard,
          selectedTier === 'group_battle' && styles.selectedCard,
        ]}
        onPress={() => handleTierSelect('group_battle')}
      >
        <Text style={styles.cardTitle}>Bawaal Battle</Text>
        <Text style={styles.cardDesc}>
          Group sync for gyms, teams, and squads
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.fullCard,
          selectedTier === 'dark_arena' && styles.selectedCard,
        ]}
        onPress={() => handleTierSelect('dark_arena')}
      >
        <Text style={styles.cardTitle}>Dark Arena</Text>
        <Text style={styles.cardDesc}>
          Open call challenge — Gladiator & First Blood
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.fullCard,
          selectedTier === 'pro_faceoff' && styles.selectedCard,
          !isProUser && styles.lockedCard,
        ]}
        onPress={() => handleTierSelect('pro_faceoff')}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Face Off</Text>
          {!isProUser && <Text style={styles.lockBadge}>PRO ONLY</Text>}
        </View>
        <Text style={styles.cardDesc}>Async 1v1 showdown for verified pros</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.fullCard,
          selectedTier === 'war_cry_live' && styles.selectedCard,
          !isProUser && styles.lockedCard,
        ]}
        onPress={() => handleTierSelect('war_cry_live')}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>War Cry</Text>
          {!isProUser && <Text style={styles.lockBadge}>PRO LIVE</Text>}
        </View>
        <Text style={styles.cardDesc}>Real-time 1v1 live battle stream</Text>
      </TouchableOpacity>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 100 Push-ups in 30 Seconds!"
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
        />

        {(selectedTier === 'dark_arena' || selectedTier === 'pro_faceoff') && (
          <>
            <Text style={styles.inputLabel}>Challenge Hashtag</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100PushUpWar"
              placeholderTextColor="#666"
              value={hashtag}
              onChangeText={setHashtag}
              autoCapitalize="none"
            />
          </>
        )}
      </View>

      <TouchableOpacity style={styles.publishBtn} onPress={handlePublish}>
        <Text style={styles.publishBtnText}>PUBLISH TO ARENA</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: WHITE },
  subTitle: { fontSize: 13, color: MUTED, marginBottom: 16, marginTop: 4 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: ACCENT,
    marginTop: 14,
    marginBottom: 10,
    letterSpacing: 1.2,
  },
  pillRow: {
    paddingBottom: 6,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: CARD,
    marginRight: 8,
  },
  pillActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(255,85,0,0.16)',
  },
  pillText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  pillTextActive: {
    color: WHITE,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    flex: 0.48,
    backgroundColor: CARD,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  fullCard: {
    backgroundColor: CARD,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 10,
  },
  selectedCard: { borderColor: ACCENT, backgroundColor: 'rgba(255,85,0,0.12)' },
  lockedCard: { opacity: 0.6 },
  cardTitle: { color: WHITE, fontSize: 15, fontWeight: '800' },
  cardDesc: { color: '#999', fontSize: 12, marginTop: 4 },
  lockBadge: {
    backgroundColor: ACCENT,
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  inputSection: { marginTop: 12 },
  inputLabel: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: CARD,
    color: WHITE,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 14,
  },
  publishBtn: {
    backgroundColor: ACCENT,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  publishBtnText: { color: WHITE, fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
});

export default PostDestinationSelector;
