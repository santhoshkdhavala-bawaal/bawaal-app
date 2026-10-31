/**
 * Full-page athlete passport — reels, photo grid, history.
 * Opened from Passport inline preview via "VIEW FULL PROFILE".
 * B&W chrome; accents only on stats/metrics + official BAWAAL "B" badge.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import UserHandle from './src/components/UserHandle';
import RoleBadge from './src/components/RoleBadge';
import ProfileMediaTabs from './src/components/ProfileMediaTabs';
import BackLink from './src/components/BackLink';
import DMChatSheet from './DMChatSheet';
import { supabase } from './src/services/supabase';
import { clearRegisteredSession } from './sessionStore';

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const OFF = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';
const DM_BLUE = '#3B82F6';

export default function AthletePassportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [dmOpen, setDmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const athlete = useMemo(() => {
    const fromParams = route?.params?.athlete;
    if (fromParams?.id) return fromParams;
    return findAthleteById(route?.params?.athleteId) || findAthleteById('me');
  }, [route?.params?.athlete, route?.params?.athleteId]);
  const isSelf = athlete?.id === 'me';

  const handleLogOut = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Passport] supabase.auth.signOut:', err?.message || err);
      }
      await clearRegisteredSession();
      navigation?.reset?.({
        index: 0,
        routes: [{ name: 'Entry' }],
      });
    } catch (err) {
      console.warn('[Passport] log out failed:', err?.message || err);
      setLoggingOut(false);
    }
  }, [loggingOut, navigation]);

  const initials = String(athlete.displayName || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sport = athlete.sport || athlete.primarySport;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.headerBlock}>
        <Text style={styles.brand}>BAWAAL</Text>
        <TouchableOpacity
          style={[styles.logOutBtn, loggingOut && styles.logOutBtnBusy]}
          onPress={handleLogOut}
          activeOpacity={0.85}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          {loggingOut ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <Text style={styles.logOutBtnText}>LOG OUT</Text>
          )}
        </TouchableOpacity>
        <View style={styles.topBar}>
          <BackLink
            label="Back"
            onPress={() => {
              if (navigation?.canGoBack?.()) navigation.goBack();
              else navigation?.navigate?.('Main', { tab: 'Passport' });
            }}
          />
          <Text style={styles.topTitle}>ATHLETE PASSPORT</Text>
          <View style={{ width: 72 }} />
        </View>
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
          <View style={styles.handleRow}>
            <UserHandle
              handle={athlete.handle}
              verified={athlete.verified}
              size={13}
              color={MUTED}
            />
            {sport ? <Text style={styles.sportSep}> · {sport}</Text> : null}
          </View>
          <View style={styles.roleRow}>
            <RoleBadge role={athlete.role || 'athlete'} />
            {athlete.statusBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{athlete.statusBadge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.bio}>{athlete.bio}</Text>
          {!isSelf ? (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => setDmOpen(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Message athlete"
            >
              <Text style={styles.messageBtnText}>MESSAGE / DM</Text>
            </TouchableOpacity>
          ) : null}
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

        <Text style={styles.section}>Media</Text>
        <ProfileMediaTabs
          clips={athlete.clips || []}
          photos={athlete.photos || []}
        />

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

      <DMChatSheet
        visible={dmOpen}
        peer={athlete}
        onClose={() => setDmOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  messageBtn: {
    marginTop: 14,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: DM_BLUE,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  messageBtnText: {
    color: DM_BLUE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  headerBlock: {
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  brand: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  logOutBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    marginBottom: 12,
  },
  logOutBtnBusy: {
    opacity: 0.55,
  },
  logOutBtnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sportSep: {
    color: MUTED,
    fontSize: 13,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  badge: {
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
