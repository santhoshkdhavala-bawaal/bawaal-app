/**
 * PASSPORT tab hub — my profile + Following + Suggested.
 * Tap an athlete → inline preview; "VIEW FULL PROFILE" → AthletePassport stack screen.
 *
 * LOCKED production surface — header card, stats, blue FOLLOWING rings,
 * crimson SUGGESTED / + Follow as shipped. Do not modify without an explicit unlock.
 * See `.cursor/rules/bawaal-passport-locked.mdc`.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BrandHeader from './BrandHeader';
import { useMainTabs } from './mainTabContext';
import {
  CURRENT_USER,
  FOLLOWING,
  STAT_ACCENTS,
  SUGGESTED,
} from './src/data/athleteSocial';
import UserHandle from './src/components/UserHandle';
import RoleBadge from './src/components/RoleBadge';
import VerifiedBadge from './src/components/VerifiedBadge';
import { refreshArenaPostsFromSupabase } from './arenaFeedStore';
import { fetchPassportGraph } from './src/services/profilesService';

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const OFF = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.22)';
/** FOLLOWING section — electric blue avatar rings / header */
const FOLLOW_BLUE = '#3B82F6';
/** SUGGESTED ATHLETES — electric crimson header / + Follow */
const SUGGEST_RED = '#FF3366';

function Avatar({ uri, name, size = 56, ringColor }) {
  const ring = ringColor || BORDER;
  const initials = String(name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SURFACE,
          borderWidth: ringColor ? 2 : 1,
          borderColor: ring,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: SURFACE,
        borderWidth: ringColor ? 2 : 1,
        borderColor: ringColor || WHITE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

function AccentStat({ label, value, accent = 'blue' }) {
  const color = STAT_ACCENTS[accent] || STAT_ACCENTS.blue;
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MeCard({ user }) {
  return (
    <View style={styles.card}>
      <View style={styles.meRow}>
        <Avatar uri={user.avatarUri} name={user.displayName} size={64} />
        <View style={styles.meMeta}>
          <Text style={styles.meName}>{user.displayName}</Text>
          <UserHandle
            handle={user.handle}
            verified={user.verified}
            size={12}
            color={MUTED}
            textStyle={styles.meHandle}
          />
          <View style={styles.roleRow}>
            <RoleBadge role={user.role || 'athlete'} compact />
            {user.statusBadge ? (
              <View style={styles.badgeBw}>
                <Text style={styles.badgeBwText}>{user.statusBadge}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <Text style={styles.bio}>{user.bio}</Text>
      <View style={styles.statsRow}>
        <AccentStat
          label="FOLLOWERS"
          value={user.stats.followers}
          accent="blue"
        />
        <AccentStat
          label="FOLLOWING"
          value={user.stats.following}
          accent="green"
        />
        <AccentStat
          label="WIN RATE"
          value={`${user.stats.winRate}%`}
          accent="red"
        />
      </View>
    </View>
  );
}

const FollowChip = memo(function FollowChip({ athlete, onPress }) {
  return (
    <TouchableOpacity
      style={styles.followChip}
      onPress={() => onPress(athlete)}
      activeOpacity={0.85}
    >
      <Avatar
        uri={athlete.avatarUri}
        name={athlete.displayName}
        size={48}
        ringColor={FOLLOW_BLUE}
      />
      {athlete.online ? <View style={styles.onlineDot} /> : null}
      <View style={styles.followChipNameRow}>
        <Text style={styles.followChipName} numberOfLines={1}>
          {athlete.displayName.split(' ')[0]}
        </Text>
        {athlete.verified ? <VerifiedBadge size={11} /> : null}
      </View>
      <Text style={styles.followChipSport}>{athlete.sport}</Text>
    </TouchableOpacity>
  );
});

const SuggestedRow = memo(function SuggestedRow({
  athlete,
  following,
  onOpen,
  onToggleFollow,
}) {
  return (
    <TouchableOpacity
      style={styles.suggestedRow}
      onPress={() => onOpen(athlete)}
      activeOpacity={0.88}
    >
      <Avatar uri={athlete.avatarUri} name={athlete.displayName} size={44} />
      <View style={styles.suggestedMeta}>
        <View style={styles.suggestedNameRow}>
          <Text style={styles.suggestedName} numberOfLines={1}>
            {athlete.displayName}
          </Text>
          <RoleBadge role={athlete.role || 'athlete'} compact />
        </View>
        <View style={styles.suggestedHandleRow}>
          <UserHandle
            handle={athlete.handle}
            verified={athlete.verified}
            size={11}
            color={MUTED}
          />
          <Text style={styles.suggestedHandle}> · {athlete.sport}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, following && styles.followBtnOn]}
        onPress={() => onToggleFollow(athlete.id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.followBtnText, following && styles.followBtnTextOn]}>
          {following ? 'Following' : '+ Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function InlineAthletePreview({ athlete, following, onBack, onOpenFull, onToggleFollow }) {
  return (
    <View style={styles.previewWrap}>
      <TouchableOpacity style={styles.backInline} onPress={onBack} hitSlop={10}>
        <Text style={styles.backInlineText}>← Back to Passport</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.previewHeader}>
          <Avatar uri={athlete.avatarUri} name={athlete.displayName} size={60} />
          <View style={styles.previewHeaderMeta}>
            <Text style={styles.meName}>{athlete.displayName}</Text>
            <View style={styles.suggestedHandleRow}>
              <UserHandle
                handle={athlete.handle}
                verified={athlete.verified}
                size={12}
                color={MUTED}
              />
              <Text style={styles.meHandle}> · {athlete.sport}</Text>
            </View>
            <View style={styles.roleRow}>
              <RoleBadge role={athlete.role || 'athlete'} compact />
            </View>
            <TouchableOpacity
              style={styles.viewFullBtn}
              onPress={onOpenFull}
              activeOpacity={0.9}
            >
              <Text style={styles.viewFullBtnText}>VIEW FULL PROFILE</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.bio}>{athlete.bio}</Text>

        <View style={styles.statsRow}>
          <AccentStat
            label="FOLLOWERS"
            value={athlete.stats.followers}
            accent="blue"
          />
          <AccentStat
            label="WINS"
            value={athlete.stats.battlesWon}
            accent="green"
          />
          <AccentStat
            label="WIN RATE"
            value={`${athlete.stats.winRate}%`}
            accent="red"
          />
        </View>

        <TouchableOpacity
          style={[styles.followBtnWide, following && styles.followBtnOn]}
          onPress={() => onToggleFollow(athlete.id)}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.followBtnText, following && styles.followBtnTextOn]}
          >
            {following ? 'Following' : '+ Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHint}>
        Open their full passport for clips & history.
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { openProfileGateway } = useMainTabs();
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState(CURRENT_USER);
  const [followingList, setFollowingList] = useState(FOLLOWING);
  const [suggestedList, setSuggestedList] = useState(SUGGESTED);
  const [followedIds, setFollowedIds] = useState(
    () => new Set(FOLLOWING.map((a) => a.id))
  );

  const loadProfiles = useCallback(async () => {
    const graph = await fetchPassportGraph();
    setMe(graph.me || CURRENT_USER);
    setFollowingList(graph.following?.length ? graph.following : FOLLOWING);
    setSuggestedList(graph.suggested?.length ? graph.suggested : SUGGESTED);
    setFollowedIds(new Set((graph.following || FOLLOWING).map((a) => a.id)));
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const toggleFollow = useCallback((id) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openPreview = useCallback((athlete) => {
    setSelected(athlete);
  }, []);

  const openFullPassport = useCallback(() => {
    if (!selected) return;
    navigation?.navigate?.('AthletePassport', {
      athleteId: selected.id,
      athlete: selected,
    });
  }, [navigation, selected]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshArenaPostsFromSupabase(), loadProfiles()]);
    } catch (err) {
      console.warn('[Passport] refresh failed:', err?.message || err);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfiles]);

  return (
    <View style={styles.container}>
      <BrandHeader
        screenName="PASSPORT"
        onBrandPress={openProfileGateway}
        rightSlot={
          selected ? (
            <TouchableOpacity
              style={styles.headerLink}
              onPress={() => setSelected(null)}
              hitSlop={10}
            >
              <Text style={styles.headerLinkText}>Hub</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={WHITE}
            colors={[WHITE]}
            progressBackgroundColor={SURFACE}
          />
        }
      >
        {selected ? (
          <InlineAthletePreview
            athlete={selected}
            following={followedIds.has(selected.id)}
            onBack={() => setSelected(null)}
            onOpenFull={openFullPassport}
            onToggleFollow={toggleFollow}
          />
        ) : (
          <>
            <MeCard user={me} />

            <Text style={[styles.sectionTitle, styles.followingSectionTitle]}>
              FOLLOWING
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followingRow}
            >
              {followingList.map((athlete) => (
                <FollowChip
                  key={athlete.id}
                  athlete={athlete}
                  onPress={openPreview}
                />
              ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, styles.suggestedSectionTitle]}>
              SUGGESTED ATHLETES
            </Text>
            {suggestedList.map((athlete) => (
              <SuggestedRow
                key={athlete.id}
                athlete={athlete}
                following={followedIds.has(athlete.id)}
                onOpen={openPreview}
                onToggleFollow={toggleFollow}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 18,
  },
  meRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  meMeta: {
    flex: 1,
    minWidth: 0,
  },
  meName: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
  },
  meHandle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badgeBw: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeBwText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bio: {
    color: OFF,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  avatarText: {
    color: WHITE,
    fontWeight: '900',
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  followingSectionTitle: {
    color: FOLLOW_BLUE,
    letterSpacing: 1.6,
  },
  suggestedSectionTitle: {
    color: SUGGEST_RED,
    letterSpacing: 1.6,
  },
  followingRow: {
    gap: 12,
    paddingBottom: 8,
    marginBottom: 18,
  },
  followChip: {
    width: 84,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    backgroundColor: SURFACE,
  },
  followChipNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  followChipName: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 62,
  },
  followChipSport: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  onlineDot: {
    position: 'absolute',
    right: 14,
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: STAT_ACCENTS.green,
    borderWidth: 2,
    borderColor: SURFACE,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    marginBottom: 10,
  },
  suggestedMeta: {
    flex: 1,
    minWidth: 0,
  },
  suggestedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestedName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  suggestedHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  suggestedHandle: {
    color: MUTED,
    fontSize: 11,
  },
  followBtn: {
    borderWidth: 1.5,
    borderColor: SUGGEST_RED,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  followBtnOn: {
    backgroundColor: 'rgba(255, 51, 102, 0.16)',
    borderColor: SUGGEST_RED,
  },
  followBtnText: {
    color: SUGGEST_RED,
    fontSize: 11,
    fontWeight: '800',
  },
  followBtnTextOn: {
    color: SUGGEST_RED,
  },
  followBtnWide: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewWrap: {
    gap: 4,
  },
  backInline: {
    marginBottom: 10,
  },
  backInlineText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  previewHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  previewHeaderMeta: {
    flex: 1,
    minWidth: 0,
  },
  viewFullBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewFullBtnText: {
    color: BG,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sectionHint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  headerLink: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerLinkText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
  },
});
