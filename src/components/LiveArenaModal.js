/**
 * Live Arena Hub — list live matches + 5-second GO LIVE setup.
 * Theme: #08120F / #FF5A1F / #E53935
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  listLiveMatches,
  subscribeLiveMatchList,
  createLiveMatch,
} from '../services/liveMatchService';
import {
  LIVE_MATCH_SPORTS,
  DEFAULT_LIVE_MATCH_SPORT,
} from '../constants/liveMatchSports';
import { getActiveUser } from '../services/activeUserProfile';

const BG = '#08120F';
const CARD = '#0F1A16';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const INPUT = '#12201B';

function MatchCard({ item, onPress }) {
  const watching = Math.max(0, Number(item.watching) || 0);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${item.team_a_name} versus ${item.team_b_name}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>{item.sport || 'LIVE'}</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.vsTitle} numberOfLines={1}>
        {item.team_a_name || 'TEAM A'} vs {item.team_b_name || 'TEAM B'}
      </Text>
      {item.title ? (
        <Text style={styles.matchTitle} numberOfLines={1}>
          {item.title}
        </Text>
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.scoreText}>
          {item.score_a ?? 0} — {item.score_b ?? 0}
        </Text>
        <View style={styles.watchRow}>
          <Ionicons name="eye-outline" size={14} color={MUTED} />
          <Text style={styles.watchText}>
            {watching > 0 ? watching : 'LIVE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GoLiveSetup({ onBack, onStarted }) {
  const [sport, setSport] = useState(DEFAULT_LIVE_MATCH_SPORT);
  const [teamA, setTeamA] = useState('TEAM A');
  const [teamB, setTeamB] = useState('TEAM B');
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const user = getActiveUser();
      const result = await createLiveMatch({
        hostId: String(user?.id || user?.userId || `local:${Date.now()}`),
        hostHandle: String(user?.handle || user?.username || 'athlete').replace(
          /^@/,
          ''
        ),
        sport,
        title,
        teamAName: teamA,
        teamBName: teamB,
      });
      if (result?.match) {
        onStarted?.(result.match);
        return;
      }
    } finally {
      setStarting(false);
    }
  }, [starting, sport, title, teamA, teamB, onStarted]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.setupWrap}
    >
      <View style={styles.setupHeader}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to live list"
        >
          <Text style={styles.backLink}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.setupTitle}>GO LIVE</Text>
        <View style={{ width: 48 }} />
      </View>

      <Text style={styles.fieldLabel}>SPORT</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sportRow}
      >
        {LIVE_MATCH_SPORTS.map((s) => {
          const active = s === sport;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.sportPill, active && styles.sportPillActive]}
              onPress={() => setSport(s)}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.sportPillText, active && styles.sportPillTextActive]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.fieldLabel}>TEAM A</Text>
      <TextInput
        style={styles.input}
        value={teamA}
        onChangeText={setTeamA}
        placeholder="TEAM A"
        placeholderTextColor={MUTED}
        maxLength={32}
        autoCapitalize="characters"
      />

      <Text style={styles.fieldLabel}>TEAM B</Text>
      <TextInput
        style={styles.input}
        value={teamB}
        onChangeText={setTeamB}
        placeholder="TEAM B"
        placeholderTextColor={MUTED}
        maxLength={32}
        autoCapitalize="characters"
      />

      <Text style={styles.fieldLabel}>TITLE (OPTIONAL)</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Friendly School Match"
        placeholderTextColor={MUTED}
        maxLength={80}
      />

      <TouchableOpacity
        style={[styles.startBtn, starting && styles.startBtnDisabled]}
        onPress={handleStart}
        activeOpacity={0.9}
        disabled={!!starting}
        accessibilityRole="button"
        accessibilityLabel="Start live telecast"
      >
        {starting ? (
          <ActivityIndicator color={WHITE} />
        ) : (
          <Text style={styles.startBtnText}>START LIVE TELECAST</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function LiveArenaModal({ visible, onClose, onGoLive, onWatchMatch }) {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('hub'); // hub | setup

  // When closed, always present hub (mode reset happens on close / back presses)
  const sheetVisible = !!visible;
  const effectiveMode = sheetVisible ? mode : 'hub';

  useEffect(() => {
    if (!sheetVisible) return undefined;
    let alive = true;
    void listLiveMatches()
      .then((list) => {
        if (!alive) return;
        setMatches(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const unsub = subscribeLiveMatchList((list) => {
      if (!alive) return;
      setMatches(Array.isArray(list) ? list : []);
      setLoading(false);
    });
    return () => {
      alive = false;
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [sheetVisible]);

  const openSetup = useCallback(() => {
    setMode('setup');
  }, []);

  const closeSetup = useCallback(() => {
    setMode('hub');
  }, []);

  const handleStarted = useCallback(
    (match) => {
      onClose?.();
      onGoLive?.(match);
    },
    [onClose, onGoLive]
  );

  const handleWatch = useCallback(
    (match) => {
      onClose?.();
      onWatchMatch?.(match);
    },
    [onClose, onWatchMatch]
  );

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity
          style={styles.scrimHit}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close Live Arena Hub"
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              maxHeight: '92%',
            },
          ]}
        >
          <View style={styles.handle} />

          {effectiveMode === 'setup' ? (
            <GoLiveSetup
              onBack={closeSetup}
              onStarted={handleStarted}
            />
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>LIVE ARENA</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode('hub');
                    onClose?.();
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={WHITE} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.goLiveBtn}
                onPress={openSetup}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Go live now"
              >
                <Text style={styles.goLiveText}>+ GO LIVE NOW</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>ACTIVE TELECASTS</Text>

              {loading && matches.length === 0 ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={matches}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <MatchCard item={item} onPress={handleWatch} />
                  )}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      No live matches yet. Be the first — GO LIVE NOW.
                    </Text>
                  }
                  windowSize={5}
                  maxToRenderPerBatch={8}
                  initialNumToRender={6}
                />
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  scrimHit: {
    flex: 1,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center', width: '100%' },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  goLiveBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
    marginBottom: 18,
  },
  goLiveText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 8,
    gap: 10,
  },
  emptyText: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.22)',
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sportBadge: {
    backgroundColor: 'rgba(255,90,31,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CRIMSON,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  liveChipText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
  },
  vsTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  matchTitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scoreText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  watchText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  setupWrap: {
    paddingBottom: 8,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backLink: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    width: 48,
  },
  setupTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 10,
  },
  sportRow: {
    gap: 8,
    paddingBottom: 4,
  },
  sportPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: INPUT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sportPillActive: {
    backgroundColor: CRIMSON,
    borderColor: ORANGE,
  },
  sportPillText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  sportPillTextActive: {
    color: WHITE,
  },
  input: {
    backgroundColor: INPUT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14,
    fontWeight: '700',
    outlineStyle: 'none',
  },
  startBtn: {
    marginTop: 22,
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  startBtnDisabled: {
    opacity: 0.65,
  },
  startBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
});

export default memo(LiveArenaModal);
