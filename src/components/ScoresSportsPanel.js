/**
 * Sport-first Scores & Sports panel for Arena.
 * Grouped pills → match list → tap for inline live score card.
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

const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const LIVE = '#FF0033';

/**
 * Grouped sport categories for the horizontal ticker.
 * Each sport maps to a default scoring layout format.
 */
export const SCORE_SPORT_GROUPS = [
  {
    id: 'core',
    label: null,
    sports: [
      { key: 'CRICKET', format: 'score' },
      { key: 'FOOTBALL', format: 'score' },
      { key: 'TENNIS', format: 'sets' },
      { key: 'BASKETBALL', format: 'points' },
      { key: 'BASEBALL', format: 'score' },
      { key: 'RUGBY', format: 'points' },
      { key: 'MMA', format: 'timer' },
      { key: 'BJJ', format: 'points' },
    ],
  },
  {
    id: 'racket',
    label: 'RACKET',
    sports: [
      { key: 'BADMINTON', format: 'sets' },
      { key: 'TABLE TENNIS', format: 'sets' },
      { key: 'SQUASH', format: 'sets' },
      { key: 'PADEL', format: 'sets' },
    ],
  },
  {
    id: 'combat',
    label: 'COMBAT',
    sports: [
      { key: 'WRESTLING', format: 'points' },
      { key: 'JUDO', format: 'points' },
      { key: 'KARATE', format: 'points' },
      { key: 'TAEKWONDO', format: 'points' },
    ],
  },
  {
    id: 'precision',
    label: 'TRACK & PRECISION',
    sports: [
      { key: 'ATHLETICS', format: 'timer' },
      { key: 'GOLF', format: 'points' },
      { key: 'ARCHERY', format: 'points' },
      { key: 'SNOOKER', format: 'points' },
    ],
  },
  {
    id: 'water',
    label: 'WATER & OUTDOOR',
    sports: [
      { key: 'SURFING', format: 'points' },
      { key: 'SWIMMING', format: 'timer' },
    ],
  },
];

export const SCORE_SPORT_CATEGORIES = SCORE_SPORT_GROUPS.flatMap((g) =>
  g.sports.map((s) => s.key)
);

const SPORT_FORMAT = Object.fromEntries(
  SCORE_SPORT_GROUPS.flatMap((g) => g.sports.map((s) => [s.key, s.format]))
);

/** Flat ticker items: optional group label chips + sport pills. */
export const TICKER_ITEMS = SCORE_SPORT_GROUPS.flatMap((group) => {
  const items = [];
  if (group.label) {
    items.push({ type: 'label', id: `label-${group.id}`, label: group.label });
  }
  for (const sport of group.sports) {
    items.push({
      type: 'sport',
      id: sport.key,
      key: sport.key,
      format: sport.format,
    });
  }
  return items;
});

function matchLine(match) {
  const format = match.format || 'score';
  if (format === 'sets') {
    return match.setsLabel || `${match.home.score} · ${match.away.score}`;
  }
  if (format === 'timer') {
    return match.clock || match.home.score;
  }
  if (format === 'points') {
    return `${match.home.score} – ${match.away.score}`;
  }
  return `${match.home.score} – ${match.away.score}`;
}

/** Mock live / active matches keyed by sport. */
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
  TENNIS: [
    {
      id: 'djok-alcaraz',
      format: 'sets',
      title: 'DJOKOVIC vs ALCARAZ',
      competition: 'ATP FINALS',
      status: 'LIVE',
      venue: 'Turin',
      home: { name: 'DJOK', score: '1' },
      away: { name: 'ALC', score: '0' },
      sets: ['6-4', '3-2'],
      setsLabel: '6-4, 3-2*',
      games: { home: '3', away: '2' },
      detail: 'Set 2 · Alcaraz serve',
      clock: 'On serve',
    },
  ],
  BASKETBALL: [
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
  BASEBALL: [
    {
      id: 'nyy-bos-mlb',
      format: 'score',
      title: 'NYY vs BOS',
      competition: 'MLB',
      status: 'LIVE',
      venue: 'Yankee Stadium',
      home: { name: 'NYY', score: '4' },
      away: { name: 'BOS', score: '3' },
      detail: 'Top 7th',
      clock: 'In play',
    },
  ],
  RUGBY: [
    {
      id: 'nzl-rsa',
      format: 'points',
      title: 'NZL vs RSA',
      competition: 'RUGBY CHAMPIONSHIP',
      status: 'LIVE',
      venue: 'Eden Park',
      home: { name: 'NZL', score: '17' },
      away: { name: 'RSA', score: '14' },
      detail: '58′ · Scrummage',
      clock: '2nd half',
    },
  ],
  MMA: [
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
  ],
  BJJ: [
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

  // —— Racket ——
  BADMINTON: [
    {
      id: 'bd-sen-axelsen',
      format: 'sets',
      title: 'SEN vs AXELSEN',
      competition: 'BWF WORLD TOUR',
      status: 'LIVE',
      venue: 'Jakarta',
      home: { name: 'SEN', score: '1' },
      away: { name: 'AXE', score: '0' },
      sets: ['21-18', '11-9'],
      setsLabel: '21-18, 11-9*',
      games: { home: '11', away: '9' },
      detail: 'Game 2 · Sen leading',
      clock: 'In play',
    },
    {
      id: 'bd-sindhu-yamaguchi',
      format: 'sets',
      title: 'SINDHU vs YAMAGUCHI',
      competition: 'BWF',
      status: 'LIVE',
      venue: 'Tokyo',
      home: { name: 'SIN', score: '0' },
      away: { name: 'YAM', score: '1' },
      sets: ['19-21', '7-5'],
      setsLabel: '19-21, 7-5*',
      games: { home: '7', away: '5' },
      detail: 'Game 2',
      clock: 'Live',
    },
  ],
  'TABLE TENNIS': [
    {
      id: 'tt-fan-moregard',
      format: 'sets',
      title: 'FAN ZD vs MOREGARD',
      competition: 'WTT',
      status: 'LIVE',
      venue: 'Singapore',
      home: { name: 'FAN', score: '2' },
      away: { name: 'MOR', score: '1' },
      sets: ['11-8', '9-11', '11-6', '5-3'],
      setsLabel: '11-8, 9-11, 11-6, 5-3*',
      games: { home: '5', away: '3' },
      detail: 'Game 4',
      clock: 'Best of 7',
    },
  ],
  SQUASH: [
    {
      id: 'sq-farag-coll',
      format: 'sets',
      title: 'FARAG vs COLL',
      competition: 'PSA WORLD TOUR',
      status: 'LIVE',
      venue: 'Chicago',
      home: { name: 'FAR', score: '1' },
      away: { name: 'COL', score: '1' },
      sets: ['11-9', '8-11', '6-4'],
      setsLabel: '11-9, 8-11, 6-4*',
      games: { home: '6', away: '4' },
      detail: 'Game 3 · Tin rally',
      clock: 'In play',
    },
  ],
  PADEL: [
    {
      id: 'pad-tapia-coello',
      format: 'sets',
      title: 'TAPIA/COELLO vs LEBRON/GALAN',
      competition: 'PREMIER PADEL',
      status: 'LIVE',
      venue: 'Madrid',
      home: { name: 'T/C', score: '1' },
      away: { name: 'L/G', score: '0' },
      sets: ['6-4', '3-3'],
      setsLabel: '6-4, 3-3*',
      games: { home: '3', away: '3' },
      detail: 'Set 2 · Break point',
      clock: 'On serve',
    },
  ],

  // —— Combat ——
  WRESTLING: [
    {
      id: 'wr-dake-taylor',
      format: 'points',
      title: 'DAKE vs TAYLOR',
      competition: 'UWW',
      status: 'LIVE',
      venue: 'Belgrade',
      home: { name: 'DAKE', score: '4' },
      away: { name: 'TAY', score: '2' },
      detail: 'Freestyle 74kg',
      clock: 'Period 2',
    },
  ],
  JUDO: [
    {
      id: 'ju-otone-abe',
      format: 'points',
      title: 'Ono vs ABE',
      competition: 'IJF GRAND SLAM',
      status: 'LIVE',
      venue: 'Paris',
      home: { name: 'ONO', score: 'Waza-ari' },
      away: { name: 'ABE', score: '—' },
      detail: 'Men −73kg · Golden score',
      clock: 'GS 0:42',
    },
  ],
  KARATE: [
    {
      id: 'kar-shimizu-quintero',
      format: 'points',
      title: 'SHIMIZU vs QUINTERO',
      competition: 'WKF PREMIER LEAGUE',
      status: 'LIVE',
      venue: 'Rabat',
      home: { name: 'SHI', score: '5' },
      away: { name: 'QUI', score: '3' },
      detail: 'Kumite −67kg',
      clock: '0:18 left',
    },
  ],
  TAEKWONDO: [
    {
      id: 'tkd-jade-jones',
      format: 'points',
      title: 'JONES vs KIM',
      competition: 'WT GP',
      status: 'LIVE',
      venue: 'Manchester',
      home: { name: 'JON', score: '12' },
      away: { name: 'KIM', score: '9' },
      detail: 'Women −57kg · Round 2',
      clock: '0:35',
    },
  ],

  // —— Track & precision ——
  ATHLETICS: [
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
    {
      id: 'ath-800m-heat',
      format: 'timer',
      title: 'WOMEN 800M HEAT 2',
      competition: 'WORLD CHAMPS',
      status: 'LIVE',
      venue: 'Tokyo',
      home: { name: 'Hassan', score: '1:58.2' },
      away: { name: 'Pack', score: '—' },
      detail: 'Lap 2 · Bell',
      clock: '1:58.2',
      periodLabel: 'HEAT',
    },
  ],
  GOLF: [
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
  ARCHERY: [
    {
      id: 'arch-recurve',
      format: 'points',
      title: 'ELLISON vs KIM',
      competition: 'WORLD CUP',
      status: 'LIVE',
      venue: 'Shanghai',
      home: { name: 'ELL', score: '56' },
      away: { name: 'KIM', score: '54' },
      detail: 'Recurve · Set 4',
      clock: 'Set points 4–2',
    },
  ],
  SNOOKER: [
    {
      id: 'snook-oneill',
      format: 'points',
      title: 'O’SULLIVAN vs TRUMP',
      competition: 'WORLD CHAMPIONSHIP',
      status: 'LIVE',
      venue: 'Sheffield',
      home: { name: 'ROS', score: '67' },
      away: { name: 'TRU', score: '12' },
      detail: 'Frame 11 · Break 67',
      clock: 'Best of 35',
      frameScore: { home: '6', away: '4' },
    },
  ],

  // —— Water & outdoor ——
  SURFING: [
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
  SWIMMING: [
    {
      id: 'swim-100free',
      format: 'timer',
      title: 'MEN 100 FREE FINAL',
      competition: 'WORLD AQUATICS',
      status: 'LIVE',
      venue: 'Doha',
      home: { name: 'Popovici', score: '46.86' },
      away: { name: 'Field', score: '—' },
      detail: 'Touch · WR pace',
      clock: '46.86s',
      periodLabel: 'FINAL',
      results: [
        { place: '1', name: 'Popovici', mark: '46.86' },
        { place: '2', name: 'Chalmers', mark: '47.12' },
        { place: '3', name: 'Alexy', mark: '47.30' },
      ],
    },
    {
      id: 'swim-200im',
      format: 'timer',
      title: 'WOMEN 200 IM SEMI',
      competition: 'WORLD AQUATICS',
      status: 'LIVE',
      venue: 'Doha',
      home: { name: 'McIntosh', score: '2:07.1' },
      away: { name: 'Heat', score: '—' },
      detail: 'Breast leg',
      clock: '2:07.1',
      periodLabel: 'SEMI',
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

function ScoresSportsPanel() {
  const [selectedSport, setSelectedSport] = useState(SCORE_SPORT_CATEGORIES[0]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const matches = useMemo(() => {
    const list = LIVE_MATCHES_BY_SPORT[selectedSport] || [];
    const fallbackFormat = SPORT_FORMAT[selectedSport] || 'score';
    return list.map((m) => ({
      ...m,
      sport: selectedSport,
      format: m.format || fallbackFormat,
    }));
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
        {TICKER_ITEMS.map((item) => {
          if (item.type === 'label') {
            return (
              <View key={item.id} style={styles.groupLabel}>
                <Text style={styles.groupLabelText}>{item.label}</Text>
              </View>
            );
          }
          const active = selectedSport === item.key;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelectSport(item.key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {item.key}
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
