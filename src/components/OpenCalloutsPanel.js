/**
 * Open Callouts for the BATTLES tab — OPEN CHALLENGES + TIPS & BREAKDOWNS.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  CALLOUT_KIND_CHALLENGE,
  CALLOUT_KIND_TIP,
  resolveCalloutKind,
} from '../utils/faceoffCallout';
import {
  canonicalizeSport,
  matchesSportFilter,
} from '../utils/sportCategory';

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const CRIMSON = '#FF0033';
const TIP_BLUE = '#3B82F6';

function CalloutCard({ item, kind, onRespond }) {
  const handle = String(
    item.host || item.opponent || item.challengeOf || 'Athlete'
  ).replace(/^@/, '');
  const isTip = kind === CALLOUT_KIND_TIP;
  const status = isTip
    ? 'TIP'
    : String(item.status || 'OPEN').toUpperCase();
  const accent = isTip ? TIP_BLUE : CRIMSON;
  const title =
    item.target ||
    item.description ||
    item.statSticker ||
    (isTip ? 'Tip request' : 'Open callout');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View
          style={[
            styles.statusPill,
            { borderColor: accent, backgroundColor: `${accent}22` },
          ]}
        >
          <Text style={[styles.statusPillText, { color: accent }]}>
            {status}
          </Text>
        </View>
        <Text style={styles.sportTag}>{item.sport || 'ALL'}</Text>
      </View>
      <Text style={styles.handle} numberOfLines={1}>
        @{handle}
      </Text>
      <Text style={styles.target} numberOfLines={2}>
        {title}
      </Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={() => onRespond?.(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isTip ? 'Break down tip' : 'Respond to challenge'}
      >
        <Text style={styles.ctaText}>{isTip ? 'BREAK DOWN' : 'RESPOND'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({ title, emptyTitle, emptySub, items, onRespond }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        {title}
        {items.length > 0 ? ` · ${items.length}` : ''}
      </Text>
      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySub}>{emptySub}</Text>
        </View>
      ) : (
        items.map((item) => (
          <CalloutCard
            key={item.id}
            item={item}
            kind={resolveCalloutKind(item)}
            onRespond={onRespond}
          />
        ))
      )}
    </View>
  );
}

function OpenCalloutsPanel({
  callouts = [],
  selectedSport = 'ALL',
  onRespond,
}) {
  const sport = canonicalizeSport(selectedSport) || 'ALL';

  const filtered = useMemo(() => {
    const list = Array.isArray(callouts) ? callouts : [];
    if (sport === 'ALL') return list;
    return list.filter((item) => matchesSportFilter(item, sport));
  }, [callouts, sport]);

  const challenges = useMemo(
    () =>
      filtered.filter(
        (item) => resolveCalloutKind(item) === CALLOUT_KIND_CHALLENGE
      ),
    [filtered]
  );
  const tips = useMemo(
    () =>
      filtered.filter((item) => resolveCalloutKind(item) === CALLOUT_KIND_TIP),
    [filtered]
  );

  const sportLabel = sport === 'ALL' ? '' : ` ${sport}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>OPEN CALLOUTS</Text>
      <Text style={styles.subheader}>
        Performance challenges and technique tips — respond from Battles.
      </Text>

      <Section
        title="OPEN CHALLENGES"
        emptyTitle={`NO${sportLabel} OPEN CHALLENGES`}
        emptySub="Launch from + BATTLE or LAUNCH ARENA CHALLENGE."
        items={challenges}
        onRespond={onRespond}
      />
      <Section
        title="TIPS & BREAKDOWNS"
        emptyTitle={`NO${sportLabel} TIPS`}
        emptySub="Ask for technique advice or a form-check."
        items={tips}
        onRespond={onRespond}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  subheader: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  emptyBox: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
  },
  emptyTitle: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  emptySub: {
    color: MUTED,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 16,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sportTag: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  handle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  target: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  cta: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
  },
  ctaText: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default memo(OpenCalloutsPanel);
