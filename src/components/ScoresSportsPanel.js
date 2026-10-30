/**
 * GAME ON Scores & Sports panel — locked BAWAAL_SPORTS pills only.
 * Formats: sets | points | timer | score (board).
 * Pure UI / mock data — does not touch feed video playback.
 */
import React, { memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BAWAAL_SPORTS } from '../constants/sports';

const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const LIVE = '#FF0033';

/** Locked taxonomy filter pills — never invent local sport arrays. */
export const SCORE_SPORT_CATEGORIES = BAWAAL_SPORTS;

const SPORT_FORMAT = {
  ALL: 'score',
  CRICKET: 'score',
  FOOTBALL: 'score',
  GYM: 'points',
  KABADDI: 'points',
  COMBAT: 'timer',
  THROTTLE: 'timer',
  'WAVE & BLADE': 'points',
  'COURT KINGS': 'points',
  'SKY & SUMMIT': 'timer',
  OTHERS: 'points',
};

/** @deprecated Legacy export — empty; pills come from BAWAAL_SPORTS only. */
export const SCORE_SPORT_GROUPS = [];

/** Flat pill items from locked BAWAAL_SPORTS (no group labels / fallback sports). */
export const TICKER_ITEMS = BAWAAL_SPORTS.map((key) => ({
  type: 'sport',
  id: key,
  key,
  format: SPORT_FORMAT[key] || 'score',
}));

function matchLine(match) {
  const format = match.format || 'score';
  if (format === 'sets') {
    return match.setsLabel || (match.home.score + ' · ' + match.away.score);
  }
  if (format === 'timer') {
    return match.clock || match.home.score;
  }
  if (format === 'points') {
    return match.home.score + ' – ' + match.away.score;
  }
  return match.home.score + ' – ' + match.away.score;
}

/** Mock live matches keyed only by locked BAWAAL_SPORTS. */
export const LIVE_MATCHES_BY_SPORT = {
  CRICKET: [
    {
      id: 'ind-aus-t20',
      format: 'score',
      title: 'IND vs AUS',
      competition: 'T20 SERIES',
      status: 'LIVE',
      venue: 'Wankhede',
      home: { name: 'IND', score: '184/4' },
      away: { name: 'AUS', score: '—' },
      detail: '18.2 ov · IND batting',
      clock: '2nd innings',
    },
    {
      id: 'mum-del-ranji',
      format: 'score',
      title: 'MUM vs DEL',
      competition: 'RANJI',
      status: 'LIVE',
      venue: 'Brabourne',
      home: { name: 'MUM', score: '210/3' },
      away: { name: 'DEL', score: '156' },
      detail: 'Day 2 · Session 2',
      clock: 'Stumps soon',
    },
  ],
  FOOTBALL: [
    {
      id: 'mci-liv',
      format: 'score',
      title: 'MCI vs LIV',
      competition: 'PREMIER LEAGUE',
      status: 'LIVE',
      venue: 'Etihad',
      home: { name: 'MCI', score: '2' },
      away: { name: 'LIV', score: '1' },
      detail: '67′ · High press',
      clock: '2nd half',
    },
    {
      id: 'rma-bar',
      format: 'score',
      title: 'RMA vs BAR',
      competition: 'LA LIGA',
      status: 'LIVE',
      venue: 'Bernabéu',
      home: { name: 'RMA', score: '1' },
      away: { name: 'BAR', score: '1' },
      detail: '54′ · El Clásico',
      clock: '2nd half',
    },
  ],
  GYM: [
    {
      id: 'gym-open-floor',
      format: 'points',
      title: 'OPEN FLOOR · DEADLIFT',
      competition: 'BAWAAL GYM LIVE',
      status: 'LIVE',
      venue: 'Arena Floor',
      home: { name: 'YUKI', score: '140' },
      away: { name: 'FIELD', score: '—' },
      detail: '3-rep max · chalk up',
      clock: 'Live PR',
    },
  ],
  KABADDI: [
    {
      id: 'kabaddi-puneri-bengal',
      format: 'points',
      title: 'PUNERI vs BENGAL',
      competition: 'PRO KABADDI',
      status: 'LIVE',
      venue: 'Pune',
      home: { name: 'PUN', score: '28' },
      away: { name: 'BEN', score: '24' },
      detail: 'Raid · Super tackle',
      clock: '2nd half',
    },
  ],
  COMBAT: [
    {
      id: 'ufc-main',
      format: 'timer',
      title: 'VOLKANOVSKI vs TOPURIA',
      competition: 'UFC',
      status: 'LIVE',
      venue: 'T-Mobile Arena',
      home: { name: 'VOLK', score: 'R2' },
      away: { name: 'TOPU', score: 'R2' },
      detail: 'Round 2',
      clock: '1:40',
      periodLabel: 'ROUND 2',
    },
    {
      id: 'bjj-finals',
      format: 'points',
      title: 'ANDRADE vs MIYAUNO',
      competition: 'IBJJF',
      status: 'LIVE',
      venue: 'Long Beach',
      home: { name: 'AND', score: '4' },
      away: { name: 'MIY', score: '2' },
      detail: 'Gi · Absolute',
      clock: 'Finals',
    },
  ],
  THROTTLE: [
    {
      id: 'f1-monaco',
      format: 'timer',
      title: 'MONACO GP',
      competition: 'FORMULA 1',
      status: 'LIVE',
      venue: 'Monte Carlo',
      home: { name: 'VER', score: 'P1' },
      away: { name: 'Field', score: '—' },
      detail: 'Lap 48 · Soft tires',
      clock: '1:12.884',
      periodLabel: 'RACE',
      results: [
        { place: '1', name: 'VER', mark: 'Leader' },
        { place: '2', name: 'NOR', mark: '+3.2s' },
        { place: '3', name: 'LEC', mark: '+5.1s' },
      ],
    },
  ],
  'WAVE & BLADE': [
    {
      id: 'surf-pipeline',
      format: 'points',
      title: 'FERREIRA vs FLORENCE',
      competition: 'WSL CT',
      status: 'LIVE',
      venue: 'Pipeline',
      home: { name: 'FER', score: '16.33' },
      away: { name: 'FLO', score: '14.10' },
      detail: 'Heat 3 · Priority FER',
      clock: '6:40 left',
    },
  ],
  'COURT KINGS': [
    {
      id: 'lal-bos',
      format: 'points',
      title: 'LAL vs BOS',
      competition: 'NBA',
      status: 'LIVE',
      venue: 'Crypto.com Arena',
      home: { name: 'LAL', score: '88' },
      away: { name: 'BOS', score: '91' },
      detail: 'Q3 · 4:12',
      clock: '3rd quarter',
    },
  ],
  'SKY & SUMMIT': [
    {
      id: 'ath-100m-final',
      format: 'timer',
      title: 'MEN 100M FINAL',
      competition: 'DIAMOND LEAGUE',
      status: 'LIVE',
      venue: 'Zurich',
      home: { name: 'Lyles', score: '9.83' },
      away: { name: 'Field', score: '—' },
      detail: 'Just finished · Wind +0.4',
      clock: '9.83s',
      periodLabel: 'FINAL',
      results: [
        { place: '1', name: 'Lyles', mark: '9.83' },
        { place: '2', name: 'Seidl', mark: '9.91' },
        { place: '3', name: 'Kerley', mark: '9.94' },
      ],
    },
  ],
  OTHERS: [
    {
      id: 'golf-r3',
      format: 'points',
      title: 'SCHEFFLER vs RAHM',
      competition: 'PGA TOUR',
      status: 'LIVE',
      venue: 'Augusta',
      home: { name: 'SCH', score: '−12' },
      away: { name: 'RAH', score: '−10' },
      detail: 'R3 · Hole 14',
      clock: 'Thru 14',
    },
  ],
};

function SetsScoreBody({ match }) {
  return (
    <View>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCol}>
          <Text style={styles.teamName}>{match.home.name}</Text>
          <Text style={styles.teamScore}>{match.home.score}</Text>
          <Text style={styles.formatHint}>SETS</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={[styles.scoreCol, styles.scoreColRight]}>
          <Text style={styles.teamName}>{match.away.name}</Text>
          <Text style={styles.teamScore}>{match.away.score}</Text>
          <Text style={styles.formatHint}>SETS</Text>
        </View>
      </View>
      {!!match.sets?.length && (
        <View style={styles.setsStrip}>
          {match.sets.map((s, i) => (
            <View
              key={`${match.id}-set-${i}`}
              style={[
                styles.setChip,
                i === match.sets.length - 1 && styles.setChipLive,
              ]}
            >
              <Text
                style={[
                  styles.setChipText,
                  i === match.sets.length - 1 && styles.setChipTextLive,
                ]}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!!match.games && (
        <Text style={styles.gamesLine}>
          Current game {match.games.home}–{match.games.away}
        </Text>
      )}
    </View>
  );
}

function PointsScoreBody({ match }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreCol}>
        <Text style={styles.teamName}>{match.home.name}</Text>
        <Text style={styles.teamScore}>{match.home.score}</Text>
        <Text style={styles.formatHint}>PTS</Text>
      </View>
      <Text style={styles.vs}>VS</Text>
      <View style={[styles.scoreCol, styles.scoreColRight]}>
        <Text style={styles.teamName}>{match.away.name}</Text>
        <Text style={styles.teamScore}>{match.away.score}</Text>
        <Text style={styles.formatHint}>PTS</Text>
      </View>
    </View>
  );
}

function TimerScoreBody({ match }) {
  return (
    <View>
      {!!match.periodLabel && (
        <Text style={styles.periodLabel}>{match.periodLabel}</Text>
      )}
      <View style={styles.timerBlock}>
        <Text style={styles.timerClock}>{match.clock || match.home.score}</Text>
        <Text style={styles.timerLeader}>{match.home.name}</Text>
      </View>
      {!!match.results?.length && (
        <View style={styles.resultsList}>
          {match.results.map((row) => (
            <View key={`${match.id}-${row.place}`} style={styles.resultRow}>
              <Text style={styles.resultPlace}>{row.place}</Text>
              <Text style={styles.resultName}>{row.name}</Text>
              <Text style={styles.resultMark}>{row.mark}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BoardScoreBody({ match }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreCol}>
        <Text style={styles.teamName}>{match.home.name}</Text>
        <Text style={styles.teamScore}>{match.home.score}</Text>
      </View>
      <Text style={styles.vs}>VS</Text>
      <View style={[styles.scoreCol, styles.scoreColRight]}>
        <Text style={styles.teamName}>{match.away.name}</Text>
        <Text style={styles.teamScore}>{match.away.score}</Text>
      </View>
    </View>
  );
}

function InlineScoreCard({ match, onClose }) {
  if (!match) return null;
  const format = match.format || SPORT_FORMAT[match.sport] || 'score';

  return (
    <View style={styles.inlineCard}>
      <View style={styles.inlineHeader}>
        <View style={styles.inlineHeaderLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.inlineLive}>{match.status}</Text>
          <Text style={styles.inlineComp}>{match.competition}</Text>
          <Text style={styles.formatTag}>{format.toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Close score card"
        >
          <Text style={styles.inlineClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.inlineTitle}>{match.title}</Text>
      <Text style={styles.inlineVenue}>{match.venue}</Text>

      {format === 'sets' ? (
        <SetsScoreBody match={match} />
      ) : format === 'points' ? (
        <PointsScoreBody match={match} />
      ) : format === 'timer' ? (
        <TimerScoreBody match={match} />
      ) : (
        <BoardScoreBody match={match} />
      )}

      {!!match.frameScore && (
        <Text style={styles.gamesLine}>
          Frames {match.frameScore.home}–{match.frameScore.away}
        </Text>
      )}

      <View style={styles.inlineMeta}>
        <Text style={styles.inlineDetail}>{match.detail}</Text>
        <Text style={styles.inlineClock}>{match.clock}</Text>
      </View>
    </View>
  );
}

function ScoresSportsPanel({ sports = BAWAAL_SPORTS } = {}) {
  const sportPills = Array.isArray(sports) && sports.length ? sports : BAWAAL_SPORTS;
  const [selectedSport, setSelectedSport] = useState(
    () => sportPills.find((s) => s !== 'ALL') || sportPills[0] || 'CRICKET'
  );
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const matches = useMemo(() => {
    const collect = (key) => {
      const list = LIVE_MATCHES_BY_SPORT[key] || [];
      const fallbackFormat = SPORT_FORMAT[key] || 'score';
      return list.map((m) => ({
        ...m,
        sport: key,
        format: m.format || fallbackFormat,
      }));
    };
    if (selectedSport === 'ALL') {
      return BAWAAL_SPORTS.filter((s) => s !== 'ALL').flatMap(collect);
    }
    return collect(selectedSport);
  }, [selectedSport]);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );

  const onSelectSport = (sport) => {
    setSelectedSport(sport);
    setSelectedMatchId(null);
  };

  const onSelectMatch = (id) => {
    setSelectedMatchId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.panel}>
      <View style={styles.subheaderRow}>
        <Text style={styles.subheaderTitle}>SCORES & SPORTS</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsRow}
      >
        {sportPills.map((key) => {
          const active = selectedSport === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelectSport(key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter ${key}`}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.matchList}
        contentContainerStyle={styles.matchListContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {matches.length === 0 ? (
          <Text style={styles.emptyMatches}>
            No live matches for {selectedSport}
          </Text>
        ) : (
          matches.map((match) => {
            const active = selectedMatchId === match.id;
            return (
              <TouchableOpacity
                key={match.id}
                style={[styles.matchRow, active && styles.matchRowActive]}
                onPress={() => onSelectMatch(match.id)}
                activeOpacity={0.85}
              >
                <View style={styles.matchRowLeft}>
                  <Text style={styles.matchTitle}>{match.title}</Text>
                  <Text style={styles.matchSub}>
                    {match.competition} · {match.detail}
                  </Text>
                </View>
                <View style={styles.matchRowRight}>
                  <Text style={styles.matchScoreLine}>{matchLine(match)}</Text>
                  <View style={styles.miniLive}>
                    <View style={styles.liveDotSm} />
                    <Text style={styles.miniLiveText}>{match.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {selectedMatch ? (
        <InlineScoreCard
          match={selectedMatch}
          onClose={() => setSelectedMatchId(null)}
        />
      ) : (
        <Text style={styles.hint}>Tap a match for the live score card</Text>
      )}
    </View>
  );
}

export default memo(ScoresSportsPanel);

const styles = StyleSheet.create({
  panel: {
    marginTop: 4,
    marginBottom: 8,
    paddingBottom: 4,
  },
  subheaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  subheaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 1.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LIVE,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIVE,
    marginRight: 6,
  },
  liveDotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: LIVE,
    marginRight: 4,
  },
  liveBadgeText: {
    color: LIVE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pillsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  groupLabel: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginRight: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  groupLabelText: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  pillText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#000000',
  },
  matchList: {
    maxHeight: 168,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  matchListContent: {
    paddingVertical: 4,
  },
  emptyMatches: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  matchRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  matchRowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  matchTitle: {
    color: OFF_WHITE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  matchSub: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },
  matchRowRight: {
    alignItems: 'flex-end',
    maxWidth: '42%',
  },
  matchScoreLine: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  miniLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniLiveText: {
    color: LIVE,
    fontSize: 9,
    fontWeight: '800',
  },
  hint: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 8,
    marginHorizontal: 16,
  },
  inlineCard: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WHITE,
    padding: 14,
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inlineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  inlineLive: {
    color: LIVE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  inlineComp: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  formatTag: {
    color: OFF_WHITE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  inlineClose: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 12,
  },
  inlineTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  inlineVenue: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scoreCol: {
    flex: 1,
  },
  scoreColRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  teamScore: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  formatHint: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  vs: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 10,
  },
  setsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  setChip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#000000',
  },
  setChipLive: {
    borderColor: WHITE,
  },
  setChipText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  setChipTextLive: {
    color: WHITE,
  },
  gamesLine: {
    color: OFF_WHITE,
    fontSize: 11,
    marginBottom: 8,
  },
  periodLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  timerBlock: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
  timerClock: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerLeader: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  resultsList: {
    marginBottom: 8,
    gap: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  resultPlace: {
    color: MUTED,
    width: 24,
    fontSize: 12,
    fontWeight: '800',
  },
  resultName: {
    color: OFF_WHITE,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  resultMark: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
  inlineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: 10,
    marginTop: 4,
  },
  inlineDetail: {
    color: OFF_WHITE,
    fontSize: 11,
    flex: 1,
    paddingRight: 8,
  },
  inlineClock: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
});
