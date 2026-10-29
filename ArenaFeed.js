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
  ScrollView,
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
import {
  ARENA_SPORT_TABS,
  canonicalizeSport,
  matchesSportFilter,
  resolvePostSport,
} from './src/utils/sportCategory';
import ScoresSportsPanel from './src/components/ScoresSportsPanel';

const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
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

const PERMANENT_SPORTS_TABS = ARENA_SPORT_TABS;

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

/** Lean first paint — official battles + light reel shells (battles always visible). */
function seedArenaFeedLean() {
  return ensureDefaultBattles([
    {
      id: 'reel-gym-1',
      type: 'reel',
      sport: 'GYM',
      author: '@Mia_Torque',
      verified: true,
      caption: 'Floor PR session · chalk & chaos',
      hypeCount: 1204,
      videoUri: null,
      createdAt: Date.now() - 12_000_000,
    },
  ]);
}

function seedArenaFeedDemoBattles() {
  /** General Arena reels — no challenge tags, no battle CTAs */
  const reels = [
    {
      id: 'reel-throttle-1',
      type: 'reel',
      sport: 'THROTTLE',
      author: '@RaceQueen_IN',
      verified: true,
      caption: 'Night pull on the expressway · 0–100',
      hypeCount: 842,
      videoUri: null,
      createdAt: Date.now() - 5_000_000,
    },
    {
      id: 'reel-football-1',
      type: 'reel',
      sport: 'FOOTBALL',
      author: '@Karan_FreeKick',
      verified: false,
      caption: 'Free-kick practice · top bins',
      hypeCount: 312,
      videoUri: null,
      createdAt: Date.now() - 40_000_000,
    },
    {
      id: 'reel-gym-1',
      type: 'reel',
      sport: 'GYM',
      author: '@Mia_Torque',
      verified: true,
      caption: 'Floor PR session · chalk & chaos',
      hypeCount: 1204,
      videoUri: null,
      createdAt: Date.now() - 12_000_000,
    },
    {
      id: 'reel-cricket-1',
      type: 'reel',
      sport: 'CRICKET',
      author: '@StreetBat_MUM',
      verified: false,
      caption: 'Gully yorker · street cricket heat',
      hypeCount: 560,
      videoUri: null,
      createdAt: Date.now() - 8_000_000,
    },
    {
      id: 'reel-combat-1',
      type: 'reel',
      sport: 'COMBAT',
      author: '@VirarStriker',
      verified: true,
      caption: 'Pad work · late night gym lights',
      hypeCount: 991,
      videoUri: null,
      createdAt: Date.now() - 3_000_000,
    },
  ];

  return ensureDefaultBattles(reels).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
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
  } else {
    items = seedArenaFeedLean();
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
  // Always keep Cover drive / gym / combat Respond shells on first paint
  return sortFeedItems(ensureDefaultBattles(items));
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
    (post.challengeOf ? `@${String(post.challengeOf).replace(/^@/, '')}` : '@Challenger');
  const challengeId =
    post.challengeId ||
    post.battleId ||
    post.reel?.id ||
    `thread-${sport}-${String(opponent).replace(/\W/g, '')}`;
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
  const responses = sortResponses(item.responses, 'top');
  const leader = responses[0];
  const responseCount = responses.length;
  // ChallengeCam Continue → post.videoUri / leader response URI
  const responseUri =
    leader?.videoUri ||
    leader?.uri ||
    leader?.localVideoUri ||
    item.videoUri ||
    item.uri ||
    item.localVideoUri ||
    null;
  const challengeUri =
    item.challengeVideoUri &&
    item.challengeVideoUri !== responseUri
      ? item.challengeVideoUri
      : null;

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <View style={styles.battleBadge}>
          <Text style={styles.battleBadgeText}>OFFICIAL BATTLE</Text>
        </View>
        <Text style={styles.feedTime}>{item.status || 'BATTLE'}</Text>
      </View>

      <View style={styles.vsRow}>
        <Text style={styles.vsTitle}>
          {item.challengerLabel || 'YOU'} vs {item.leaderLabel || item.opponent}
        </Text>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.splitPane}>
          <ClipSurface
            uri={challengeUri || responseUri}
            source={{
              uri: challengeUri || responseUri,
              videoUri: challengeUri || responseUri,
              localVideoUri: challengeUri ? null : item.localVideoUri,
            }}
            label={
              challengeUri
                ? item.opponent || 'CHALLENGE'
                : leader?.creator === 'You'
                  ? 'YOU'
                  : item.opponent || 'CLIP'
            }
            style={styles.splitClip}
            muted={muted}
            active={active}
          />
        </View>
        <View style={styles.splitDivider}>
          <Text style={styles.splitVs}>VS</Text>
        </View>
        <View style={styles.splitPane}>
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
        </View>
        <MuteToggleButton
          muted={muted}
          onPress={toggleMute}
          style={styles.battleMuteBtn}
        />
      </View>

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
  const { openProfileGateway } = useMainTabs();
  const [activeTab, setActiveTab] = useState('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const absorbPost = useCallback((post) => {
    if (!post) return;
    const key = post.id || `${post.videoUri || post.uri || ''}-${post.timestamp || ''}`;
    // Always re-ingest if this is a fresh publish (newer timestamp) so it stays at index 0
    const ts = Number(post.timestamp || post.createdAt) || 0;
    const forceTop =
      post._freshPublish === true ||
      ts > Date.now() - 120_000 ||
      post.author === '@you' ||
      post.creator === 'You' ||
      post.creator === 'YOU';
    if (key && ingestedIds.current.has(key) && !forceTop) return;
    if (key) ingestedIds.current.add(key);
    setFeedItems((prev) =>
      sortFeedItems(
        ingestArenaPost(prev, {
          ...post,
          _freshPublish: forceTop || post._freshPublish,
          createdAt: forceTop ? Date.now() : post.createdAt || ts,
          timestamp: forceTop ? Date.now() : post.timestamp || ts,
        })
      )
    );
    if (forceTop) {
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

  // Defer heavy cloud hydrate + demo battles until after first paint
  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const runDeferred = async () => {
      if (cancelled) return;
      try {
        // Cloud hydrate first (real posts) — demos load later so they don't block UI
        const posts = await hydrateArenaPostsFromSupabase({ silent: true });
        if (!cancelled && Array.isArray(posts) && posts.length > 0) {
          setFeedItems((prev) => {
            let next = prev;
            // Ingest oldest→newest so each prepend leaves the newest post on top
            const ordered = [...posts].sort(
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
            // Keep official mock battles after cloud merge
            return sortFeedItems(ensureDefaultBattles(next));
          });
        }

        if (cancelled) return;
        // Demo shells once only — never re-seed on refresh (avoids MMA flash)
        if (!demosSeededRef.current) {
          demosSeededRef.current = true;
          setFeedItems((prev) => {
            let next = ensureDefaultBattles(prev);
            const seen = new Set(next.map((p) => p.id));
            for (const item of seedArenaFeedDemoBattles()) {
              if (seen.has(item.id)) continue;
              seen.add(item.id);
              next = [...next, item];
            }
            return sortFeedItems(ensureDefaultBattles(next));
          });
        } else if (!Array.isArray(posts) || posts.length === 0) {
          // No cloud rows — still guarantee battle shells without wiping feed
          setFeedItems((prev) => sortFeedItems(ensureDefaultBattles(prev)));
        }
      } catch (err) {
        console.warn(
          '[ArenaFeed] deferred hydrate failed:',
          err?.message || err
        );
      }
    };

    // Paint Arena chrome one frame, then hydrate immediately (no long black wait)
    timeoutId = setTimeout(() => {
      if (typeof globalThis.requestIdleCallback === 'function') {
        idleId = globalThis.requestIdleCallback(
          () => {
            void runDeferred();
          },
          { timeout: 80 }
        );
      } else {
        void runDeferred();
      }
    }, 0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (
        idleId != null &&
        typeof globalThis.cancelIdleCallback === 'function'
      ) {
        globalThis.cancelIdleCallback(idleId);
      }
    };
  }, []);

  // Instant ingest when POST TO ARENA navigates here with params
  useEffect(() => {
    const fromParams = route?.params?.newArenaPost;
    if (!fromParams) return;
    // Stamp as newest so hydrate / demos cannot bury it
    absorbPost({
      ...fromParams,
      _freshPublish: true,
      createdAt: Date.now(),
      timestamp: Date.now(),
    });
    navigation?.setParams?.({ newArenaPost: undefined });
  }, [route?.params?.newArenaPost, absorbPost, navigation]);

  useFocusEffect(
    useCallback(() => {
      // New post first (index 0), then store catch-up
      const fromParams = route?.params?.newArenaPost;
      if (fromParams) {
        absorbPost({
          ...fromParams,
          _freshPublish: true,
          createdAt: Date.now(),
          timestamp: Date.now(),
        });
      }
      getArenaPosts().forEach(absorbPost);
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
      const posts = await refreshArenaPostsFromSupabase();
      setFeedItems((prev) => {
        // Keep fresh publishes + always-on official battle shells
        let next = prev.filter(
          (p) =>
            p?._demoBattle ||
            p?._freshPublish ||
            (Number(p?.createdAt) || 0) > Date.now() - 120_000
        );
        const ordered = [...(posts || [])].sort(
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
  }, []);

  const visibleFeed = useMemo(() => {
    const tab = canonicalizeSport(activeTab) || 'ALL';
    // Case-insensitive sport/category match (football ≡ FOOTBALL, mma ≡ COMBAT)
    // Never drop default battles from the source list when filtering
    const source = ensureDefaultBattles(feedItems);
    const filtered =
      tab === 'ALL'
        ? source
        : source.filter((item) => matchesSportFilter(item, tab));
    // Final safety: unique ids + unique video files in the FlatList
    const seenIds = new Set();
    const seenVideos = new Set();
    const out = [];
    for (const item of filtered) {
      if (!item?.id || seenIds.has(item.id)) continue;
      // Skip shell reels with no playable URI (avoids LOADING CLIP black cards)
      // Official battle_thread cards always stay (Respond / ChallengeCam)
      if (item.type === 'reel' && !item.videoUri) continue;
      const vKey = videoIdentityKey(item.videoUri);
      if (item.type === 'reel' && vKey && seenVideos.has(vKey)) continue;
      seenIds.add(item.id);
      if (vKey) seenVideos.add(vKey);
      out.push(item);
    }
    // If a sport tab has no battle card, surface the matching default (or cricket)
    const hasBattle = out.some((i) => i.type === 'battle_thread');
    if (!hasBattle) {
      const defaults = seedDefaultOfficialBattles();
      const fallback =
        defaults.find((b) => matchesSportFilter(b, tab)) ||
        defaults.find((b) => b.id === DEFAULT_BATTLE_CRICKET_ID) ||
        defaults[0];
      if (fallback && !seenIds.has(fallback.id)) {
        out.unshift(fallback);
      }
    }
    return out;
  }, [activeTab, feedItems]);

  // Reset warm window when filter changes so the first filtered clip plays ASAP
  useEffect(() => {
    setWarmIndices(new Set([0, 1]));
  }, [activeTab]);

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
      const handle = String(item.opponent || item.challengeOf || 'Challenger').replace(
        /^@/,
        ''
      );
      const maxDur = item.challengeMaxDuration || item.durationSec || 30;
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
          videoUri: item.challengeVideoUri || item.videoUri || null,
        },
      });
    },
    [navigation]
  );

  const renderFeedItem = useCallback(
    ({ item, index }) => {
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
      openReel,
      openResponses,
      openChallengeRespond,
      hypeReel,
      warmIndices,
      activeReel,
    ]
  );

  const emptyFilter = useMemo(() => {
    const tab = canonicalizeSport(activeTab) || 'ALL';
    if (tab === 'ALL') {
      return (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyFeedTitle}>NO CLIPS YET</Text>
          <Text style={styles.emptyFeedSub}>
            Drop a SPARKS or JOSH clip to light up Arena.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyFeed}>
        <Text style={styles.emptyFeedTitle}>NO {tab} CLIPS</Text>
        <Text style={styles.emptyFeedSub}>
          Switch to ALL or post a clip tagged {tab}.
        </Text>
        <TouchableOpacity
          style={styles.emptyFeedBtn}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyFeedBtnText}>SHOW ALL</Text>
        </TouchableOpacity>
      </View>
    );
  }, [activeTab]);

  const feedKeyExtractor = useCallback((item, index) => {
    // Guarantee uniqueness even if a bad hydrate slips duplicate ids
    return item?.id != null ? String(item.id) : `feed-row-${index}`;
  }, []);

  const listHeader = useMemo(() => {
    if (!filtersOpen) return null;
    return (
      <View style={styles.filtersPanel}>
        <ScoresSportsPanel />

        <View style={styles.subheaderRow}>
          <Text style={styles.subheaderTitle}>LIVE FEED</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>TOKYO GLOBAL LIVE</Text>
          </View>
        </View>

        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {PERMANENT_SPORTS_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    isActive ? styles.activeTabButton : styles.inactiveTabButton,
                  ]}
                  onPress={() => setActiveTab(canonicalizeSport(tab) || tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive ? styles.activeTabText : styles.inactiveTabText,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }, [filtersOpen, activeTab]);

  return (
    <View style={styles.container}>
      <BrandHeader
        screenName="ARENA"
        onBrandPress={openProfileGateway}
        rightSlot={
          <TouchableOpacity
            style={styles.scoresPill}
            onPress={() => setFiltersOpen((v) => !v)}
            activeOpacity={0.85}
            accessibilityLabel="Scores and sports"
          >
            <Text style={styles.scoresPillText}>
              ⚡ SCORES & SPORTS {filtersOpen ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        ref={listRef}
        data={visibleFeed}
        keyExtractor={feedKeyExtractor}
        renderItem={renderFeedItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyFilter}
        contentContainerStyle={
          visibleFeed.length === 0
            ? styles.scrollContentEmpty
            : styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        // 60fps scroll budget — warm neighbors only via ClipSurface `active`
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={40}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={ARENA_VIEWABILITY_CONFIG}
        // Remount list window when filter changes so indices/warm state stay correct
        extraData={`${activeTab}:${warmIndices.size}:${visibleFeed.length}`}
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
  scoresPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scoresPillText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  filtersPanel: {
    marginTop: 8,
    marginBottom: 4,
  },
  subheaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  subheaderTitle: {
    fontSize: 14,
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
    borderColor: CRIMSON,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CRIMSON,
    marginRight: 6,
    alignSelf: 'center',
  },
  liveBadgeText: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: 'bold',
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
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsContainer: {
    paddingLeft: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  activeTabButton: {
    backgroundColor: PLATINUM,
    borderColor: PLATINUM,
  },
  inactiveTabButton: {
    backgroundColor: SURFACE,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: DARK_BG,
  },
  inactiveTabText: {
    color: MUTED,
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
