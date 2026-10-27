/**
 * Sport-first Scores & Sports panel for Arena.
 * Pills → match list → tap for inline live score card.
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

const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const LIVE = '#FF0033';

/** Major sports for the Scores selector (sport-first). */
export const SCORE_SPORT_CATEGORIES = [
  'CRICKET',
  'FOOTBALL',
  'TENNIS',
  'BASKETBALL',
  'BASEBALL',
  'RUGBY',
  'MMA',
  'BJJ',
];

/** Mock live / active matches keyed by sport. */
export const LIVE_MATCHES_BY_SPORT = {
  CRICKET: [
    {
      id: 'ind-aus-t20',
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
      title: 'MUM vs DEL',
      competition: 'RANJI',
      status: 'LIVE',
      venue: 'Brabourne',
      home: { name: 'MUM', score: '210/3' },
      away: { name: 'DEL', score: '156' },
      detail: 'Day 2 · Session 2',
      clock: 'Stumps soon',
    },
    {
      id: 'eng-sa-odi',
      title: 'ENG vs SA',
      competition: 'ODI',
      status: 'LIVE',
      venue: 'Lords',
      home: { name: 'ENG', score: '278/7' },
      away: { name: 'SA', score: '142/3' },
      detail: '31.4 ov · SA chase',
      clock: 'Required 7.1 RPO',
    },
  ],
  FOOTBALL: [
    {
      id: 'mci-liv',
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
      title: 'RMA vs BAR',
      competition: 'LA LIGA',
      status: 'LIVE',
      venue: 'Bernabéu',
      home: { name: 'RMA', score: '1' },
      away: { name: 'BAR', score: '1' },
      detail: '54′ · El Clásico',
      clock: '2nd half',
    },
    {
      id: 'ind-aus-foot',
      title: 'IND vs AUS',
      competition: 'AFC QUALIFIER',
      status: 'LIVE',
      venue: 'Kolkata',
      home: { name: 'IND', score: '0' },
      away: { name: 'AUS', score: '0' },
      detail: '22′ · Midfield battle',
      clock: '1st half',
    },
  ],
  TENNIS: [
    {
      id: 'djok-alcaraz',
      title: 'DJOKOVIC vs ALCARAZ',
      competition: 'ATP FINALS',
      status: 'LIVE',
      venue: 'Turin',
      home: { name: 'DJOK', score: '6-4, 3-2' },
      away: { name: 'ALC', score: '—' },
      detail: 'Set 2 · Alcaraz serve',
      clock: 'On serve',
    },
    {
      id: 'swiatek-gauff',
      title: 'SWIATEK vs GAUFF',
      competition: 'WTA',
      status: 'LIVE',
      venue: 'Riyadh',
      home: { name: 'SWI', score: '7-5' },
      away: { name: 'GAU', score: '2-1' },
      detail: 'Set 2',
      clock: 'Live',
    },
  ],
  BASKETBALL: [
    {
      id: 'lal-bos',
      title: 'LAL vs BOS',
      competition: 'NBA',
      status: 'LIVE',
      venue: 'Crypto.com Arena',
      home: { name: 'LAL', score: '88' },
      away: { name: 'BOS', score: '91' },
      detail: 'Q3 · 4:12',
      clock: '3rd quarter',
    },
    {
      id: 'gsw-phx',
      title: 'GSW vs PHX',
      competition: 'NBA',
      status: 'LIVE',
      venue: 'Chase Center',
      home: { name: 'GSW', score: '102' },
      away: { name: 'PHX', score: '97' },
      detail: 'Q4 · 8:40',
      clock: '4th quarter',
    },
  ],
  BASEBALL: [
    {
      id: 'nyy-bos-mlb',
      title: 'NYY vs BOS',
      competition: 'MLB',
      status: 'LIVE',
      venue: 'Yankee Stadium',
      home: { name: 'NYY', score: '4' },
      away: { name: 'BOS', score: '3' },
      detail: 'Top 7th',
      clock: 'In play',
    },
    {
      id: 'lad-sd',
      title: 'LAD vs SD',
      competition: 'MLB',
      status: 'LIVE',
      venue: 'Dodger Stadium',
      home: { name: 'LAD', score: '2' },
      away: { name: 'SD', score: '2' },
      detail: 'Bot 5th',
      clock: 'Tied',
    },
  ],
  RUGBY: [
    {
      id: 'nzl-rsa',
      title: 'NZL vs RSA',
      competition: 'RUGBY CHAMPIONSHIP',
      status: 'LIVE',
      venue: 'Eden Park',
      home: { name: 'NZL', score: '17' },
      away: { name: 'RSA', score: '14' },
      detail: '58′ · Scrummage',
      clock: '2nd half',
    },
    {
      id: 'eng-irl',
      title: 'ENG vs IRL',
      competition: 'SIX NATIONS',
      status: 'LIVE',
      venue: 'Twickenham',
      home: { name: 'ENG', score: '10' },
      away: { name: 'IRL', score: '13' },
      detail: '41′',
      clock: '2nd half',
    },
  ],
  MMA: [
    {
      id: 'ufc-main',
      title: 'VOLKANOVSKI vs TOPURIA',
      competition: 'UFC',
      status: 'LIVE',
      venue: 'T-Mobile Arena',
      home: { name: 'VOLK', score: 'R2' },
      away: { name: 'TOPU', score: 'R2' },
      detail: 'Round 2 · 1:40',
      clock: 'Main event',
    },
    {
      id: 'ufc-co',
      title: 'ADESANYA vs DU PLESSIS',
      competition: 'UFC',
      status: 'LIVE',
      venue: 'T-Mobile Arena',
      home: { name: 'IZZY', score: 'W' },
      away: { name: 'DDP', score: 'L' },
      detail: 'Decision · UD',
      clock: 'Ended',
    },
  ],
  BJJ: [
    {
      id: 'bjj-finals',
      title: 'ANDRADE vs MIYAUNO',
      competition: 'IBJJF',
      status: 'LIVE',
      venue: 'Long Beach',
      home: { name: 'AND', score: '4' },
      away: { name: 'MIY', score: '2' },
      detail: 'Gi · Absolute',
      clock: 'Finals',
    },
    {
      id: 'bjj-semis',
      title: 'RUOTOLO vs BROOKS',
      competition: 'WNO',
      status: 'LIVE',
      venue: 'Austin',
      home: { name: 'RUO', score: 'SUB' },
      away: { name: 'BRO', score: '—' },
      detail: 'Heel hook · 2:11',
      clock: 'Finished',
    },
  ],
};

function InlineScoreCard({ match, onClose }) {
  if (!match) return null;
  return (
    <View style={styles.inlineCard}>
      <View style={styles.inlineHeader}>
        <View style={styles.inlineHeaderLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.inlineLive}>{match.status}</Text>
          <Text style={styles.inlineComp}>{match.competition}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close score card">
          <Text style={styles.inlineClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.inlineTitle}>{match.title}</Text>
      <Text style={styles.inlineVenue}>{match.venue}</Text>

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

      <View style={styles.inlineMeta}>
        <Text style={styles.inlineDetail}>{match.detail}</Text>
        <Text style={styles.inlineClock}>{match.clock}</Text>
      </View>
    </View>
  );
}

function ScoresSportsPanel() {
  const [selectedSport, setSelectedSport] = useState(SCORE_SPORT_CATEGORIES[0]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const matches = useMemo(
    () => LIVE_MATCHES_BY_SPORT[selectedSport] || [],
    [selectedSport]
  );

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
        {SCORE_SPORT_CATEGORIES.map((sport) => {
          const active = selectedSport === sport;
          return (
            <TouchableOpacity
              key={sport}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelectSport(sport)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {sport}
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
          <Text style={styles.emptyMatches}>No live matches for {selectedSport}</Text>
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
                  <Text style={styles.matchScoreLine}>
                    {match.home.score} – {match.away.score}
                  </Text>
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
    gap: 8,
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
  },
  matchScoreLine: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
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
  },
  inlineLive: {
    color: LIVE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  inlineComp: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
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
  vs: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 10,
  },
  inlineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: 10,
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
