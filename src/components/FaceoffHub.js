/**
 * FACEOFF hub — dedicated Arena discovery surface.
 * Scores ticker + sport category grid + 2-category open callouts (stealth-black).
 */
import React, { memo, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackLink from './BackLink';
import ScoresSportsPanel from './ScoresSportsPanel';
import {
  BAWAAL_SPORT_TAXONOMY,
  canonicalizeSport,
  matchesSportFilter,
} from '../utils/sportCategory';
import {
  CALLOUT_KIND_CHALLENGE,
  CALLOUT_KIND_TIP,
  resolveCalloutKind,
} from '../utils/faceoffCallout';

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const FLAME = '#FF5722';
const CRIMSON = '#FF0033';
const TIP_BLUE = '#3B82F6';

const SPORT_GRID = BAWAAL_SPORT_TAXONOMY.length
  ? BAWAAL_SPORT_TAXONOMY
  : ['ALL'];

function CalloutCard({
  item,
  focused,
  kind,
  onRespond,
  onOpenResponses,
}) {
  const handle = String(
    item.opponent || item.host || item.challengeOf || 'Athlete'
  ).replace(/^@/, '');
  const isTip = kind === CALLOUT_KIND_TIP;
  const status = isTip
    ? 'TIP'
    : String(item.status || 'OPEN').toUpperCase();
  const accent = isTip ? TIP_BLUE : CRIMSON;

  return (
    <View
      style={[styles.challengeCard, focused && styles.challengeCardFocus]}
    >
      <View style={styles.challengeTop}>
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
      <Text style={styles.challengeHandle} numberOfLines={1}>
        @{handle}
      </Text>
      <Text style={styles.challengeTarget} numberOfLines={2}>
        {item.target || item.statSticker || (isTip ? 'Tip request' : 'Open callout')}
      </Text>
      <View style={styles.challengeActions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => onOpenResponses?.(item)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>
            {(item.responses || []).length} RESPONSES
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.respondBtn}
          onPress={() => onRespond?.(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isTip ? 'Respond to tip' : 'Respond to challenge'}
        >
          <Text style={styles.respondBtnText}>
            {isTip ? 'BREAK DOWN' : 'RESPOND'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CalloutSection({
  title,
  emptyTitle,
  emptySub,
  items,
  focusChallengeId,
  onRespond,
  onOpenResponses,
}) {
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
        items.map((item) => {
          const focused =
            focusChallengeId && String(item.id) === String(focusChallengeId);
          return (
            <CalloutCard
              key={item.id}
              item={item}
              focused={focused}
              kind={resolveCalloutKind(item)}
              onRespond={onRespond}
              onOpenResponses={onOpenResponses}
            />
          );
        })
      )}
    </View>
  );
}

function FaceoffHub({
  visible,
  onClose,
  challenges = [],
  selectedSport = 'ALL',
  onSelectSport,
  onRespond,
  onOpenResponses,
  focusChallengeId = null,
}) {
  const insets = useSafeAreaInsets();
  const sport = canonicalizeSport(selectedSport) || 'ALL';

  const filtered = useMemo(() => {
    const list = Array.isArray(challenges) ? challenges : [];
    if (sport === 'ALL') return list;
    return list.filter((item) => matchesSportFilter(item, sport));
  }, [challenges, sport]);

  const openChallenges = useMemo(
    () =>
      filtered.filter(
        (item) => resolveCalloutKind(item) === CALLOUT_KIND_CHALLENGE
      ),
    [filtered]
  );

  const tipCallouts = useMemo(
    () =>
      filtered.filter((item) => resolveCalloutKind(item) === CALLOUT_KIND_TIP),
    [filtered]
  );

  const sportLabel = sport === 'ALL' ? '' : ` ${sport}`;

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <BackLink label="Arena" onPress={onClose} />
          <Text style={styles.title}>FACEOFF</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subtitle}>
          SCORES · SPORTS · OPEN CHALLENGES · TIPS
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LIVE SCORES</Text>
            <ScoresSportsPanel />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPORTS</Text>
            <View style={styles.sportGrid}>
              {SPORT_GRID.map((pill) => {
                const active = sport === pill;
                return (
                  <TouchableOpacity
                    key={pill}
                    style={[styles.sportCell, active && styles.sportCellOn]}
                    onPress={() =>
                      onSelectSport?.(canonicalizeSport(pill) || pill)
                    }
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filter ${pill}`}
                  >
                    <Text
                      style={[
                        styles.sportCellText,
                        active && styles.sportCellTextOn,
                      ]}
                      numberOfLines={1}
                    >
                      {pill}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <CalloutSection
            title="OPEN CHALLENGES"
            emptyTitle={`NO${sportLabel} OPEN CHALLENGES`}
            emptySub="Launch a performance or 1v1 callout from Battles or + BATTLE."
            items={openChallenges}
            focusChallengeId={focusChallengeId}
            onRespond={onRespond}
            onOpenResponses={onOpenResponses}
          />

          <CalloutSection
            title="TIPS & BREAKDOWNS"
            emptyTitle={`NO${sportLabel} TIPS`}
            emptySub="Ask for technique advice or a form-check — athletes can break it down."
            items={tipCallouts}
            focusChallengeId={focusChallengeId}
            onRespond={onRespond}
            onOpenResponses={onOpenResponses}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 36,
  },
  headerSpacer: {
    width: 88,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  sportCell: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WHITE,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  sportCellOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sportCellText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sportCellTextOn: {
    fontWeight: '900',
  },
  emptyBox: {
    marginHorizontal: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
  },
  emptyTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptySub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  challengeCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  challengeCardFocus: {
    borderColor: FLAME,
  },
  challengeTop: {
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
  challengeHandle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  challengeTarget: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  challengeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  respondBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
  },
  respondBtnText: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default memo(FaceoffHub);
