/**
 * Split-screen 1v1 Live Challenge card — Player A | VS | Player B,
 * combat stats bar, and skull_orange123 vote buttons on each side.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SKULL_ASSETS } from '../utils/skullAssets';
import {
  castCustomMatchupVote,
  fetchChallengeMatchupRoster,
  tallyMatchupVotes,
} from '../services/customMatchupService';

const ORANGE = '#FF5A00';
const WHITE = '#FFFFFF';
const PANEL_A = '#090D16';
const PANEL_B = '#121826';
const SPLIT_WIDE_MIN = 520;

const VOTE_SKULL =
  SKULL_ASSETS.skullOrange ||
  SKULL_ASSETS.skull_orange123 ||
  SKULL_ASSETS.skull_fire_full;

function resolveHandle(raw, fallback) {
  const s = String(raw || fallback || 'athlete').trim();
  if (!s) return '@athlete';
  return s.startsWith('@') ? s : `@${s.replace(/^@/, '')}`;
}

function SplitScreenBattleCard({
  item = null,
  playerA: playerAProp = null,
  playerB: playerBProp = null,
  title = '1v1 LIVE CHALLENGE',
  subtitle = 'Split-screen faceoff · skull votes decide the winner',
  onPressWatch = null,
  onRespond = null,
  style = null,
}) {
  const [votesA, setVotesA] = useState(
    () => Number(playerAProp?.votes ?? item?.votesA ?? 0) || 0
  );
  const [votesB, setVotesB] = useState(
    () => Number(playerBProp?.votes ?? item?.votesB ?? 0) || 0
  );
  const [voting, setVoting] = useState(false);
  const [splitWide, setSplitWide] = useState(
    () => Dimensions.get('window').width >= SPLIT_WIDE_MIN
  );

  const responses = Array.isArray(item?.responses) ? item.responses : [];
  const rival = responses[0] || null;
  const waitingForChallenger =
    item?.isOpenChallenge === true && !rival && !playerBProp;

  const challengeId = String(
    item?.challengeId || item?.battleId || item?.id || 'split-demo'
  );
  const fighterAId = String(
    playerAProp?.id ||
      item?.hostResponseId ||
      item?.openerId ||
      `host-${challengeId}`
  );
  const fighterBId = String(
    playerBProp?.id || rival?.id || `rival-${challengeId}`
  );

  const playerA = useMemo(
    () => ({
      handle: resolveHandle(
        playerAProp?.handle ||
          playerAProp?.label ||
          item?.challengerLabel ||
          item?.opponent ||
          item?.author ||
          item?.host,
        'player_a'
      ),
      label: playerAProp?.label || 'PLAYER A',
      sport: playerAProp?.sport || item?.sport || item?.category || 'ARENA',
      record: playerAProp?.record || item?.hostRecord || '0-0',
      power: playerAProp?.power || item?.hostPower || 72,
      posterUri:
        playerAProp?.posterUri ||
        item?.openerPoster ||
        item?.thumbnail_url ||
        item?.posterUrl ||
        null,
    }),
    [playerAProp, item]
  );

  const playerB = useMemo(
    () => ({
      handle: resolveHandle(
        playerBProp?.handle ||
          playerBProp?.label ||
          item?.leaderLabel ||
          rival?.creator ||
          item?.rival,
        waitingForChallenger ? 'waiting' : 'player_b'
      ),
      label: waitingForChallenger
        ? 'WAITING'
        : playerBProp?.label || 'PLAYER B',
      sport: playerBProp?.sport || item?.sport || item?.category || 'ARENA',
      record: playerBProp?.record || item?.rivalRecord || '0-0',
      power: playerBProp?.power || item?.rivalPower || 68,
      posterUri:
        playerBProp?.posterUri ||
        rival?.thumbnail_url ||
        rival?.posterUrl ||
        null,
    }),
    [playerBProp, item, rival, waitingForChallenger]
  );

  useEffect(() => {
    if (!rival || !item?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const roster = await fetchChallengeMatchupRoster(challengeId);
        if (!alive) return;
        const tallied = tallyMatchupVotes(
          roster?.votes || [],
          fighterAId,
          fighterBId
        );
        setVotesA(Number(tallied.votesA) || 0);
        setVotesB(Number(tallied.votesB) || 0);
      } catch (_) {
        /* soft-fail */
      }
    })();
    return () => {
      alive = false;
    };
  }, [rival, item?.id, challengeId, fighterAId, fighterBId]);

  const onSplitLayout = useCallback((e) => {
    const w = e?.nativeEvent?.layout?.width || 0;
    if (w > 0) setSplitWide(w >= SPLIT_WIDE_MIN);
  }, []);

  const castVote = useCallback(
    async (side) => {
      if (waitingForChallenger || voting) return;
      setVoting(true);
      if (side === 'A') setVotesA((n) => n + 1);
      else setVotesB((n) => n + 1);
      try {
        if (item?.id && rival) {
          await castCustomMatchupVote({
            challengeId,
            fighterAId,
            fighterBId,
            votedForId: side === 'A' ? fighterAId : fighterBId,
          });
        }
      } catch (_) {
        /* optimistic counts stay */
      } finally {
        setVoting(false);
      }
    },
    [
      waitingForChallenger,
      voting,
      item?.id,
      rival,
      challengeId,
      fighterAId,
      fighterBId,
    ]
  );

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>LIVE SPLIT</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.splitRow,
          splitWide ? styles.splitRowWide : styles.splitRowStack,
        ]}
        onLayout={onSplitLayout}
      >
        {/* Player A */}
        <View style={[styles.pane, styles.paneA]}>
          <View style={styles.paneGlowA} pointerEvents="none" />
          {playerA.posterUri ? (
            <Image
              source={{ uri: playerA.posterUri }}
              style={styles.panePoster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.paneFallback}>
              <Text style={styles.paneFallbackMark}>A</Text>
            </View>
          )}
          <View style={styles.paneMeta}>
            <Text style={styles.paneRole}>PLAYER A</Text>
            <Text style={styles.paneHandle} numberOfLines={1}>
              {playerA.handle}
            </Text>
            <Text style={styles.paneStat} numberOfLines={1}>
              {String(playerA.sport).toUpperCase()} · PWR {playerA.power} ·{' '}
              {playerA.record}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.skullVote}
            onPress={() => castVote('A')}
            disabled={voting || waitingForChallenger}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Vote ${playerA.handle}`}
          >
            <Image
              source={VOTE_SKULL}
              style={styles.skullImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.skullLabel}>VOTE A</Text>
            <Text style={styles.skullCount}>{votesA}</Text>
          </TouchableOpacity>
        </View>

        {/* Central divider */}
        <View
          style={[
            styles.divider,
            !splitWide && styles.dividerHorizontal,
          ]}
        >
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>

        {/* Player B */}
        <View style={[styles.pane, styles.paneB]}>
          <View style={styles.paneGlowB} pointerEvents="none" />
          {waitingForChallenger ? (
            <TouchableOpacity
              style={styles.openSlot}
              onPress={() => onRespond?.(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Accept open challenge"
            >
              <Text style={styles.openSlotTitle}>WAITING</Text>
              <Text style={styles.openSlotCta}>ACCEPT · RECORD</Text>
            </TouchableOpacity>
          ) : (
            <>
              {playerB.posterUri ? (
                <Image
                  source={{ uri: playerB.posterUri }}
                  style={styles.panePoster}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.paneFallback, styles.paneFallbackB]}>
                  <Text style={styles.paneFallbackMark}>B</Text>
                </View>
              )}
              <View style={styles.paneMeta}>
                <Text style={styles.paneRole}>PLAYER B</Text>
                <Text style={styles.paneHandle} numberOfLines={1}>
                  {playerB.handle}
                </Text>
                <Text style={styles.paneStat} numberOfLines={1}>
                  {String(playerB.sport).toUpperCase()} · PWR {playerB.power} ·{' '}
                  {playerB.record}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.skullVote}
                onPress={() => castVote('B')}
                disabled={voting}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Vote ${playerB.handle}`}
              >
                <Image
                  source={VOTE_SKULL}
                  style={styles.skullImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.skullLabel}>VOTE B</Text>
                <Text style={styles.skullCount}>{votesB}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Combat stats */}
      {!waitingForChallenger ? (
        <View style={styles.combatStats}>
          <View style={styles.combatLabels}>
            <Text style={styles.combatPctA}>{pctA}%</Text>
            <Text style={styles.combatMid}>CROWD POWER</Text>
            <Text style={styles.combatPctB}>{pctB}%</Text>
          </View>
          <View style={styles.combatTrack}>
            <View style={[styles.combatFillA, { flex: Math.max(pctA, 8) }]} />
            <View style={[styles.combatFillB, { flex: Math.max(pctB, 8) }]} />
          </View>
          <View style={styles.combatMeta}>
            <Text style={styles.combatMetaText}>
              {votesA} SKULLS · A
            </Text>
            <Text style={styles.combatMetaText}>
              B · {votesB} SKULLS
            </Text>
          </View>
        </View>
      ) : null}

      {onPressWatch ? (
        <TouchableOpacity
          style={styles.watchCta}
          onPress={onPressWatch}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Watch live split battle"
        >
          <Text style={styles.watchCtaText}>ENTER SPLIT ARENA</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.45)',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,90,0,0.16)',
    borderWidth: 1,
    borderColor: ORANGE,
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  livePillText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardSub: {
    color: '#8A8A8A',
    fontSize: 12,
    lineHeight: 16,
  },
  splitRow: {
    width: '100%',
    minHeight: 220,
  },
  splitRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitRowStack: {
    flexDirection: 'column',
  },
  pane: {
    flex: 1,
    minHeight: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  paneA: {
    backgroundColor: PANEL_A,
  },
  paneB: {
    backgroundColor: PANEL_B,
  },
  paneGlowA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,90,0,0.06)',
  },
  paneGlowB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,90,0,0.04)',
  },
  panePoster: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  paneFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111820',
  },
  paneFallbackB: {
    backgroundColor: '#151C28',
  },
  paneFallbackMark: {
    color: 'rgba(255,90,0,0.35)',
    fontSize: 72,
    fontWeight: '900',
  },
  paneMeta: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 2,
  },
  paneRole: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  paneHandle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  paneStat: {
    color: '#A8B0C0',
    fontSize: 11,
    fontWeight: '700',
  },
  skullVote: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 3,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.55)',
  },
  skullImage: {
    width: 44,
    height: 44,
    marginBottom: 4,
  },
  skullLabel: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  skullCount: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    zIndex: 4,
  },
  dividerHorizontal: {
    width: '100%',
    height: 36,
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  vsText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  openSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.35)',
    borderStyle: 'dashed',
    margin: 10,
    borderRadius: 12,
  },
  openSlotTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  openSlotCta: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  combatStats: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E1E1E',
  },
  combatLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  combatPctA: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '900',
    minWidth: 48,
  },
  combatMid: {
    color: '#666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  combatPctB: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    minWidth: 48,
    textAlign: 'right',
  },
  combatTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  combatFillA: {
    backgroundColor: ORANGE,
  },
  combatFillB: {
    backgroundColor: '#3A3A3A',
  },
  combatMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  combatMetaText: {
    color: '#777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  watchCta: {
    marginHorizontal: 14,
    marginBottom: 14,
    marginTop: 4,
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  watchCtaText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});

export default memo(SplitScreenBattleCard);
