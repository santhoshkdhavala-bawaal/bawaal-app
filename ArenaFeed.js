import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Pressable,
  Animated,
  Share,
  Easing,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { consumeLatestBattleClip, peekLatestBattleClip } from './battleClipStore';
import {
  subscribeArenaPosts,
  drainPendingArenaPosts,
  getArenaPosts,
  hydrateArenaPostsFromSupabase,
  refreshArenaPostsFromSupabase,
} from './arenaFeedStore';
import BrandHeader from './BrandHeader';
import ResponseReelDrawer from './ResponseReelDrawer';
import ArenaReelViewer from './ArenaReelViewer';
import BanterBottomSheet from './BanterBottomSheet';
import { useMainTabs } from './mainTabContext';
import { resolveFeedVideoUri } from './src/components/SafeFeedVideo';
import ArenaClipPlayer from './src/components/ArenaClipPlayer';
import MuteToggleButton from './src/components/MuteToggleButton';
import UserHandle from './src/components/UserHandle';
import { isHandleVerified } from './src/data/athleteSocial';
import { resolvePostSport } from './src/utils/sportCategory';
import GameOnHub from './src/components/GameOnHub';
import CommunityChallengesShelf from './src/components/CommunityChallengesShelf';
import { useArenaFeed } from './src/hooks/useArenaFeed';
import { useBattles } from './src/hooks/useBattles';
import { fetchArenaFeed } from './src/services/api';
import { seedBattlesOpenCallouts } from './src/utils/faceoffCallout';

/** Insert an inline community shelf after every N video/battle rows. */
const COMMUNITY_SHELF_INTERVAL = 4;
/** Cold-start rule: indices 0–1 must always be video/battle media — never a shelf. */
const MIN_MEDIA_BEFORE_SHELF = 2;

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const PLATINUM = '#E8ECE9';
const LIVE_CRIMSON = '#FF0033';
const FLAME_ORANGE = '#FF5722';
const CRIMSON = LIVE_CRIMSON;
const GOLD = FLAME_ORANGE;

/** Stable FlatList viewability config — must not be recreated each render. */
const ARENA_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 55,
  minimumViewTime: 80,
};

const DEMO_ATHLETE_HANDLES = [
  'Aarav_Iron',
  'Neha_Lift',
  'Karan_Pull',
  'Mia_Torque',
  'Dev_Snatch',
  'Riya_Core',
  'Omar_Press',
  'Sana_Drive',
  'Leo_Hang',
  'Zoe_Reps',
];

function buildDemoResponses(challengeId) {
  return DEMO_ATHLETE_HANDLES.map((handle, i) => ({
    id: `${challengeId}-r${i + 1}`,
    creator: handle,
    videoUri: null,
    votes: 120 - i * 9 + ((i * 3) % 7),
    createdAt: Date.now() - i * 3600_000,
    rank: i + 1,
  }));
}

/** Stable ids for always-on official battle shells (ChallengeCam Respond targets). */
const DEFAULT_BATTLE_GYM_ID = 'challenge-gym-yuki';
const DEFAULT_BATTLE_CRICKET_ID = 'challenge-cricket-rohit';
const DEFAULT_BATTLE_COMBAT_ID = 'challenge-combat-aman';
/** Fixed epoch offsets so ensureDefaultBattles does not remint card identities each render. */
const DEFAULT_BATTLE_EPOCH = 1_700_000_000_000;

/** Official mock battles — always present so Respond / ChallengeCam is testable. */
function seedDefaultOfficialBattles() {
  const gymResponses = buildDemoResponses(DEFAULT_BATTLE_GYM_ID);
  const cricketResponses = buildDemoResponses(DEFAULT_BATTLE_CRICKET_ID).slice(0, 6);
  const combatResponses = buildDemoResponses(DEFAULT_BATTLE_COMBAT_ID).slice(0, 8);

  return [
    {
      id: DEFAULT_BATTLE_GYM_ID,
      challengeId: DEFAULT_BATTLE_GYM_ID,
      type: 'battle_thread',
      sport: 'GYM',
      category: 'GYM',
      author: 'CHALLENGE',
      opponent: '@Yuki_Lift',
      challengerLabel: 'YOU',
      leaderLabel: `@${gymResponses[0].creator}`,
      target: '140 KG x 3 Reps',
      status: 'LIVE BATTLE',
      calloutKind: 'OPEN_CHALLENGE',
      challengeVideoUri: null,
      responses: gymResponses,
      createdAt: DEFAULT_BATTLE_EPOCH - 86_400_000,
      _demoBattle: true,
    },
    {
      id: DEFAULT_BATTLE_CRICKET_ID,
      challengeId: DEFAULT_BATTLE_CRICKET_ID,
      type: 'battle_thread',
      sport: 'CRICKET',
      category: 'CRICKET',
      author: 'CHALLENGE',
      opponent: '@Rohit_VK7',
      challengerLabel: 'YOU',
      leaderLabel: `@${cricketResponses[0].creator}`,
      target: 'Cover drive · 6 balls',
      status: 'OPEN',
      calloutKind: 'OPEN_CHALLENGE',
      challengeVideoUri: null,
      responses: cricketResponses,
      createdAt: DEFAULT_BATTLE_EPOCH - 50_000_000,
      _demoBattle: true,
    },
    {
      id: DEFAULT_BATTLE_COMBAT_ID,
      challengeId: DEFAULT_BATTLE_COMBAT_ID,
      type: 'battle_thread',
      sport: 'COMBAT',
      category: 'COMBAT',
      author: 'CHALLENGE',
      opponent: '@Aman_Striker',
      challengerLabel: 'YOU',
      leaderLabel: `@${combatResponses[0].creator}`,
      target: '3-round shadow spar',
      status: 'HOT',
      calloutKind: 'OPEN_CHALLENGE',
      challengeVideoUri: null,
      responses: combatResponses,
      createdAt: DEFAULT_BATTLE_EPOCH - 20_000_000,
      _demoBattle: true,
    },
  ];
}

/** Merge missing default official battles without wiping live / fresh posts. */
function ensureDefaultBattles(items) {
  const list = Array.isArray(items) ? [...items] : [];
  const ids = new Set(list.map((p) => p?.id).filter(Boolean));
  for (const battle of seedDefaultOfficialBattles()) {
    if (ids.has(battle.id)) continue;
    list.push(battle);
    ids.add(battle.id);
  }
  return list;
}

function isOfficialBattlePost(post) {
  if (!post) return false;
  if (post.type === 'battle_thread' || post.type === 'battle') return true;
  if (post.isBattle === true || post.isBattleResponse === true) return true;
  if (post.challengeId || post.battleId) return true;
  return false;
}

/** Stable key for the same cloud clip (dedupe storage fallback vs DB rows). */
function videoIdentityKey(uri) {
  if (!uri || typeof uri !== 'string') return '';
  const clean = uri.split('?')[0].trim().toLowerCase();
  const battles = clean.match(/\/battles\/([^/]+)$/);
  if (battles) return `battles/${battles[1]}`;
  return clean;
}

/** Fresh publishes always sort above older cloud / demo clips (no MMA flash). */
function feedSortScore(item) {
  const ts = Number(item?.createdAt) || 0;
  const fresh =
    item?._freshPublish === true || ts > Date.now() - 120_000 ? 1e15 : 0;
  return fresh + ts;
}

function sortFeedItems(list) {
  return [...(list || [])].sort(
    (a, b) => feedSortScore(b) - feedSortScore(a)
  );
}

function mapPostToReel(post) {
  const uri =
    resolveFeedVideoUri(post) ||
    post?.videoUri ||
    post?.video_url ||
    post?.uri ||
    post?.localVideoUri ||
    null;
  const ts = post.timestamp || post.createdAt || Date.now();
  const rawHandle =
    post.author ||
    post.handle ||
    (post.creator === 'You' || post.creator === 'YOU' ? '@you' : post.creator) ||
    '@athlete';
  const author = String(rawHandle).startsWith('@')
    ? String(rawHandle)
    : `@${String(rawHandle).replace(/^@/, '')}`;
  const videoKey = videoIdentityKey(uri);
  // Prefer real id; never use bare Date.now() alone (collides in same tick)
  const id = String(
    post.id || (videoKey ? `reel-${videoKey}` : `reel-${ts}-${author}`)
  );
  const sport = resolvePostSport(post, 'GYM');
  const fresh =
    post._freshPublish === true ||
    ts > Date.now() - 120_000 ||
    author === '@you';
  const localVideoUri =
    typeof post.localVideoUri === 'string' && post.localVideoUri.trim()
      ? post.localVideoUri.trim()
      : uri && String(uri).startsWith('file://')
        ? uri
        : null;
  return {
    id,
    type: 'reel',
    sport,
    category: sport,
    verified: !!post.verified,
    author,
    caption: post.caption || post.title || post.target || 'Arena drop',
    hypeCount: post.hypeCount || 0,
    videoUri: uri,
    uri,
    video_url: post.video_url || null,
    localVideoUri,
    publicCloudUrl: post.publicCloudUrl || null,
    createdAt: ts,
    _freshPublish: !!fresh,
  };
}

/**
 * First paint: in-memory store reels (warmup) + official challenge cards together.
 * Avoids lean empty-shell flash — null-URI demo reels are filtered from visibleFeed.
 */
function buildInitialFeed(route) {
  let items = [];
  const store = getArenaPosts();
  if (store.length > 0) {
    const ordered = [...store].sort(
      (a, b) =>
        (Number(a.timestamp || a.createdAt) || 0) -
        (Number(b.timestamp || b.createdAt) || 0)
    );
    for (const post of ordered) {
      items = ingestArenaPost(items, post);
    }
  }
  const incoming = route?.params?.newArenaPost;
  if (incoming) {
    items = ingestArenaPost(items, {
      ...incoming,
      _freshPublish: true,
      createdAt: Date.now(),
      timestamp: Date.now(),
    });
  }
  // Unified vertical feed from frame 1: challenge cards + any warm reels
  return sortFeedItems(ensureDefaultBattles(items));
}

/** Batch-ingest posts into a feed list (oldest → newest) without multiple sorts. */
function ingestPostsBatch(prev, posts) {
  let next = Array.isArray(prev) ? prev : [];
  const ordered = [...(posts || [])].sort(
    (a, b) =>
      (Number(a.timestamp || a.createdAt) || 0) -
      (Number(b.timestamp || b.createdAt) || 0)
  );
  for (const post of ordered) {
    if (!post) continue;
    next = ingestArenaPost(next, post);
  }
  return next;
}

const ClipSurface = memo(function ClipSurface({
  uri,
  source,
  label,
  style,
  muted = true,
  /** When false, skip decoder entirely (far cells). Neighbors pass active=true to warm. */
  active = true,
}) {
  const playSource = source || {
    videoUri: uri,
    video_url: uri,
    uri,
    localVideoUri: uri,
  };
  const playUri =
    uri ||
    playSource.videoUri ||
    playSource.video_url ||
    playSource.uri ||
    playSource.localVideoUri ||
    null;

  // Empty / offscreen — labeled shell (never a silent black void)
  if (!playUri || !active) {
    return (
      <View style={[styles.clipShell, style, styles.clipPlaceholder]}>
        <Text style={styles.clipPlaceholderText}>
          {!active ? '…' : label || 'NO CLIP'}
        </Text>
      </View>
    );
  }

  // Keep player keyed by URI so FlatList recycle never shows the wrong clip
  return (
    <View style={[styles.clipShell, style]}>
      <ArenaClipPlayer
        key={playUri}
        uri={playUri}
        source={playSource}
        label={label}
        style={styles.clipVideoFill}
        muted={muted}
        loop
        autoPlay
        active={active}
      />
    </View>
  );
});

function sortResponses(list, mode) {
  const copy = [...(list || [])];
  if (mode === 'latest') {
    return copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return copy.sort((a, b) => (b.votes || 0) - (a.votes || 0));
}

function mapPostToResponse(post) {
  const uri =
    resolveFeedVideoUri(post) ||
    post?.videoUri ||
    post?.video_url ||
    post?.uri ||
    post?.recordedVideoUri ||
    post?.localVideoUri ||
    null;
  const creator =
    post.creator === 'You' || post.creator === 'YOU' ? 'You' : post.creator || 'You';
  const localVideoUri =
    (typeof post.localVideoUri === 'string' && post.localVideoUri.trim()) ||
    (uri && String(uri).startsWith('file://') ? uri : null);
  return {
    id: post.id || `resp-${Date.now()}`,
    creator,
    videoUri: uri,
    uri,
    video_url: post.video_url || null,
    recordedVideoUri: post.recordedVideoUri || uri,
    localVideoUri,
    publicCloudUrl: post.publicCloudUrl || null,
    // Fresh posts from the device sit at #1 until real votes sync
    votes: post.votes ?? (creator === 'You' ? 10_000 : 1),
    createdAt: post.timestamp || post.createdAt || Date.now(),
  };
}

function ingestArenaPost(prev, post) {
  if (!post) return prev;

  // General uploads → Arena reel only (never invent a battle card)
  if (!isOfficialBattlePost(post)) {
    const reel = mapPostToReel(post);
    const videoKey = videoIdentityKey(reel.videoUri);
    // Drop same id OR same underlying video file (fixes repeating baseball clip)
    const withoutDup = prev.filter((item) => {
      if (!item || item.type !== 'reel') return true;
      if (item.id === reel.id) return false;
      if (videoKey && videoIdentityKey(item.videoUri) === videoKey) return false;
      return true;
    });
    return [reel, ...withoutDup];
  }

  const sport = resolvePostSport(post, 'GYM');
  const opponent =
    post.opponent ||
    post.host ||
    (post.challengeOf ? `@${String(post.challengeOf).replace(/^@/, '')}` : '@Challenger');
  const challengeId =
    post.challengeId ||
    post.battleId ||
    post.reel?.id ||
    `thread-${sport}-${String(opponent).replace(/\W/g, '')}`;

  // + BATTLE FAB open challenges — seed a RESPOND-ready card (no fake host response)
  const isOpenSeed =
    post.isOpenChallenge === true ||
    (post.type === 'battle_thread' &&
      String(post.status || '').toUpperCase() === 'OPEN' &&
      !post.isBattleResponse);

  if (isOpenSeed) {
    const opener =
      post.challengeVideoUri ||
      post.openerVideoUri ||
      post.videoUri ||
      post.uri ||
      null;
    const idx = prev.findIndex(
      (t) =>
        t.type === 'battle_thread' &&
        (t.challengeId === challengeId || t.id === challengeId)
    );
    const existing = idx >= 0 ? prev[idx] : null;
    const thread = {
      ...(existing || {}),
      id: challengeId,
      challengeId,
      battleId: challengeId,
      type: 'battle_thread',
      isOpenChallenge: true,
      sport,
      category: sport,
      author: 'CHALLENGE',
      opponent,
      host: opponent,
      challengerLabel: '@YOU',
      leaderLabel: 'OPEN',
      target: post.target || post.title || existing?.target || 'OPEN CHALLENGE',
      targetDetails: post.targetDetails || existing?.targetDetails || null,
      status: 'OPEN',
      challengeVideoUri: opener || existing?.challengeVideoUri || null,
      videoUri: opener || existing?.videoUri || null,
      uri: opener || existing?.uri || null,
      localVideoUri: post.localVideoUri || existing?.localVideoUri || null,
      publicCloudUrl: post.publicCloudUrl || existing?.publicCloudUrl || null,
      responses: Array.isArray(existing?.responses)
        ? existing.responses
        : Array.isArray(post.responses)
          ? post.responses
          : [],
      _freshPublish: !!post._freshPublish,
      createdAt: post._freshPublish
        ? Date.now()
        : Number(post.createdAt || post.timestamp) ||
          existing?.createdAt ||
          Date.now(),
    };
    if (idx >= 0) {
      const next = [...prev];
      next.splice(idx, 1);
      return [thread, ...next];
    }
    return [thread, ...prev];
  }

  const response = mapPostToResponse(post);
  const idx = prev.findIndex(
    (t) =>
      t.type === 'battle_thread' &&
      (t.challengeId === challengeId || t.id === challengeId)
  );

  if (idx >= 0) {
    const next = [...prev];
    const thread = { ...next[idx] };
    const withoutDup = (thread.responses || []).filter((r) => r.id !== response.id);
    thread.responses = [response, ...withoutDup];
    const leader = sortResponses(thread.responses, 'top')[0];
    thread.leaderLabel = leader
      ? leader.creator === 'You'
        ? 'YOU'
        : `@${leader.creator.replace(/^@/, '')}`
      : thread.leaderLabel;
    thread.status = 'LIVE BATTLE';
    if (!thread.challengeVideoUri && post.challengeVideoUri) {
      thread.challengeVideoUri = post.challengeVideoUri;
    }
    // Keep thread.videoUri = latest athlete response so battle cards always have a playable URI
    const responseUri =
      response.videoUri || response.uri || response.localVideoUri || null;
    if (responseUri) {
      thread.videoUri = responseUri;
      thread.uri = responseUri;
    }
    if (response.localVideoUri) {
      thread.localVideoUri = response.localVideoUri;
    }
    if (post.publicCloudUrl) {
      thread.publicCloudUrl = post.publicCloudUrl;
    }
    if (post._freshPublish) {
      thread._freshPublish = true;
      thread.createdAt = Date.now();
    }
    next.splice(idx, 1);
    return [thread, ...next];
  }

  const responses = [response, ...buildDemoResponses(challengeId).slice(0, 9)];
  const leader = sortResponses(responses, 'top')[0];
  const responseUri =
    response.videoUri || response.uri || response.localVideoUri || null;
  const thread = {
    id: challengeId,
    challengeId,
    type: 'battle_thread',
    sport,
    author: 'CHALLENGE',
    opponent,
    challengerLabel: 'YOU',
    leaderLabel: leader
      ? leader.creator === 'You'
        ? 'YOU'
        : `@${leader.creator.replace(/^@/, '')}`
      : 'YOU',
    target: post.target || 'OPEN CHALLENGE',
    status: 'LIVE BATTLE',
    // Left pane = challenge seed; right pane = athlete response (ChallengeCam URI)
    challengeVideoUri: post.challengeVideoUri || null,
    videoUri: responseUri,
    uri: responseUri,
    localVideoUri: response.localVideoUri || post.localVideoUri || null,
    publicCloudUrl: post.publicCloudUrl || null,
    _freshPublish: !!post._freshPublish,
    responses,
    createdAt: Date.now(),
  };
  return [thread, ...prev];
}

const GeneralReelCard = memo(function GeneralReelCard({
  item,
  onOpen,
  onHype,
  active = true,
  /** When true, this card is open in ArenaReelViewer — hide duplicate mute/menu. */
  immersiveOpen = false,
}) {
  const [engageOpen, setEngageOpen] = useState(false);
  const [banterOpen, setBanterOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0)).current;
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const handle = item.author?.startsWith('@')
    ? item.author
    : `@${String(item.author || 'athlete').replace(/^@/, '')}`;

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: engageOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [engageOpen, menuAnim]);

  const playFireBurst = useCallback(() => {
    fireScale.setValue(0.4);
    fireOpacity.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fireScale, {
          toValue: 1.35,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fireScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(fireOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fireOpacity, fireScale]);

  const onFirePress = useCallback(() => {
    onHype?.(item.id);
    playFireBurst();
  }, [item.id, onHype, playFireBurst]);

  /** Open reel modal via JS navigation only — never native VideoView fullscreen. */
  const openImmersive = useCallback(() => {
    try {
      setEngageOpen(false);
      setBanterOpen(false);
      // Pass current mute so immersive inherits audio without a second control flash
      onOpen?.(item, { muted });
    } catch (err) {
      console.warn('[ArenaFeed] openImmersive failed:', err?.message || err);
    }
  }, [item, onOpen, muted]);

  const openBanterSheet = useCallback(() => {
    setEngageOpen(false);
    setBanterOpen(true);
  }, []);

  const onSharePress = useCallback(async () => {
    setEngageOpen(false);
    try {
      await Share.share({
        message: `${handle} on BAWAAL Arena\n${item.caption || ''}\nhttps://bawaal.app/reel/${item.id}`,
        title: 'Share BAWAAL Reel',
      });
    } catch (_) {
      /* user dismissed */
    }
  }, [handle, item.caption, item.id]);

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const menuOpacity = menuAnim;

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  return (
    <View style={styles.reelCard}>
      {/* Video is pointerEvents=none — all taps handled by JS Pressables below */}
      <ClipSurface
        key={`clip-${item.id}`}
        uri={item.videoUri || item.video_url || item.uri || item.localVideoUri}
        source={{
          videoUri: item.videoUri,
          video_url: item.video_url,
          uri: item.uri,
          localVideoUri: item.localVideoUri,
          publicCloudUrl: item.publicCloudUrl,
          remoteVideoUri: item.remoteVideoUri,
        }}
        label={null}
        style={styles.reelFullBleed}
        muted={muted}
        // Pause feed decoder while immersive uses the same URI (no double-audio / lag)
        active={active && !immersiveOpen}
      />

      {/* Hide feed mute while fullscreen is open — prevents duplicate megaphones */}
      {!immersiveOpen ? (
        <MuteToggleButton
          muted={muted}
          onPress={toggleMute}
          style={styles.reelMuteBtn}
        />
      ) : null}

      {/* Safe middle tap → ArenaReelViewer (no native fullscreen) */}
      <Pressable
        style={styles.reelMiddleTap}
        onPress={openImmersive}
        accessibilityLabel="Open immersive reel"
      />

      <View style={styles.reelScrim} pointerEvents="none" />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.fireBurst,
          {
            opacity: fireOpacity,
            transform: [{ scale: fireScale }],
          },
        ]}
      >
        <Text style={styles.fireBurstText}>🔥</Text>
      </Animated.View>

      <View style={styles.reelBottomLeft} pointerEvents="none">
        <UserHandle
          handle={handle}
          verified={item.verified ?? isHandleVerified(handle)}
          size={13}
          color={WHITE}
          textStyle={styles.reelHandle}
        />
        <Text style={styles.reelCaptionOverlay} numberOfLines={2}>
          {item.caption}
        </Text>
      </View>

      {!immersiveOpen ? (
        <View style={styles.reelEngageWrap}>
          <Animated.View
            pointerEvents={engageOpen ? 'auto' : 'none'}
            style={[
              styles.engageDrawer,
              {
                opacity: menuOpacity,
                transform: [{ translateY: menuTranslateY }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.reelActionBtn}
              onPress={onFirePress}
              activeOpacity={0.85}
            >
              <Text style={styles.reelActionEmoji}>🔥</Text>
              <Text style={styles.reelActionCount}>{item.hypeCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reelActionBtn}
              onPress={openBanterSheet}
              activeOpacity={0.85}
            >
              <Text style={styles.reelActionEmoji}>💬</Text>
              <Text style={styles.reelActionCount}>BANTER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reelActionBtn}
              onPress={onSharePress}
              activeOpacity={0.85}
            >
              <Text style={styles.reelActionEmoji}>🚀</Text>
              <Text style={styles.reelActionCount}>SHARE</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.engageToggle}
            onPress={() => setEngageOpen((v) => !v)}
            activeOpacity={0.85}
            accessibilityLabel={
              engageOpen ? 'Close engage menu' : 'Open engage menu'
            }
          >
            <Text
              style={[
                styles.engageToggleText,
                engageOpen && styles.engageToggleTextOpen,
              ]}
            >
              {engageOpen ? '✕' : '⋮'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BanterBottomSheet
        visible={banterOpen}
        reel={item}
        onClose={() => setBanterOpen(false)}
      />
    </View>
  );
});

const BattleCard = memo(function BattleCard({
  item,
  onOpenResponses,
  onRespond,
  active = true,
}) {
  const [muted, setMuted] = useState(true);
  const isOpenChallenge =
    item?.isOpenChallenge === true ||
    String(item?.status || '').toUpperCase() === 'OPEN';
  const responses = sortResponses(item.responses, 'top');
  const leader = responses[0];
  const responseCount = responses.length;
  // Host opener benchmark (left pane for OPEN challenges)
  const openerUri =
    item.challengeVideoUri ||
    item.openerVideoUri ||
    (isOpenChallenge
      ? item.videoUri || item.uri || item.localVideoUri || null
      : null);
  // Athlete response URI — never fall back to opener on OPEN cards
  const responseUri = isOpenChallenge
    ? leader?.videoUri ||
      leader?.uri ||
      leader?.localVideoUri ||
      null
    : leader?.videoUri ||
      leader?.uri ||
      leader?.localVideoUri ||
      item.videoUri ||
      item.uri ||
      item.localVideoUri ||
      null;
  const challengeUri = isOpenChallenge
    ? openerUri
    : item.challengeVideoUri && item.challengeVideoUri !== responseUri
      ? item.challengeVideoUri
      : null;

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const leftLabel = isOpenChallenge
    ? '@YOU'
    : challengeUri
      ? item.opponent || 'CHALLENGE'
      : leader?.creator === 'You'
        ? 'YOU'
        : item.opponent || 'CLIP';

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <View style={styles.battleBadge}>
          <Text style={styles.battleBadgeText}>
            {isOpenChallenge ? 'OPEN CHALLENGE' : 'OFFICIAL BATTLE'}
          </Text>
        </View>
        <Text style={styles.feedTime}>{item.status || 'BATTLE'}</Text>
      </View>

      <View style={styles.vsRow}>
        <Text style={styles.vsTitle}>
          {isOpenChallenge
            ? '@YOU vs OPEN FIELD'
            : `${item.challengerLabel || 'YOU'} vs ${item.leaderLabel || item.opponent}`}
        </Text>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.splitPane}>
          <ClipSurface
            uri={challengeUri || (!isOpenChallenge ? responseUri : null)}
            source={{
              uri: challengeUri || (!isOpenChallenge ? responseUri : null),
              videoUri: challengeUri || (!isOpenChallenge ? responseUri : null),
              localVideoUri: isOpenChallenge
                ? item.localVideoUri || openerUri
                : challengeUri
                  ? null
                  : item.localVideoUri,
              publicCloudUrl: item.publicCloudUrl,
            }}
            label={leftLabel}
            style={styles.splitClip}
            muted={muted}
            active={active}
          />
        </View>
        <View style={styles.splitDivider}>
          <Text style={styles.splitVs}>VS</Text>
        </View>
        <View style={styles.splitPane}>
          {isOpenChallenge && !responseUri ? (
            <TouchableOpacity
              style={[styles.splitClip, styles.openSlot]}
              onPress={() => onRespond?.(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Respond to open challenge"
            >
              <Text style={styles.openSlotLabel}>CHALLENGER</Text>
              <Text style={styles.openSlotCta}>TAP TO RESPOND</Text>
            </TouchableOpacity>
          ) : (
            <ClipSurface
              uri={responseUri}
              source={{
                uri: responseUri,
                videoUri: responseUri,
                video_url: leader?.video_url,
                localVideoUri: leader?.localVideoUri || item.localVideoUri,
                recordedVideoUri: leader?.recordedVideoUri,
                publicCloudUrl: leader?.publicCloudUrl || item.publicCloudUrl,
              }}
              label={
                leader
                  ? leader.creator === 'You'
                    ? 'YOU'
                    : `@${leader.creator}`
                  : 'YOU'
              }
              active={active}
              muted={muted}
              style={styles.splitClip}
            />
          )}
        </View>
        <MuteToggleButton
          muted={muted}
          onPress={toggleMute}
          style={styles.battleMuteBtn}
        />
      </View>

      {item.targetDetails ? (
        <Text style={styles.targetDetailsText} numberOfLines={2}>
          {item.targetDetails}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.responseBadge}
        onPress={() => onOpenResponses?.(item)}
        activeOpacity={0.85}
      >
        <Text style={styles.responseBadgeText}>
          {responseCount} ATHLETE{responseCount === 1 ? '' : 'S'} RESPONDED
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.respondCta}
        onPress={() => onRespond?.(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Respond to battle"
      >
        <Text style={styles.respondCtaText}>RESPOND</Text>
      </TouchableOpacity>

      <View style={styles.feedFooter}>
        <Text style={styles.targetText}>TARGET: {item.target}</Text>
        <View style={styles.postedBadge}>
          <Text style={styles.postedText}>{item.sport}</Text>
        </View>
      </View>
    </View>
  );
});

export default function ArenaFeed({ navigation, route }) {
  const { openProfileGateway, openBattlesCallout } = useMainTabs();
  const [gameOnOpen, setGameOnOpen] = useState(false);
  const { callouts: liveCallouts, refresh: refreshOpenBattles } = useBattles();
  const { items: videoFeedItems, refresh: refreshVideoFeed } = useArenaFeed();
  const communityCallouts = useMemo(
    () =>
      Array.isArray(liveCallouts) && liveCallouts.length > 0
        ? liveCallouts
        : seedBattlesOpenCallouts(),
    [liveCallouts]
  );
  // Prefer in-memory store / just-posted clip — never flash lean demo over a fresh upload
  const [feedItems, setFeedItems] = useState(() => buildInitialFeed(route));
  const [hubThread, setHubThread] = useState(null);
  const [activeReel, setActiveReel] = useState(null);
  /** Keep last reel mounted under the modal so reopen skips a cold buffer. */
  const [warmReel, setWarmReel] = useState(null);
  const [immersiveMuted, setImmersiveMuted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Viewport index ±1 — only those cells mount decoders (prefetch neighbors). */
  const [warmIndices, setWarmIndices] = useState(() => new Set([0, 1]));
  const ingestedIds = useRef(new Set());
  const demosSeededRef = useRef(false);
  const listRef = useRef(null);
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    const next = new Set();
    for (const entry of viewableItems || []) {
      if (!entry?.isViewable) continue;
      const idx = typeof entry.index === 'number' ? entry.index : -1;
      if (idx < 0) continue;
      next.add(idx - 1);
      next.add(idx);
      next.add(idx + 1);
    }
    if (next.size === 0) {
      next.add(0);
      next.add(1);
    }
    setWarmIndices(next);
  }, []);
  /** Last absorbed playable URI per post id — blocks recursive You/fresh re-ingest loops. */
  const absorbedUriById = useRef(new Map());

  const absorbPost = useCallback((post) => {
    if (!post) return;
    const key = String(
      post.id || `${post.videoUri || post.uri || ''}-${post.timestamp || ''}`
    );
    const nextUri = String(
      post.videoUri || post.uri || post.localVideoUri || ''
    ).trim();
    const prevUri = absorbedUriById.current.get(key) || '';
    // Identical payload already in feed — never re-stamp timestamps (crash loop)
    if (key && ingestedIds.current.has(key) && prevUri === nextUri) {
      return;
    }
    // Allow one upgrade pass (file:// → https) without rewriting createdAt each emit
    const isUpgrade =
      !!prevUri &&
      !!nextUri &&
      prevUri !== nextUri &&
      ingestedIds.current.has(key);
    const ts = Number(post.timestamp || post.createdAt) || Date.now();
    const firstFresh = post._freshPublish === true && !ingestedIds.current.has(key);
    if (key) ingestedIds.current.add(key);
    if (key) absorbedUriById.current.set(key, nextUri);

    setFeedItems((prev) =>
      sortFeedItems(
        ingestArenaPost(prev, {
          ...post,
          _freshPublish: firstFresh || (isUpgrade ? false : !!post._freshPublish),
          createdAt: post.createdAt || ts,
          timestamp: post.timestamp || ts,
        })
      )
    );
    if (firstFresh) {
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
        } catch (_) {
          /* ignore */
        }
      });
    }
  }, []);

  const hypeReel = useCallback((id) => {
    setFeedItems((prev) =>
      prev.map((item) =>
        item.id === id && item.type === 'reel'
          ? { ...item, hypeCount: (item.hypeCount || 0) + 1 }
          : item
      )
    );
  }, []);

  // Live subscription — POST TO ARENA pushes here instantly (no toast)
  useEffect(() => {
    drainPendingArenaPosts().forEach(absorbPost);
    return subscribeArenaPosts(absorbPost);
  }, [absorbPost]);

  // Unified hydrate: local reels ASAP → one cloud merge with challenge cards (no UI jump)
  useEffect(() => {
    let cancelled = false;

    const applyPosts = (posts) => {
      if (cancelled || !Array.isArray(posts) || posts.length === 0) return;
      setFeedItems((prev) => {
        for (const post of posts) {
          const key =
            post?.id ||
            `${post?.videoUri || post?.uri || ''}-${post?.timestamp || ''}`;
          if (key) ingestedIds.current.add(key);
        }
        return sortFeedItems(
          ensureDefaultBattles(ingestPostsBatch(prev, posts))
        );
      });
    };

    const runUnifiedHydrate = async () => {
      try {
        // Single pipeline: device cache callback + cloud `videos` (store already warm from MainTabs)
        const posts = await hydrateArenaPostsFromSupabase({
          silent: true,
          onLocalReady: (localPosts) => {
            applyPosts(localPosts);
          },
        });
        if (cancelled) return;

        applyPosts(posts);

        // Optional playable rows from api path (deduped by ingest) — one batch, no second flash
        const videoRows = await fetchArenaFeed('ALL').catch(() => []);
        if (cancelled) return;
        const playableVideos = (Array.isArray(videoRows) ? videoRows : []).filter(
          (row) =>
            row?._fromVideosTable &&
            (row.videoUri || row.videoUrl || row.video_url || row.uri)
        );
        if (playableVideos.length > 0) {
          applyPosts(playableVideos);
        }

        // Guarantee challenge shells once — same paint family as videos (no late demo jump)
        if (!demosSeededRef.current) {
          demosSeededRef.current = true;
          setFeedItems((prev) => sortFeedItems(ensureDefaultBattles(prev)));
        }
      } catch (err) {
        console.warn(
          '[ArenaFeed] unified hydrate failed:',
          err?.message || err
        );
        if (!cancelled) {
          setFeedItems((prev) => sortFeedItems(ensureDefaultBattles(prev)));
        }
      }
    };

    void runUnifiedHydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Instant ingest when POST TO ARENA navigates here with params
  useEffect(() => {
    const fromParams = route?.params?.newArenaPost;
    if (!fromParams) return;
    absorbPost({
      ...fromParams,
      _freshPublish: true,
    });
    navigation?.setParams?.({ newArenaPost: undefined });
  }, [route?.params?.newArenaPost, absorbPost, navigation]);

  useFocusEffect(
    useCallback(() => {
      // New post first (index 0) — absorbPost dedupes identical URIs (no re-render loop)
      const fromParams = route?.params?.newArenaPost;
      if (fromParams) {
        absorbPost({
          ...fromParams,
          _freshPublish: true,
        });
      }
      // Catch-up only — skip posts already absorbed with the same URI
      getArenaPosts().forEach((p) => absorbPost(p));
      const fromStore = consumeLatestBattleClip();
      if (fromStore) absorbPost({ ...fromStore, _freshPublish: true });
      else {
        const peek = peekLatestBattleClip();
        if (peek) absorbPost(peek);
      }
    }, [absorbPost, route?.params?.newArenaPost])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refreshVideoFeed();
      refreshOpenBattles();
      const [posts, videoRows] = await Promise.all([
        refreshArenaPostsFromSupabase(),
        fetchArenaFeed('ALL').catch(() => []),
      ]);
      const playableVideos = (Array.isArray(videoRows) ? videoRows : []).filter(
        (row) =>
          row?._fromVideosTable &&
          (row.videoUri || row.videoUrl || row.video_url || row.uri)
      );
      const merged = [
        ...(Array.isArray(posts) ? posts : []),
        ...playableVideos,
      ];
      setFeedItems((prev) => {
        // Keep fresh publishes + always-on official battle shells
        let next = prev.filter(
          (p) =>
            p?._demoBattle ||
            p?._freshPublish ||
            (Number(p?.createdAt) || 0) > Date.now() - 120_000
        );
        const ordered = [...merged].sort(
          (a, b) =>
            (Number(a.timestamp || a.createdAt) || 0) -
            (Number(b.timestamp || b.createdAt) || 0)
        );
        for (const post of ordered) {
          const key =
            post.id ||
            `${post.videoUri || post.uri || ''}-${post.timestamp || ''}`;
          if (key) ingestedIds.current.add(key);
          next = ingestArenaPost(next, post);
        }
        return sortFeedItems(ensureDefaultBattles(next));
      });
    } catch (err) {
      console.warn('[ArenaFeed] pull-to-refresh failed:', err?.message || err);
      setFeedItems((prev) => sortFeedItems(ensureDefaultBattles(prev)));
    } finally {
      setRefreshing(false);
    }
  }, [refreshVideoFeed, refreshOpenBattles]);

  // Hook-driven videos: absorb only new playable rows (deduped) — no full-list remount flash
  useEffect(() => {
    if (!Array.isArray(videoFeedItems) || videoFeedItems.length === 0) return;
    for (const post of videoFeedItems) {
      if (
        post?._fromVideosTable &&
        (post.videoUri || post.videoUrl || post.video_url || post.uri)
      ) {
        absorbPost(post);
      }
    }
  }, [videoFeedItems, absorbPost]);

  /** Unified Arena video feed — reels + challenge cards; shelves inject every N rows. */
  const visibleFeed = useMemo(() => {
    const source = ensureDefaultBattles(feedItems);
    const seenIds = new Set();
    const seenVideos = new Set();
    const out = [];
    for (const item of source) {
      if (!item?.id || seenIds.has(item.id)) continue;
      // Skip shell reels with no playable URI (avoids LOADING CLIP black cards)
      // Official battle_thread cards always stay (Respond / ChallengeCam)
      if (item.type === 'reel' && !item.videoUri) continue;
      const vKey = videoIdentityKey(item.videoUri || item.challengeVideoUri);
      if (item.type === 'reel' && vKey && seenVideos.has(vKey)) continue;
      seenIds.add(item.id);
      if (vKey) seenVideos.add(vKey);
      out.push(item);
    }
    const hasBattle = out.some((i) => i.type === 'battle_thread');
    if (!hasBattle) {
      const defaults = seedDefaultOfficialBattles();
      const fallback =
        defaults.find((b) => b.id === DEFAULT_BATTLE_CRICKET_ID) || defaults[0];
      if (fallback && !seenIds.has(fallback.id)) {
        out.unshift(fallback);
      }
    }
    return out;
  }, [feedItems]);

  /**
   * Vertical feed with inline horizontal challenge shelves every N media rows.
   * Cold start: never place a shelf at list index 0 or 1 — leading rows are video.
   */
  const feedWithShelves = useMemo(() => {
    const media = visibleFeed;
    if (!media.length) return media;
    const out = [];
    let shelfIdx = 0;
    for (let i = 0; i < media.length; i += 1) {
      out.push(media[i]);
      const mediaCount = i + 1;
      if (
        mediaCount >= MIN_MEDIA_BEFORE_SHELF &&
        mediaCount % COMMUNITY_SHELF_INTERVAL === 0
      ) {
        out.push({
          id: `community-shelf-${shelfIdx}`,
          type: 'community_shelf',
          shelfIndex: shelfIdx,
        });
        shelfIdx += 1;
      }
    }
    // One trailing shelf only after we already have leading video rows
    if (shelfIdx === 0 && media.length >= MIN_MEDIA_BEFORE_SHELF) {
      out.push({
        id: 'community-shelf-0',
        type: 'community_shelf',
        shelfIndex: 0,
      });
    }
    return out;
  }, [visibleFeed]);

  const openGameOn = useCallback(() => {
    setGameOnOpen(true);
  }, []);

  const openShelfCallout = useCallback(
    (item) => {
      const id = item?.id || item?.challengeId || null;
      if (openBattlesCallout) {
        openBattlesCallout(id);
        return;
      }
      navigation?.navigate?.('Battles', { focusChallengeId: id });
    },
    [openBattlesCallout, navigation]
  );

  const closeGameOn = useCallback(() => {
    setGameOnOpen(false);
  }, []);

  const openReel = useCallback((item, opts) => {
    setImmersiveMuted(!!opts?.muted);
    setWarmReel(item);
    setActiveReel(item);
  }, []);

  const openResponses = useCallback((item) => {
    setHubThread(item);
  }, []);

  const openChallengeRespond = useCallback(
    (item) => {
      if (!item) return;
      const handle = String(
        item.opponent || item.host || item.challengeOf || 'Challenger'
      ).replace(/^@/, '');
      const maxDur = item.challengeMaxDuration || item.durationSec || 30;
      const opener =
        item.challengeVideoUri ||
        item.openerVideoUri ||
        (item.isOpenChallenge ? item.videoUri || item.uri : null) ||
        null;
      // Locked UniversalCamera only — never ChallengeScreen / ChallengeCamRecorder
      navigation?.navigate?.('ChallengeCam', {
        initialMode: 'BATTLE_REWIND',
        isChallengeResponse: true,
        challengeMaxDuration: maxDur,
        battleId: item.battleId || item.challengeId || item.id,
        target: item.target || item.statSticker || 'Battle response',
        handle,
        sport: item.sport || item.category || 'GYM',
        feedTarget: 'ARENA',
        reel: {
          id: item.id,
          battleId: item.battleId || item.challengeId || item.id,
          creator: handle,
          statSticker: item.target || item.statSticker || 'Battle response',
          category: item.sport || item.category || 'GYM',
          challengeMaxDuration: maxDur,
          durationSec: maxDur,
          videoUri: opener,
          challengeVideoUri: opener,
        },
      });
    },
    [navigation]
  );

  const renderFeedItem = useCallback(
    ({ item, index }) => {
      if (item.type === 'community_shelf') {
        return (
          <CommunityChallengesShelf
            callouts={communityCallouts}
            onOpenCallout={openShelfCallout}
          />
        );
      }
      // Warm viewport + ±1 neighbor for instant playback while scrolling
      const active =
        warmIndices.size === 0 ? index < 2 : warmIndices.has(index);
      if (item.type === 'reel') {
        return (
          <GeneralReelCard
            item={item}
            onOpen={openReel}
            onHype={hypeReel}
            active={active}
            // Hide ALL feed overlays while any fullscreen reel is open
            immersiveOpen={!!activeReel}
          />
        );
      }
      if (item.type === 'battle_thread') {
        return (
          <BattleCard
            item={item}
            onOpenResponses={openResponses}
            onRespond={openChallengeRespond}
            active={active && !activeReel}
          />
        );
      }
      return null;
    },
    [
      communityCallouts,
      openShelfCallout,
      openReel,
      openResponses,
      openChallengeRespond,
      hypeReel,
      warmIndices,
      activeReel,
    ]
  );

  const emptyFilter = useMemo(
    () => (
      <View style={styles.emptyFeed}>
        <Text style={styles.emptyFeedTitle}>NO CLIPS YET</Text>
        <Text style={styles.emptyFeedSub}>
          Drop a SPARKS or JOSH clip to light up Arena. Open callouts live on
          the Battles tab.
        </Text>
        <TouchableOpacity
          style={styles.emptyFeedBtn}
          onPress={() => openGameOn()}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyFeedBtnText}>GAME ON</Text>
        </TouchableOpacity>
      </View>
    ),
    [openGameOn]
  );

  const feedKeyExtractor = useCallback((item, index) => {
    // Guarantee uniqueness even if a bad hydrate slips duplicate ids
    return item?.id != null ? String(item.id) : `feed-row-${index}`;
  }, []);

  return (
    <View style={styles.container}>
      <BrandHeader
        screenName="ARENA"
        onBrandPress={openProfileGateway}
        rightSlot={
          <TouchableOpacity
            style={styles.gameOnPill}
            onPress={() => openGameOn()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open GAME ON hub"
          >
            <Text style={styles.gameOnPillText}>GAME ON</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        ref={listRef}
        data={feedWithShelves}
        keyExtractor={feedKeyExtractor}
        renderItem={renderFeedItem}
        ListEmptyComponent={emptyFilter}
        contentContainerStyle={
          feedWithShelves.length === 0
            ? styles.scrollContentEmpty
            : styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
        // Reels scroll budget — tight window kills stutter (IG / TikTok style)
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        updateCellsBatchingPeriod={50}
        onEndReachedThreshold={0.6}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={ARENA_VIEWABILITY_CONFIG}
        extraData={warmIndices}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
            progressBackgroundColor="#121212"
          />
        }
      />

      <GameOnHub visible={gameOnOpen} onClose={closeGameOn} />

      <ArenaReelViewer
        visible={!!activeReel}
        reel={activeReel || warmReel}
        initialMuted={immersiveMuted}
        onClose={() => setActiveReel(null)}
      />
      <ResponseReelDrawer
        visible={!!hubThread}
        thread={hubThread}
        onClose={() => setHubThread(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  scrollContent: {
    paddingBottom: 110,
    paddingTop: 0,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    paddingBottom: 110,
    paddingTop: 0,
  },
  emptyFeed: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: DARK_BG,
  },
  emptyFeedTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  emptyFeedSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyFeedBtn: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WHITE,
  },
  emptyFeedBtnText: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  gameOnPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: WHITE,
  },
  gameOnPillText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  reelCard: {
    height: 520,
    marginHorizontal: 0,
    marginBottom: 12,
    backgroundColor: DARK_BG,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  clipShell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  clipVideoFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  reelFullBleed: {
    ...StyleSheet.absoluteFillObject,
  },
  reelMuteBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 14,
  },
  battleMuteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 14,
  },
  reelMiddleTap: {
    position: 'absolute',
    top: '22%',
    bottom: '28%',
    left: '12%',
    right: '18%',
    zIndex: 6,
  },
  reelScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0,0.15)',
  },
  fireBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  fireBurstText: {
    fontSize: 88,
  },
  reelBottomLeft: {
    position: 'absolute',
    left: 16,
    right: 72,
    bottom: 20,
    zIndex: 8,
  },
  reelHandle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  reelCaptionOverlay: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  reelEngageWrap: {
    position: 'absolute',
    right: 12,
    bottom: 18,
    alignItems: 'flex-end',
    zIndex: 14,
  },
  engageToggle: {
    // Icon-only — flat, no circle / shadow
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  engageToggleText: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
    marginTop: -1,
  },
  engageToggleTextOpen: {
    color: FLAME_ORANGE,
  },
  engageDrawer: {
    backgroundColor: 'rgba(0, 0, 0,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  reelActionBtn: {
    alignItems: 'center',
  },
  reelActionEmoji: {
    fontSize: 24,
  },
  reelActionCount: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  battleBadge: {
    backgroundColor: 'rgba(255,87,34,0.15)',
    borderWidth: 1,
    borderColor: FLAME_ORANGE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  battleBadgeText: {
    color: FLAME_ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  vsRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  feedCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  vsTitle: {
    color: GOLD,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.4,
    flex: 1,
    paddingRight: 8,
  },
  feedTime: {
    color: MUTED,
    fontSize: 10,
  },
  splitRow: {
    position: 'relative',
    flexDirection: 'row',
    height: 200,
    backgroundColor: DARK_BG,
  },
  splitPane: {
    flex: 1,
  },
  splitClip: {
    flex: 1,
  },
  openSlot: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  openSlotLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  openSlotCta: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  splitDivider: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_BG,
  },
  splitVs: {
    color: CRIMSON,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  targetDetailsText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
    marginTop: 10,
    lineHeight: 17,
  },
  clipVideoWrap: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  clipPlaceholder: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  clipPlaceholderText: {
    color: PLATINUM,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  clipPlaceholderLabel: {
    color: PLATINUM,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  clipCornerTag: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(0, 0, 0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  clipCornerTagText: {
    color: PLATINUM,
    fontSize: 10,
    fontWeight: '800',
  },
  streamLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  streamLiveLabel: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  responseBadge: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    alignItems: 'center',
  },
  responseBadgeText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  respondCta: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  respondCtaText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  feedFooter: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  postedBadge: {
    backgroundColor: DARK_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  postedText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
