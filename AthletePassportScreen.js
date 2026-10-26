/**
 * Full-page athlete passport — clips + history.
 * Opened from Passport inline preview via "VIEW FULL PROFILE".
 * B&W chrome; accent color reserved for stats/metrics only.
 */
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  findAthleteById,
  STAT_ACCENTS,
} from './src/data/athleteSocial';

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const OFF = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';

export default function AthletePassportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const athlete = useMemo(() => {
    const fromParams = route?.params?.athlete;
    if (fromParams?.id) return fromParams;
    return findAthleteById(route?.params?.athleteId) || findAthleteById('me');
  }, [route?.params?.athlete, route?.params?.athleteId]);

  const initials = String(athlete.displayName || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else navigation?.navigate?.('Main', { tab: 'Passport' });
          }}
          hitSlop={12}
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>ATHLETE PASSPORT</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 28) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{athlete.displayName}</Text>
          <Text style={styles.handle}>
            {athlete.handle} · {athlete.sport || athlete.primarySport}
          </Text>
          {athlete.statusBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{athlete.statusBadge}</Text>
            </View>
          ) : null}
          <Text style={styles.bio}>{athlete.bio}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: STAT_ACCENTS.blue }]}>
              {athlete.stats?.followers ?? 0}
            </Text>
            <Text style={styles.statLbl}>FOLLOWERS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: STAT_ACCENTS.green }]}>
              {athlete.stats?.battlesWon ?? 0}
            </Text>
            <Text style={styles.statLbl}>WINS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: STAT_ACCENTS.red }]}>
              {athlete.stats?.winRate ?? 0}%
            </Text>
            <Text style={styles.statLbl}>WIN RATE</Text>
          </View>
        </View>

        <Text style={styles.section}>Performance</Text>
        {(athlete.metrics || []).map((m) => {
          const color = STAT_ACCENTS[m.accent] || STAT_ACCENTS.blue;
          return (
            <View key={m.id} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={[styles.metricValue, { color }]}>
                  {m.value} / 100
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${m.value}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        })}

        <Text style={styles.section}>Recorded Clips</Text>
        <View style={styles.clipGrid}>
          {(athlete.clips || []).map((clip) => (
            <View key={clip.id} style={styles.clipCard}>
              <View style={styles.clipThumb}>
                <Text style={styles.clipPlay}>▶</Text>
              </View>
              <Text style={styles.clipTitle} numberOfLines={2}>
                {clip.title}
              </Text>
              <Text style={styles.clipSport}>{clip.sport}</Text>
            </View>
          ))}
          {(athlete.clips || []).length === 0 ? (
            <Text style={styles.empty}>No clips yet.</Text>
          ) : null}
        </View>

        <Text style={styles.section}>History</Text>
        <View style={styles.historyCard}>
          <Text style={styles.historyLine}>
            BAWAAL Pts{' '}
            <Text style={{ color: STAT_ACCENTS.blue }}>
              {athlete.stats?.bawaalPts ?? 0}
            </Text>
          </Text>
          <Text style={styles.historyLine}>
            Local rank{' '}
            <Text style={{ color: STAT_ACCENTS.green }}>
              #{athlete.stats?.rank ?? '—'}
            </Text>
          </Text>
          <Text style={styles.historyMuted}>
            Full match history syncs from Supabase when cloud profiles ship.
          </Text>
        </View>
      </ScrollView>
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  back: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    width: 64,
  },
  topTitle: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  content: {
    padding: 16,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: WHITE,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
  },
  name: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  handle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4,
  },
  badge: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bio: {
    color: OFF,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLbl: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  section: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 6,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    padding: 12,
    marginBottom: 10,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    color: OFF,
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  clipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  clipCard: {
    width: '47.5%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  clipThumb: {
    height: 96,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  clipPlay: {
    color: WHITE,
    fontSize: 18,
  },
  clipTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  clipSport: {
    color: MUTED,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 2,
  },
  empty: {
    color: MUTED,
    fontSize: 12,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: SURFACE,
    padding: 14,
    gap: 8,
  },
  historyLine: {
    color: OFF,
    fontSize: 13,
    fontWeight: '700',
  },
  historyMuted: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
});
