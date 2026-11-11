import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';

export type ArenaTier =
  | 'reel'
  | 'story'
  | 'group_battle'
  | 'dark_arena'
  | 'pro_faceoff'
  | 'war_cry_live';

interface CreationDestinationProps {
  videoUri: string;
  isProUser: boolean;
  onPublish: (payload: {
    tier: ArenaTier;
    title: string;
    hashtag: string;
  }) => void;
}

export const PostDestinationSelector: React.FC<CreationDestinationProps> = ({
  videoUri: _videoUri,
  isProUser,
  onPublish,
}) => {
  const [selectedTier, setSelectedTier] = useState<ArenaTier>('dark_arena');
  const [title, setTitle] = useState('');
  const [hashtag, setHashtag] = useState('');

  const handleTierSelect = (tier: ArenaTier) => {
    if ((tier === 'pro_faceoff' || tier === 'war_cry_live') && !isProUser) {
      Alert.alert(
        'Pro Arena Locked 🥊',
        'Bawaal Faceoff and War Cry are reserved for verified Pro Athletes. Win 50 Dark Arena battles to unlock access!'
      );
      return;
    }
    setSelectedTier(tier);
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
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Select Destination</Text>
      <Text style={styles.subTitle}>Where are you dropping this video?</Text>

      <Text style={styles.sectionHeader}>STANDARD SOCIAL</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.card, selectedTier === 'reel' && styles.selectedCard]}
          onPress={() => handleTierSelect('reel')}
        >
          <Text style={styles.cardTitle}>📹 Reel</Text>
          <Text style={styles.cardDesc}>Main social feed clip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, selectedTier === 'story' && styles.selectedCard]}
          onPress={() => handleTierSelect('story')}
        >
          <Text style={styles.cardTitle}>⏱️ Story</Text>
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
        <Text style={styles.cardTitle}>👥 Bawaal Battle</Text>
        <Text style={styles.cardDesc}>
          Group sync fun for gyms, teams, and squads
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.fullCard,
          selectedTier === 'dark_arena' && styles.selectedCard,
        ]}
        onPress={() => handleTierSelect('dark_arena')}
      >
        <Text style={styles.cardTitle}>⚔️ Bawaal Dark Arena</Text>
        <Text style={styles.cardDesc}>
          Open call challenge! Gladiator & First Blood badges active
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
          <Text style={styles.cardTitle}>🥊 Bawaal Faceoff</Text>
          {!isProUser && <Text style={styles.lockBadge}>PRO ONLY</Text>}
        </View>
        <Text style={styles.cardDesc}>
          Async 1v1 showdown for verified pros
        </Text>
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
          <Text style={styles.cardTitle}>🔥 Bawaal War Cry</Text>
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
        <Text style={styles.publishBtnText}>Publish to BAWAAL</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subTitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3B30',
    marginTop: 15,
    marginBottom: 10,
    letterSpacing: 1,
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
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  fullCard: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 10,
  },
  selectedCard: { borderColor: '#FF3B30', backgroundColor: '#221111' },
  lockedCard: { opacity: 0.6 },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cardDesc: { color: '#999', fontSize: 12, marginTop: 4 },
  lockBadge: {
    backgroundColor: '#FF3B30',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  inputSection: { marginTop: 20 },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 15,
  },
  publishBtn: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

export default PostDestinationSelector;
