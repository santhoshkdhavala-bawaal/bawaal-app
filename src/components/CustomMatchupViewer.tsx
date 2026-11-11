/**
 * Custom Matchup Roster — pick any two challenge responses,
 * launch a side-by-side split-screen, and vote the head-to-head.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArenaClipPlayer from './ArenaClipPlayer';
import BackLink from './BackLink';
import {
  castCustomMatchupVote,
  fetchChallengeMatchupRoster,
  tallyMatchupVotes,
} from '../services/customMatchupService';

const BG = '#0A0A0A';
const CARD = '#141414';
const BORDER = '#262626';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ACCENT = '#FF3B30';
const GLOW = '#FF5722';
const CYAN = '#00E5FF';
const GOLD = '#FACC15';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 32 - GRID_GAP) / 2;

export type MatchupAthlete = {
  id: string;
  handle: string;
  displayName?: string;
  videoUri?: string | null;
  video_url?: string | null;
  uri?: string | null;
  votes?: number;
  isGladiator?: boolean;
  isFirstBlood?: boolean;
  athleteId?: string | null;
  challengeId?: string | null;
};

type ViewMode = 'roster' | 'matchup';

export type CustomMatchupViewerProps = {
  challengeId: string;
  /** Optional seed roster (used while cloud loads / offline). */
  initialResponses?: MatchupAthlete[];
  title?: string;
  onClose?: () => void;
  onVoteCast?: (payload: {
    fighterAId: string;
    fighterBId: string;
    votedForId: string;
  }) => void;
};

function Badge({ label, tone }: { label: string; tone: 'gold' | 'cyan' | 'red' }) {
  const bg =
    tone === 'gold' ? `${GOLD}22` : tone === 'cyan' ? `${CYAN}22` : `${ACCENT}22`;
  const color = tone === 'gold' ? GOLD : tone === 'cyan' ? CYAN : ACCENT;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function FighterTile({
  athlete,
  slot,
  selected,
  onPress,
}: {
  athlete: MatchupAthlete;
  slot: 1 | 2 | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tile,
        selected && styles.tileSelected,
        slot === 1 && styles.tileFighter1,
        slot === 2 && styles.tileFighter2,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.tileVideo}>
        {athlete.videoUri || athlete.video_url || athlete.uri ? (
          <ArenaClipPlayer
            uri={athlete.videoUri || athlete.video_url || athlete.uri || undefined}
            source={athlete}
            style={[styles.tilePlayer, styles.tilePlayerSize]}
            muted
            loop
            autoPlay={false}
            active={false}
            label={athlete.handle}
          />
        ) : (
          <View style={styles.tilePlaceholder}>
            <Text style={styles.tilePlaceholderText}>NO CLIP</Text>
          </View>
        )}
        {selected ? (
          <View style={styles.checkMark}>
            <Text style={styles.checkMarkText}>✓</Text>
            <Text style={styles.checkSlot}>
              {slot === 1 ? 'F1' : slot === 2 ? 'F2' : ''}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileHandle} numberOfLines={1}>
        {athlete.handle}
      </Text>
      <Text style={styles.tileVotes}>{athlete.votes ?? 0} VOTES</Text>
      <View style={styles.badgeRow}>
        {athlete.isGladiator ? <Badge label="GLADIATOR" tone="gold" /> : null}
        {athlete.isFirstBlood ? <Badge label="FIRST BLOOD" tone="cyan" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function SplitFighterPane({
  athlete,
  side,
  votes,
  active,
}: {
  athlete: MatchupAthlete;
  side: 'left' | 'right';
  votes: number;
  active: boolean;
}) {
  const accent = side === 'left' ? GLOW : CYAN;
  return (
    <View style={[styles.splitPane, { borderColor: accent }]}>
      <View style={styles.splitVideo}>
        <ArenaClipPlayer
          uri={athlete.videoUri || athlete.video_url || athlete.uri || undefined}
          source={athlete}
          style={[styles.splitPlayer, styles.splitPlayerSize]}
          muted={false}
          loop
          autoPlay
          active={active}
          label={athlete.handle}
        />
      </View>
      <View style={styles.splitMeta}>
        <Text style={[styles.splitRole, { color: accent }]}>
          {side === 'left' ? 'FIGHTER 1' : 'FIGHTER 2'}
        </Text>
        <Text style={styles.splitHandle} numberOfLines={1}>
          {athlete.handle}
        </Text>
        <Text style={styles.splitVotes}>{votes} VOTES</Text>
        <View style={styles.badgeRow}>
          {athlete.isGladiator ? <Badge label="GLADIATOR" tone="gold" /> : null}
          {athlete.isFirstBlood ? (
            <Badge label="FIRST BLOOD" tone="cyan" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CustomMatchupViewer({
  challengeId,
  initialResponses = [],
  title = 'CUSTOM MATCHUP',
  onClose,
  onVoteCast,
}: CustomMatchupViewerProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<MatchupAthlete[]>(initialResponses);
  const [allVotes, setAllVotes] = useState<Array<Record<string, unknown>>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('roster');
  const [voting, setVoting] = useState(false);
  const [myPick, setMyPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seedRef = React.useRef(initialResponses);
  seedRef.current = initialResponses;

  const loadRoster = useCallback(async () => {
    if (!challengeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const seed = seedRef.current || [];
    try {
      const result = await fetchChallengeMatchupRoster(challengeId);
      if (result.responses?.length) {
        setRoster(result.responses as MatchupAthlete[]);
      } else if (seed.length) {
        setRoster(seed);
      } else {
        setRoster([]);
      }
      setAllVotes((result.votes || []) as Array<Record<string, unknown>>);
      if (!result.ok && !seed.length) {
        setError('Could not load challenge responses. Pull to retry.');
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load roster');
      if (seed.length) setRoster(seed);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const fighter1 = useMemo(
    () => roster.find((r) => r.id === selectedIds[0]) || null,
    [roster, selectedIds]
  );
  const fighter2 = useMemo(
    () => roster.find((r) => r.id === selectedIds[1]) || null,
    [roster, selectedIds]
  );

  const matchupTallies = useMemo(() => {
    if (!fighter1 || !fighter2) return { votesA: 0, votesB: 0 };
    return tallyMatchupVotes(allVotes, fighter1.id, fighter2.id);
  }, [allVotes, fighter1, fighter2]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setViewMode('roster');
    setMyPick(null);
  }, []);

  const slotFor = useCallback(
    (id: string): 1 | 2 | null => {
      if (selectedIds[0] === id) return 1;
      if (selectedIds[1] === id) return 2;
      return null;
    },
    [selectedIds]
  );

  const launchMatchup = useCallback(() => {
    if (selectedIds.length !== 2) return;
    setViewMode('matchup');
    setMyPick(null);
  }, [selectedIds.length]);

  const backToRoster = useCallback(() => {
    setViewMode('roster');
    setMyPick(null);
  }, []);

  const castVote = useCallback(
    async (votedForId: string) => {
      if (!fighter1 || !fighter2 || voting) return;
      setVoting(true);
      setMyPick(votedForId);
      // Optimistic local tally
      setAllVotes((prev) => [
        ...prev.filter((v) => {
          // drop prior optimistic/local same-pair entries without voter uniqueness client-side
          const forId = String(v.voted_for_id || '');
          const a = String(v.fighter_a_id || '');
          const b = String(v.fighter_b_id || '');
          const same =
            (a === fighter1.id && b === fighter2.id) ||
            (a === fighter2.id && b === fighter1.id);
          // Keep server rows; only strip unmarked optimistic
          if (!same) return true;
          return v._optimistic !== true;
        }),
        {
          challenge_id: challengeId,
          fighter_a_id: fighter1.id,
          fighter_b_id: fighter2.id,
          voted_for_id: votedForId,
          response_id: votedForId,
          _optimistic: true,
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        const result = await castCustomMatchupVote({
          challengeId,
          fighterAId: fighter1.id,
          fighterBId: fighter2.id,
          votedForId,
        });
        onVoteCast?.({
          fighterAId: fighter1.id,
          fighterBId: fighter2.id,
          votedForId,
        });
        if (result.ok) {
          // Refresh authoritative tallies
          const refreshed = await fetchChallengeMatchupRoster(challengeId);
          if (refreshed.ok) {
            setAllVotes(
              (refreshed.votes || []) as Array<Record<string, unknown>>
            );
            if (refreshed.responses?.length) {
              setRoster(refreshed.responses as MatchupAthlete[]);
            }
          }
        }
      } finally {
        setVoting(false);
      }
    },
    [fighter1, fighter2, voting, challengeId, onVoteCast]
  );

  const totalMatchup =
    matchupTallies.votesA + matchupTallies.votesB || 1;
  const pctA = Math.round((matchupTallies.votesA / totalMatchup) * 100);
  const pctB = 100 - pctA;

  if (viewMode === 'matchup' && fighter1 && fighter2) {
    return (
      <View
        style={[
          styles.root,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom },
        ]}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.topBar}>
          <BackLink label="Roster" onPress={backToRoster} />
          <Text style={styles.topTitle}>HEAD-TO-HEAD</Text>
          {onClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.closeSpacer} />
          )}
        </View>

        <View style={styles.splitRow}>
          <SplitFighterPane
            athlete={fighter1}
            side="left"
            votes={matchupTallies.votesA}
            active
          />
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <SplitFighterPane
            athlete={fighter2}
            side="right"
            votes={matchupTallies.votesB}
            active
          />
        </View>

        <View style={styles.votePanel}>
          <Text style={styles.votePanelTitle}>WHO WON THIS MATCHUP?</Text>
          <View style={styles.voteBarTrack}>
            <View
              style={[
                styles.voteBarFillLeft,
                { width: `${pctA}%` },
              ]}
            />
            <View
              style={[
                styles.voteBarFillRight,
                { width: `${pctB}%` },
              ]}
            />
          </View>
          <View style={styles.voteBarLabels}>
            <Text style={styles.voteLabelLeft}>
              {matchupTallies.votesA} · {pctA}%
            </Text>
            <Text style={styles.voteLabelRight}>
              {pctB}% · {matchupTallies.votesB}
            </Text>
          </View>
          <View style={styles.voteActions}>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                styles.voteBtnLeft,
                myPick === fighter1.id && styles.voteBtnActiveLeft,
              ]}
              disabled={voting}
              onPress={() => void castVote(fighter1.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.voteBtnText}>
                🥊 VOTE {fighter1.handle.replace(/^@/, '')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                styles.voteBtnRight,
                myPick === fighter2.id && styles.voteBtnActiveRight,
              ]}
              disabled={voting}
              onPress={() => void castVote(fighter2.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.voteBtnText}>
                🥊 VOTE {fighter2.handle.replace(/^@/, '')}
              </Text>
            </TouchableOpacity>
          </View>
          {voting ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 8 }} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        {onClose ? (
          <BackLink label="Back" onPress={onClose} />
        ) : (
          <View style={styles.closeSpacer} />
        )}
        <Text style={styles.topTitle}>{title}</Text>
        <TouchableOpacity onPress={() => void loadRoster()} hitSlop={12}>
          <Text style={styles.refresh}>↻</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>
        Tap any two athletes to build a custom head-to-head
      </Text>

      {selectedIds.length > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {fighter1 ? `F1 ${fighter1.handle}` : 'F1 —'}
            {'  ·  '}
            {fighter2 ? `F2 ${fighter2.handle}` : 'F2 —'}
          </Text>
          {selectedIds.length === 2 ? (
            <TouchableOpacity
              style={styles.launchBtn}
              onPress={launchMatchup}
              activeOpacity={0.9}
            >
              <Text style={styles.launchBtnText}>LAUNCH MATCHUP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.selectionHint}>Pick 1 more</Text>
          )}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.muted}>Loading roster…</Text>
        </View>
      ) : error && !roster.length ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadRoster()}>
            <Text style={styles.retryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : !roster.length ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No responses yet for this challenge.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {roster.map((athlete) => {
            const slot = slotFor(athlete.id);
            return (
              <FighterTile
                key={athlete.id}
                athlete={athlete}
                slot={slot}
                selected={slot != null}
                onPress={() => toggleSelect(athlete.id)}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  topTitle: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  closeX: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  closeSpacer: { width: 64 },
  refresh: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  sub: {
    color: MUTED,
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectionBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  selectionText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 13,
  },
  selectionHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  launchBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  launchBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  tileSelected: {
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  tileFighter1: {
    borderColor: GLOW,
  },
  tileFighter2: {
    borderColor: CYAN,
  },
  tileVideo: {
    width: '100%',
    height: TILE_W * 1.15,
    backgroundColor: '#000',
    position: 'relative',
  },
  tilePlayer: {
    width: '100%',
    height: '100%',
  },
  tilePlayerSize: {
    height: '100%' as unknown as number,
    minHeight: 0,
    maxHeight: 9999,
  },
  tilePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePlaceholderText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: ACCENT,
    borderRadius: 16,
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  checkMarkText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
  },
  checkSlot: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '800',
  },
  tileHandle: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 10,
  },
  tileVotes: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    paddingHorizontal: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  muted: {
    color: MUTED,
    fontSize: 13,
  },
  errorText: {
    color: ACCENT,
    textAlign: 'center',
    fontSize: 13,
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    color: ACCENT,
    fontWeight: '800',
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 6,
    position: 'relative',
  },
  splitPane: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: CARD,
  },
  splitVideo: {
    flex: 1,
    minHeight: 180,
    backgroundColor: '#000',
  },
  splitPlayer: {
    width: '100%',
    height: '100%',
  },
  splitPlayerSize: {
    height: '100%' as unknown as number,
    minHeight: 180,
    maxHeight: 9999,
  },
  splitMeta: {
    padding: 10,
    gap: 2,
  },
  splitRole: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  splitHandle: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 14,
  },
  splitVotes: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  vsBadge: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -22,
    top: '38%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  vsText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 14,
  },
  votePanel: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  votePanelTitle: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  voteBarTrack: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#222',
  },
  voteBarFillLeft: {
    height: '100%',
    backgroundColor: GLOW,
  },
  voteBarFillRight: {
    height: '100%',
    backgroundColor: CYAN,
  },
  voteBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  voteLabelLeft: {
    color: GLOW,
    fontWeight: '800',
    fontSize: 12,
  },
  voteLabelRight: {
    color: CYAN,
    fontWeight: '800',
    fontSize: 12,
  },
  voteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  voteBtnLeft: {
    borderColor: GLOW,
    backgroundColor: `${GLOW}18`,
  },
  voteBtnRight: {
    borderColor: CYAN,
    backgroundColor: `${CYAN}18`,
  },
  voteBtnActiveLeft: {
    backgroundColor: GLOW,
  },
  voteBtnActiveRight: {
    backgroundColor: CYAN,
  },
  voteBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 11,
  },
});
