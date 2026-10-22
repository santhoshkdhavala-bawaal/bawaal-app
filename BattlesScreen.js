import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import BrandHeader from './BrandHeader';
import CreateBattleSheet from './CreateBattleSheet';
import { useMainTabs } from './mainTabContext';

const OBSIDIAN = '#000000';
const LIGHT_RED = '#FF4D4D';
const LIGHT_YELLOW = '#F4F1DE';
const FLAME_ORANGE = '#FF5722';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(232,236,233,0.28)';
const CARD = '#121212';

const SEED_BATTLES = [
  {
    id: 'b1',
    sport: 'GYM',
    target: '140 KG x 3 Reps',
    description: null,
    host: '@Yuki_Lift',
    responses: 10,
    status: 'OPEN',
  },
  {
    id: 'b2',
    sport: 'CRICKET',
    target: null,
    description: 'Cover drive · 6 balls',
    host: '@Rohit_VK7',
    responses: 4,
    status: 'OPEN',
  },
  {
    id: 'b3',
    sport: 'COMBAT',
    target: '3-round shadow spar',
    description: null,
    host: '@Aman_Striker',
    responses: 7,
    status: 'HOT',
  },
];

const DEFAULT_FEATURED = {
  challengeTitle: '100 Pushups Sprint',
  hostFlag: '🇮🇳',
  rivalFlag: null,
  hostLabel: 'IND',
  rivalLabel: null,
};

function featuredSubtitle(featured) {
  const title = featured?.challengeTitle || 'Open Challenge';
  const hostSide = featured?.hostFlag || featured?.hostLabel || 'HOST';
  const rivalSide = featured?.rivalFlag || featured?.rivalLabel || '…';
  return `${title} · ${hostSide} vs ${rivalSide}`;
}

export default function BattlesScreen({ navigation }) {
  const { openProfileGateway } = useMainTabs();
  const [filter, setFilter] = useState('OPEN');
  const [battles, setBattles] = useState(SEED_BATTLES);
  const [createOpen, setCreateOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const ensureMediaPermissions = useCallback(async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
    }
  }, [
    cameraPermission?.granted,
    micPermission?.granted,
    requestCameraPermission,
    requestMicPermission,
  ]);

  const featuredLive = (() => {
    const live = battles.find((b) => b.status === 'LIVE' && b.liveMatch);
    if (!live?.liveMatch) return DEFAULT_FEATURED;
    const m = live.liveMatch;
    const rival =
      m.challenger ||
      (Array.isArray(m.challengers) && m.challengers[0]) ||
      null;
    return {
      battleId: live.id,
      match: m,
      challengeTitle:
        m.category?.replace(/^\[[^\]]+\]\s*/, '') ||
        live.target ||
        DEFAULT_FEATURED.challengeTitle,
      hostFlag: m.host?.flag || DEFAULT_FEATURED.hostFlag,
      rivalFlag: rival?.flag || null,
      hostLabel: m.host?.label || DEFAULT_FEATURED.hostLabel,
      rivalLabel: rival?.label || null,
    };
  })();

  const openChallenge = (battle) => {
    if (battle.liveMatch) {
      navigation?.navigate?.('Live1v1Battle', {
        match: battle.liveMatch,
        battleId: battle.id || battle.liveMatch.battleId || battle.liveMatch.id,
        role: 'spectator',
      });
      return;
    }
    const label = battle.target || battle.description || 'OPEN CHALLENGE';
    navigation?.navigate?.('Challenge', {
      challengeMaxDuration: 30,
      battleId: battle.id,
      target: label,
      handle: battle.host.replace(/^@/, ''),
      reel: {
        id: battle.id,
        battleId: battle.id,
        creator: battle.host.replace(/^@/, ''),
        statSticker: label,
        category: battle.sport,
        challengeMaxDuration: 30,
        durationSec: 30,
      },
    });
  };

  const openLiveArena = async (role = 'spectator') => {
    await ensureMediaPermissions();
    navigation?.navigate?.('Live1v1Battle', {
      role,
      battleId: featuredLive.battleId,
      match: featuredLive.match,
    });
  };

  const listCtaLabel = (battle) => {
    if (battle.status === 'HOT' || battle.status === 'LIVE') return 'CHALLENGE';
    return 'ACCEPT';
  };

  const onLaunchBattle = (battle) => {
    setBattles((prev) => [battle, ...prev]);
    navigation?.navigate?.('Live1v1Battle', {
      match: battle.liveMatch,
      role: 'host',
      battleId: battle.id,
      notifications: battle.notifications,
      scheduledAtUTC: battle.scheduledAtUTC,
    });
  };

  const visible = battles.filter((b) => {
    if (filter === 'MINE') return b.host === '@MUMBAI_STRIKER' || b.status === 'LIVE';
    if (filter === 'HOT') return b.status === 'HOT' || b.status === 'LIVE';
    return true;
  });

  const filterStyle = (f) => {
    if (filter !== f) return styles.filterPill;
    if (f === 'OPEN') return [styles.filterPill, styles.filterOpen];
    if (f === 'MINE') return [styles.filterPill, styles.filterMine];
    return [styles.filterPill, styles.filterHot];
  };
  const filterTextStyle = (f) => {
    if (filter !== f) return styles.filterText;
    if (f === 'MINE') return [styles.filterText, styles.filterTextDark];
    return [styles.filterText, styles.filterTextOn];
  };

  return (
    <View style={styles.container}>
      <BrandHeader screenName="BATTLES" onBrandPress={openProfileGateway} />

      <View style={styles.filterRow}>
        {['OPEN', 'HOT', 'MINE'].map((f) => (
          <TouchableOpacity key={f} style={filterStyle(f)} onPress={() => setFilter(f)}>
            <Text style={filterTextStyle(f)}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.featuredCard}>
          <Text style={styles.featuredTitle}>🔴 LIVE 1v1 BATTLE BAWAAL</Text>
          <Text style={styles.featuredSubtitle} numberOfLines={1}>
            {featuredSubtitle(featuredLive)}
          </Text>
          <View style={styles.featuredActions}>
            <TouchableOpacity
              style={[styles.featuredBtn, styles.featuredBtnOutline]}
              activeOpacity={0.85}
              onPress={() => openLiveArena('spectator')}
            >
              <Text style={styles.featuredBtnOutlineText}>👁️ WATCH LIVE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.featuredBtn, styles.featuredBtnSolid]}
              activeOpacity={0.85}
              onPress={() => openLiveArena('challenger')}
            >
              <Text style={styles.featuredBtnSolidText}>⚔️ ACCEPT CHALLENGE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {visible.map((battle) => {
          const title = battle.target || battle.description || 'OPEN CHALLENGE';
          return (
            <View key={battle.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.titleRow}>
                  <Text style={styles.sportTag}>[{battle.sport}]</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  by {battle.host} · {battle.responses} responded
                  {battle.status === 'LIVE' ? ' · LIVE' : ''}
                  {battle.status === 'SCHEDULED' ? ' · SCHEDULED' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.enterBtn}
                activeOpacity={0.85}
                onPress={() => openChallenge(battle)}
              >
                <Text style={styles.enterBtnText}>{listCtaLabel(battle)}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.createBtn}
          activeOpacity={0.85}
          onPress={() => setCreateOpen(true)}
        >
          <Text style={styles.createBtnText}>🔥 CREATE NEW CHALLENGE</Text>
        </TouchableOpacity>
      </ScrollView>

      <CreateBattleSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onLaunch={onLaunchBattle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OBSIDIAN },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  filterOpen: { backgroundColor: LIGHT_RED, borderColor: LIGHT_RED },
  filterMine: { backgroundColor: LIGHT_YELLOW, borderColor: LIGHT_YELLOW },
  filterHot: { backgroundColor: FLAME_ORANGE, borderColor: FLAME_ORANGE },
  filterText: { color: MUTED, fontSize: 11, fontWeight: '800' },
  filterTextOn: { color: WHITE },
  filterTextDark: { color: OBSIDIAN },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sportTag: {
    color: FLAME_ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  title: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  meta: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  enterBtn: {
    backgroundColor: '#E8ECE9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 92,
    alignItems: 'center',
  },
  enterBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  featuredCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: FLAME_ORANGE,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 14,
  },
  featuredTitle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  featuredSubtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 12,
  },
  featuredActions: {
    flexDirection: 'row',
    gap: 8,
  },
  featuredBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: FLAME_ORANGE,
  },
  featuredBtnSolid: {
    backgroundColor: FLAME_ORANGE,
    borderWidth: 1.5,
    borderColor: FLAME_ORANGE,
  },
  featuredBtnOutlineText: {
    color: FLAME_ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  featuredBtnSolidText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  createBtn: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8ECE9',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
