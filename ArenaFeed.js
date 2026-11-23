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
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import {
  SKULL_ASSETS,
  REEL_VAULT_SKULL,
  getSkullAsset,
} from './src/utils/skullAssets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { consumeLatestBattleClip, peekLatestBattleClip } from './battleClipStore';
import {
  subscribeArenaPosts,
  drainPendingArenaPosts,
  getArenaPosts,
  hydrateArenaPostsFromSupabase,
  refreshArenaPostsFromSupabase,
  refreshArenaChallengesIntoFeed,
} from './arenaFeedStore';
import {
  ARENA_CHALLENGES_FEED_SELECT,
  fetchArenaChallenges,
  mapArenaChallengeRowToCard,
} from './src/services/arenaChallengeService';
import ResponseReelDrawer from './ResponseReelDrawer';
import ArenaReelViewer from './ArenaReelViewer';
import BanterBottomSheet from './BanterBottomSheet';
import { useMainTabs } from './mainTabContext';
import { resolveFeedVideoUri } from './src/components/SafeFeedVideo';
import VideoItem from './src/components/VideoItem';
import MuteToggleButton from './src/components/MuteToggleButton';
import ReelActionSheet, {
  REEL_SECONDARY_ACTION_IDS,
} from './src/components/ReelActionSheet';
import UserHandle from './src/components/UserHandle';
import { isHandleVerified } from './src/data/athleteSocial';
import { resolvePostSport } from './src/utils/sportCategory';
import CommunityChallengesShelf from './src/components/CommunityChallengesShelf';
import ArenaV2Header from './src/components/ArenaV2Header';
import NotificationsDrawer from './src/components/NotificationsDrawer';
import LiveArenaModal from './src/components/LiveArenaModal';
import {
  listLiveMatches,
  subscribeLiveMatchList,
  isPublicLiveMatch,
} from './src/services/liveMatchService';
import SafeRemoteImage from './src/components/SafeRemoteImage';
import { useArenaFeed } from './src/hooks/useArenaFeed';
import { useBattles } from './src/hooks/useBattles';
import { fetchArenaFeed } from './src/services/api';
import { seedBattlesOpenCallouts } from './src/utils/faceoffCallout';
import { configureGlobalAudioSession } from './src/utils/configureGlobalAudio';
import { isUsablePlaybackUri } from './src/utils/reelMediaFallback';
import {
  ARENA_FEED_TIER_ALL,
  applyArenaFeedFilters,
  resolveArenaFeedTier,
} from './src/constants/arenaFeedTiers';
import {
  ARENA_DASHBOARD_CATEGORY_PILLS,
  resolveDashboardCategory,
} from './src/constants/gameOnSports';
import { BAWAAL_HSCROLL_HIDDEN_CLASS } from './src/styles/injectWebScrollbar';
import {
  BAWAAL_ORANGE,
  REEL_MORE,
  REEL_MUTE,
  REEL_VAULT,
  REEL_VAULT_ICON_KEY,
} from './src/constants/arenaReelOverlay';
import {
  getArenaFilters,
  hydrateArenaFilters,
  setArenaFeedTier,
  setArenaSportFilter,
  subscribeArenaFilters,
} from './src/stores/arenaFilterStore';
import { dispatchReelSocialAction } from './src/services/reelSocialService';
import { FullEmojiPickerDrawer } from './components/FullEmojiPickerDrawer';
import {
  FloatingEmojiBurstLayer,
  appendBurstParticles,
  createCenteredEmojiBurst,
} from './src/components/FloatingEmojiBurst';
import {
  resolveVaultBurstRoomId,
  subscribeVaultBurstChannel,
  broadcastVaultBurst,
  resolveBurstActorId,
} from './src/services/vaultBurstRealtime';
import DmSharePicker from './src/components/DmSharePicker';
import {
  castCustomMatchupVote,
  fetchChallengeMatchupRoster,
  tallyMatchupVotes,
} from './src/services/customMatchupService';
import { fetchArenaDashboardSections } from './src/services/arenaDashboardService';
import { subscribeArenaDashboardRealtime } from './src/services/arenaDashboardRealtime';

const ARENA_HSCROLL_KILL_STYLE_ID = 'bawaal-arena-hscroll-kill';

/**
 * Force-inject web CSS so no horizontal scrollbar track / thumb / arrow buttons
 * ever render under Arena shelves or pill rows.
 */
function injectArenaHorizontalScrollbarKillCss() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById(ARENA_HSCROLL_KILL_STYLE_ID)) return;
  try {
    const style = document.createElement('style');
    style.id = ARENA_HSCROLL_KILL_STYLE_ID;
    style.type = 'text/css';
    style.appendChild(
      document.createTextNode(`
        /* ArenaFeed — kill every horizontal scrollbar track */
        * {
          scrollbar-width: none !important;
        }
        *::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
          background: transparent !important;
        }
        *::-webkit-scrollbar:horizontal,
        *::-webkit-scrollbar-button,
        *::-webkit-scrollbar-track,
        *::-webkit-scrollbar-thumb {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
          background: transparent !important;
          border: none !important;
        }
        .${BAWAAL_HSCROLL_HIDDEN_CLASS},
        .${BAWAAL_HSCROLL_HIDDEN_CLASS} *,
        .${BAWAAL_HSCROLL_HIDDEN_CLASS} div {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      `)
    );
    document.head.appendChild(style);
  } catch (_) {
    /* soft-fail — UI still usable without the CSS hook */
  }
}

// Top-level inject as soon as ArenaFeed module loads on web
injectArenaHorizontalScrollbarKillCss();

/**
 * Horizontal shelves / pills — no scrollbar track and no reserved bottom gutter.
 * Native: showsHorizontalScrollIndicator + overScrollMode.
 * Web: className + overflowX auto / scrollbarWidth none / -webkit-overflow-scrolling.
 */
const HSCROLL_HIDDEN_STYLE =
  Platform.OS === 'web'
    ? {
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE / Edge
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 0,
        marginBottom: 0,
        flexGrow: 0,
      }
    : {
        paddingBottom: 0,
        marginBottom: 0,
        flexGrow: 0,
      };

const HSCROLL_HIDDEN_PROPS = {
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
  persistentScrollbar: false,
  overScrollMode: 'never',
  ...(Platform.OS === 'web'
    ? { className: BAWAAL_HSCROLL_HIDDEN_CLASS }
    : null),
};

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
const FLAME_ORANGE = '#FF6600';
const CRIMSON = LIVE_CRIMSON;
const GOLD = FLAME_ORANGE;

/** Stable FlatList viewability config — must not be recreated each render. */
const ARENA_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 80,
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

const FEED_URI_FIELDS = [
  'video_url',
  'videoUrl',
  'publicCloudUrl',
  'remoteVideoUri',
  'videoUri',
  'uri',
  'recordedVideoUri',
  'localVideoUri',
];

/** First playable URL on a post, cloud row, or raw string. */
function pickFeedClipUri(...sources) {
  for (const source of sources) {
    if (source == null) continue;
    if (typeof source === 'string') {
      const normalized = resolveFeedVideoUri(source) || source;
      if (isUsablePlaybackUri(normalized)) return String(normalized).trim();
      continue;
    }
    if (typeof source !== 'object') continue;
    const resolved = resolveFeedVideoUri(source);
    if (isUsablePlaybackUri(resolved)) return String(resolved).trim();
    for (const key of FEED_URI_FIELDS) {
      const raw = source[key];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const normalized = resolveFeedVideoUri(raw) || raw.trim();
      if (isUsablePlaybackUri(normalized)) return String(normalized).trim();
    }
  }
  return null;
}

/** Stable key for the same cloud clip (dedupe storage fallback vs DB rows). */
function videoIdentityKey(uri) {
  if (!uri || typeof uri !== 'string') return '';
  const clean = uri.split('?')[0].trim().toLowerCase();
  const battles = clean.match(/\/battles\/([^/]+)$/);
  if (battles) return `battles/${battles[1]}`;
  return clean;
}

/** Parse created_at / createdAt / timestamp into ms for newest-first sorts. */
function createdAtMs(row) {
  if (!row || typeof row !== 'object') return 0;
  if (typeof row.created_at === 'string' && row.created_at.trim()) {
    const parsed = Date.parse(row.created_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  const n = Number(row.createdAt ?? row.timestamp ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Supabase / Arena rows — always newest `created_at` first. */
function sortByCreatedAtDesc(list) {
  return [...(list || [])].sort((a, b) => createdAtMs(b) - createdAtMs(a));
}

/** Fresh publishes always sort above older cloud / demo clips (no MMA flash). */
function feedSortScore(item) {
  const ts = createdAtMs(item) || Number(item?.createdAt) || 0;
  const fresh =
    item?._freshPublish === true || ts > Date.now() - 120_000 ? 1e15 : 0;
  return fresh + ts;
}

function sortFeedItems(list) {
  return [...(list || [])].sort(
    (a, b) => feedSortScore(b) - feedSortScore(a)
  );
}

function battleRowVideoUrl(row) {
  return (
    row?.video_url ||
    row?.videoUrl ||
    row?.videoUri ||
    row?.opener_video_url ||
    row?.openerVideoUrl ||
    row?.openerVideoUri ||
    row?.challengeVideoUri ||
    row?.publicCloudUrl ||
    row?.uri ||
    row?.localVideoUri ||
    null
  );
}

/** Human @tag for Arena list rows — never flash a raw UUID. */
function resolveChallengeUserTag(row) {
  const raw =
    row?.username ||
    row?.handle ||
    row?.author ||
    row?.host ||
    row?.creator ||
    row?.user_id ||
    'athlete';
  const s = String(raw || 'athlete').trim();
  if (!s || s === 'null' || s === 'undefined') return '@athlete';
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    return '@athlete';
  }
  return s.startsWith('@') ? s : `@${s.replace(/^@/, '')}`;
}

/** Normalize any arena_challenges / feed row into a FlatList video card. */
function mapChallengeRowToFeedItem(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const videoUrl = battleRowVideoUrl(row);
  const title = String(
    row.title || row.caption || row.target || row.description || 'OPEN CHALLENGE'
  ).trim();
  const userTag = resolveChallengeUserTag(row);
  const id = String(
    row.id ||
      row.challengeId ||
      (videoUrl ? `uri-${videoIdentityKey(videoUrl)}` : `challenge-${index}-${createdAtMs(row)}`)
  );
  const tier =
    resolveArenaFeedTier(row) ||
    String(row.tier || 'dark_arena').toLowerCase() ||
    'dark_arena';
  return {
    ...row,
    id,
    type: 'challenge_video',
    tier,
    video_url: videoUrl,
    videoUrl,
    videoUri: videoUrl,
    uri: videoUrl,
    title,
    caption: title,
    username: userTag,
    author: userTag,
    handle: userTag,
    thumbnail_url:
      row.thumbnail_url || row.thumbnail || row.thumbnailUrl || null,
    created_at: row.created_at || null,
    createdAt: createdAtMs(row) || Date.now(),
    _fromArenaChallenges: row._fromArenaChallenges !== false,
  };
}

function mapPostToReel(post) {
  const uri = pickFeedClipUri(post);
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
    video_url: post.video_url || post.videoUrl || null,
    videoUrl: post.videoUrl || post.video_url || null,
    remoteVideoUri: post.remoteVideoUri || null,
    recordedVideoUri: post.recordedVideoUri || null,
    localVideoUri,
    publicCloudUrl: post.publicCloudUrl || null,
    thumbnail_url: post.thumbnail_url || post.thumbnailUrl || null,
    poster_url: post.poster_url || post.posterUrl || null,
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

const FEED_VIDEO_SHELL = {
  position: 'relative',
  width: '100%',
  height: '100%',
  flex: 1,
  minHeight: 450,
  backgroundColor: '#000000',
  overflow: 'hidden',
};

/**
 * Sleek BAWAAL dark banner — used while URI is missing / uploading / off-screen.
 * Never a blank black box or "Clip Unavailable" crash state.
 */
function FeedVideoPlaceholder({ style, label, subtitle }) {
  return (
    <View
      style={[FEED_VIDEO_SHELL, styles.clipShell, style, styles.clipPlaceholder]}
    >
      <View style={styles.processingBadge}>
        <View style={styles.processingDot} />
        <Text style={styles.clipPlaceholderText}>
          {label || 'BAWAAL ARENA HD'}
        </Text>
      </View>
      <Text style={styles.clipPlaceholderSub}>
        {subtitle || 'Processing…'}
      </Text>
    </View>
  );
}

/**
 * Memoized Arena feed video item.
 * The active row and its neighbor stay mounted. Only the centered row plays.
 */
const FeedVideoItem = memo(function FeedVideoItem({
  uri,
  item = null,
  shouldPlay = false,
  isActive = false,
  muted = true,
  style,
  label = null,
  onLongPress = null,
}) {
  const playUri = pickFeedClipUri(uri);

  if (!playUri) {
    return (
      <FeedVideoPlaceholder
        style={style}
        label={label || 'BAWAAL ARENA HD'}
        subtitle="Processing…"
      />
    );
  }

  return (
    <TouchableWithoutFeedback
      onLongPress={onLongPress}
      delayLongPress={450}
      disabled={!onLongPress}
    >
      <View style={[FEED_VIDEO_SHELL, styles.clipShell, style]}>
        <VideoItem
          item={{
            ...item,
            id: item?.id,
            video_url: playUri,
            videoUrl: playUri,
          }}
          shouldPlay={!!shouldPlay}
          isActive={!!isActive}
          muted={!!muted}
        />
      </View>
    </TouchableWithoutFeedback>
  );
});

/** Resolve the playable URL. Neighbors stay mounted; only the centered row plays. */
const ClipSurface = memo(function ClipSurface({
  uri,
  source,
  label,
  style,
  shouldPlay = false,
  isMounted = false,
  muted = true,
  onLongPress = null,
}) {
  const playSource = source || {
    videoUri: uri,
    video_url: uri,
    uri,
    localVideoUri: uri,
  };
  // Bind the post's playable URL (cloud video_url, then local capture URIs)
  const playUri = pickFeedClipUri(playSource, uri);

  return (
    <FeedVideoItem
      uri={playUri}
      item={playSource}
      shouldPlay={shouldPlay}
      isActive={isMounted}
      muted={muted}
      style={style}
      label={label}
      onLongPress={onLongPress}
    />
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
  const uri = pickFeedClipUri(post);
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

/** Tier filter pill strip under BrandHeader. */
const ARENA_TIER_FILTER_BAR_H = 44;

function arenaOverlayClearance(insets) {
  const headerHeight =
    Math.max(insets?.top || 0, 12) +
    34 +
    2 +
    22 +
    10 +
    1 +
    ARENA_TIER_FILTER_BAR_H;
  const tabBarHeight =
    10 +
    52 +
    1.5 +
    Math.max(insets?.bottom || 0, Platform.OS === 'android' ? 24 : 12) +
    (Platform.OS === 'android' ? 12 : 8);
  return { headerHeight, tabBarHeight };
}

const GeneralReelCard = memo(function GeneralReelCard({
  item,
  onOpen,
  shouldPlay = false,
  isMounted = false,
  /** When true, this card is open in ArenaReelViewer — hide duplicate mute. */
  immersiveOpen = false,
}) {
  const { tabBarHeight } = arenaOverlayClearance(useSafeAreaInsets());
  const [muted, setMuted] = useState(true);
  const [banterOpen, setBanterOpen] = useState(false);
  /** BAWAAL Skeleton Vault bottom tray (skull rail button). */
  const [vaultOpen, setVaultOpen] = useState(false);
  /** ⋮ More dropdown — Like / Banter / Share / DM / Comment only. */
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [dmShareOpen, setDmShareOpen] = useState(false);
  const [burstParticles, setBurstParticles] = useState([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const cardRef = useRef(null);
  const vaultBtnRef = useRef(null);

  /** Right rail geometry — skull sits directly above ⋮. */
  const moreBottom = tabBarHeight + 18;
  const vaultBottom = moreBottom + REEL_VAULT.aboveMore;
  const vaultSkullSource =
    SKULL_ASSETS.skullOrange ||
    SKULL_ASSETS.skull_orange123 ||
    REEL_VAULT_SKULL ||
    getSkullAsset(REEL_VAULT_ICON_KEY) ||
    SKULL_ASSETS.skull_fire_full;
  const roomId = resolveVaultBurstRoomId(item);

  const handle = item.author?.startsWith('@')
    ? item.author
    : `@${String(item.author || 'athlete').replace(/^@/, '')}`;

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  /** Custom skull → toggle BAWAAL Skeleton Vault tray only. */
  const toggleVaultTray = useCallback(() => {
    setMoreMenuOpen(false);
    setBanterOpen(false);
    setDmShareOpen(false);
    setVaultOpen((open) => !open);
  }, []);

  /** ⋮ → toggle secondary actions dropdown. */
  const toggleMoreMenu = useCallback(() => {
    setVaultOpen(false);
    setBanterOpen(false);
    setMoreMenuOpen((open) => !open);
  }, []);

  /** Open reel modal via JS navigation only — never native VideoView fullscreen. */
  const openImmersive = useCallback(() => {
    try {
      onOpen?.(item, { muted });
    } catch (err) {
      console.warn('[ArenaFeed] openImmersive failed:', err?.message || err);
    }
  }, [item, onOpen, muted]);

  const removeBurstParticle = useCallback((id) => {
    setBurstParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onVideoContainerLayout = useCallback((event) => {
    const { width, height } = event?.nativeEvent?.layout || {};
    if (width > 0 && height > 0) {
      setContainerSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    }
  }, []);

  const triggerLocalEmojiBurst = useCallback(
    (emojiId) => {
      if (!emojiId) return;
      const next = createCenteredEmojiBurst(emojiId, containerSize);
      setBurstParticles((prev) => appendBurstParticles(prev, next));
    },
    [containerSize]
  );

  useEffect(() => {
    if (!shouldPlay || !roomId || immersiveOpen) {
      return undefined;
    }
    return subscribeVaultBurstChannel(roomId, {
      onVaultBurst: (emojiId) => {
        triggerLocalEmojiBurst(emojiId);
      },
    });
  }, [shouldPlay, roomId, immersiveOpen, triggerLocalEmojiBurst]);

  const handleSelectSkull = useCallback(
    (emojiId) => {
      setVaultOpen(false);
      if (!emojiId) return;
      triggerLocalEmojiBurst(emojiId);
      void (async () => {
        const userId = await resolveBurstActorId();
        await broadcastVaultBurst(roomId, { emojiId, userId });
      })();
    },
    [triggerLocalEmojiBurst, roomId]
  );

  const onMoreMenuAction = useCallback(
    (actionId, reelSnapshot) => {
      setMoreMenuOpen(false);
      setVaultOpen(false);
      if (actionId === 'banter' || actionId === 'comment') {
        setBanterOpen(true);
        return;
      }
      if (actionId === 'dm' || actionId === 'send') {
        setDmShareOpen(true);
        return;
      }
      void dispatchReelSocialAction(actionId, reelSnapshot || item).catch(
        (err) => {
          console.warn('[ArenaFeed] reel social:', err?.message || err);
        }
      );
    },
    [item]
  );

  return (
    <View
      ref={cardRef}
      style={styles.reelCard}
      collapsable={false}
      onLayout={onVideoContainerLayout}
    >
      <ClipSurface
        key={`clip-${item.id}`}
        uri={pickFeedClipUri(item)}
        source={{
          videoUri: item.videoUri,
          video_url: item.video_url || item.videoUrl,
          videoUrl: item.videoUrl || item.video_url,
          uri: item.uri,
          localVideoUri: item.localVideoUri,
          recordedVideoUri: item.recordedVideoUri,
          publicCloudUrl: item.publicCloudUrl,
          remoteVideoUri: item.remoteVideoUri,
          thumbnail_url: item.thumbnail_url || item.thumbnailUrl,
          thumbnailUrl: item.thumbnailUrl || item.thumbnail_url,
          poster_url: item.poster_url || item.posterUrl,
          posterUrl: item.posterUrl || item.poster_url,
        }}
        label={null}
        style={styles.reelFullBleed}
        muted={muted}
        shouldPlay={shouldPlay && !immersiveOpen}
        isMounted={isMounted && !immersiveOpen}
        onLongPress={immersiveOpen ? null : openImmersive}
      />

      <View style={styles.reelScrim} pointerEvents="none" />

      {/* Profile overlay — never part of the right action rail */}
      <View
        style={[styles.reelBottomLeft, { bottom: tabBarHeight + 16 }]}
        pointerEvents="none"
      >
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

      {/* ========== RIGHT ACTION RAIL (3 controls only) ========== */}
      {!immersiveOpen ? (
        <View style={styles.rightActionRail} pointerEvents="box-none">
          {/* 1) Top mute */}
          <MuteToggleButton
            muted={muted}
            onPress={toggleMute}
            style={styles.reelMuteBtn}
          />

          {/* 2) Custom skull → BAWAAL Skeleton Vault tray */}
          <TouchableOpacity
            ref={vaultBtnRef}
            style={[styles.reelVaultBtn, { bottom: vaultBottom }]}
            onPress={toggleVaultTray}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              vaultOpen
                ? 'Close BAWAAL skeleton vault'
                : 'Open BAWAAL skeleton vault'
            }
            accessibilityState={{ expanded: vaultOpen }}
            collapsable={false}
          >
            <Image
              source={vaultSkullSource}
              style={styles.reelVaultImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </TouchableOpacity>

          {/* 3) More ⋮ → secondary dropdown */}
          <TouchableOpacity
            style={[styles.reelMoreBtn, { bottom: moreBottom }]}
            onPress={toggleMoreMenu}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="More actions"
            accessibilityState={{ expanded: moreMenuOpen }}
          >
            <Text style={styles.reelMoreText}>⋮</Text>
          </TouchableOpacity>

          {/* Dropdown: Like · Banter · Share · DM · Comment */}
          <ReelActionSheet
            visible={moreMenuOpen}
            showLabels
            compact
            actionIds={REEL_SECONDARY_ACTION_IDS}
            reel={item}
            onClose={() => setMoreMenuOpen(false)}
            onAction={onMoreMenuAction}
            style={[
              styles.reelMoreMenu,
              { bottom: moreBottom + REEL_MORE.height + 8 },
            ]}
          />
        </View>
      ) : null}

      <FloatingEmojiBurstLayer
        particles={burstParticles}
        onParticleDone={removeBurstParticle}
        onLayout={onVideoContainerLayout}
        style={styles.reelBurstOverlay}
      />

      <BanterBottomSheet
        visible={banterOpen && !immersiveOpen}
        reel={item}
        onClose={() => setBanterOpen(false)}
      />
      <FullEmojiPickerDrawer
        visible={vaultOpen && !immersiveOpen}
        onClose={() => setVaultOpen(false)}
        onSelectEmoji={handleSelectSkull}
      />
      <DmSharePicker
        visible={dmShareOpen && !immersiveOpen}
        reel={item}
        onClose={() => setDmShareOpen(false)}
      />
    </View>
  );
});

const SPLIT_WIDE_MIN = 768;

const BattleCard = memo(function BattleCard({
  item,
  onOpenResponses,
  onRespond,
  shouldPlay = false,
  isMounted = false,
}) {
  const [muted, setMuted] = useState(true);
  const [banterOpen, setBanterOpen] = useState(false);
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [voting, setVoting] = useState(false);
  const [splitWide, setSplitWide] = useState(
    () => Dimensions.get('window').width >= SPLIT_WIDE_MIN
  );

  const isOpenChallenge =
    item?.isOpenChallenge === true ||
    String(item?.status || '').toUpperCase() === 'OPEN';
  const responses = sortResponses(item.responses, 'top');
  // Host lock: first successful response = Player B (primary rival)
  const rival = responses[0] || null;
  const responseCount = responses.length;
  const waitingForChallenger = isOpenChallenge && !rival;

  const openerUri =
    item.challengeVideoUri ||
    item.openerVideoUri ||
    (isOpenChallenge
      ? item.videoUri || item.uri || item.localVideoUri || null
      : null);
  const responseUri = isOpenChallenge
    ? rival?.videoUri || rival?.uri || rival?.localVideoUri || null
    : rival?.videoUri ||
      rival?.uri ||
      rival?.localVideoUri ||
      item.videoUri ||
      item.uri ||
      item.localVideoUri ||
      null;
  const challengeUri = isOpenChallenge
    ? openerUri
    : item.challengeVideoUri && item.challengeVideoUri !== responseUri
      ? item.challengeVideoUri
      : null;

  const challengeId = String(
    item.challengeId || item.battleId || item.id || ''
  );
  const fighterAId = String(
    item.hostResponseId || item.openerId || `host-${item.id}`
  );
  const fighterBId = String(rival?.id || `rival-${item.id}`);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const onSplitLayout = useCallback((e) => {
    const w = e?.nativeEvent?.layout?.width || 0;
    if (w > 0) {
      setSplitWide(w >= SPLIT_WIDE_MIN);
    }
  }, []);

  // Soft-load pairwise tallies when both fighters are present
  useEffect(() => {
    if (!rival || !challengeId) return undefined;
    let alive = true;
    (async () => {
      try {
        const roster = await fetchChallengeMatchupRoster(challengeId);
        if (!alive) return;
        const tallied = tallyMatchupVotes(
          roster?.votes || [],
          fighterAId,
          fighterBId
        );
        setVotesA(Number(tallied.votesA) || 0);
        setVotesB(Number(tallied.votesB) || 0);
      } catch (_) {
        /* soft-fail — keep local zeros */
      }
    })();
    return () => {
      alive = false;
    };
  }, [rival, challengeId, fighterAId, fighterBId]);

  const castVote = useCallback(
    async (side) => {
      if (!rival || voting) return;
      const votedForId = side === 'A' ? fighterAId : fighterBId;
      setVoting(true);
      if (side === 'A') setVotesA((n) => n + 1);
      else setVotesB((n) => n + 1);
      try {
        await castCustomMatchupVote({
          challengeId,
          fighterAId,
          fighterBId,
          votedForId,
        });
      } catch (_) {
        /* soft-fail — optimistic counts stay */
      } finally {
        setVoting(false);
      }
    },
    [rival, voting, challengeId, fighterAId, fighterBId]
  );

  const hostLabel = isOpenChallenge
    ? 'HOST · PLAYER A'
    : challengeUri
      ? item.opponent || 'PLAYER A'
      : rival?.creator === 'You'
        ? 'YOU · PLAYER A'
        : item.opponent || 'PLAYER A';

  const rivalLabel = rival
    ? rival.creator === 'You'
      ? 'YOU · PLAYER B'
      : `PLAYER B · @${String(rival.creator || 'rival').replace(/^@/, '')}`
    : 'PLAYER B';

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;

  const { tabBarHeight } = arenaOverlayClearance(useSafeAreaInsets());

  return (
    <View style={[styles.feedCard, { paddingBottom: tabBarHeight }]}>
      <View style={styles.feedCardHeader}>
        <View style={styles.battleBadge}>
          <Text style={styles.battleBadgeText}>
            {waitingForChallenger
              ? 'FACEOFF · OPEN'
              : isOpenChallenge
                ? 'FACEOFF · LIVE SPLIT'
                : 'OFFICIAL BATTLE'}
          </Text>
        </View>
        <Text style={styles.feedTime}>
          {waitingForChallenger
            ? 'WAITING FOR CHALLENGER'
            : item.status || 'BATTLE'}
        </Text>
      </View>

      <View style={styles.vsRow}>
        <Text style={styles.vsTitle}>
          {waitingForChallenger
            ? 'HOST (A) vs WAITING FOR CHALLENGER'
            : `${item.challengerLabel || 'HOST A'} vs ${
                item.leaderLabel || rivalLabel
              }`}
        </Text>
      </View>

      <View
        style={[
          styles.splitRow,
          splitWide ? styles.splitRowWide : styles.splitRowStack,
        ]}
        onLayout={onSplitLayout}
      >
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
            label={hostLabel}
            style={styles.splitClip}
            muted={muted}
            shouldPlay={shouldPlay}
            isMounted={isMounted}
          />
        </View>
        <View
          style={[
            styles.splitDivider,
            !splitWide && styles.splitDividerHorizontal,
          ]}
        >
          <Text style={styles.splitVs}>VS</Text>
        </View>
        <View style={styles.splitPane}>
          {waitingForChallenger ? (
            <TouchableOpacity
              style={[styles.splitClip, styles.openSlot]}
              onPress={() => onRespond?.(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Accept open challenge"
            >
              <Text style={styles.openSlotLabel}>WAITING FOR CHALLENGER</Text>
              <Text style={styles.openSlotCta}>ACCEPT · RECORD ATTEMPT</Text>
            </TouchableOpacity>
          ) : (
            <ClipSurface
              uri={responseUri}
              source={{
                uri: responseUri,
                videoUri: responseUri,
                video_url: rival?.video_url,
                localVideoUri: rival?.localVideoUri || item.localVideoUri,
                recordedVideoUri: rival?.recordedVideoUri,
                publicCloudUrl: rival?.publicCloudUrl || item.publicCloudUrl,
              }}
              label={rivalLabel}
              shouldPlay={shouldPlay}
              isMounted={isMounted}
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

      {/* Voting + banter bar — below split (async Faceoff) */}
      {!waitingForChallenger ? (
        <View style={styles.voteBanterBar}>
          <View style={styles.voteTrack}>
            <View style={[styles.voteFillA, { flex: Math.max(pctA, 8) }]} />
            <View style={[styles.voteFillB, { flex: Math.max(pctB, 8) }]} />
          </View>
          <View style={styles.voteActions}>
            <TouchableOpacity
              style={styles.voteBtnA}
              onPress={() => castVote('A')}
              disabled={voting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Vote A"
            >
              <Text style={styles.voteBtnText}>VOTE A · {votesA}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.banterBarBtn}
              onPress={() => setBanterOpen(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open banter"
            >
              <Text style={styles.banterBarBtnText}>BANTER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voteBtnB}
              onPress={() => castVote('B')}
              disabled={voting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Vote B"
            >
              <Text style={styles.voteBtnText}>VOTE B · {votesB}</Text>
            </TouchableOpacity>
          </View>
        </View>
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

      {waitingForChallenger ? (
        <TouchableOpacity
          style={styles.respondCta}
          onPress={() => onRespond?.(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Accept challenge"
        >
          <Text style={styles.respondCtaText}>ACCEPT CHALLENGE</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.respondCta}
          onPress={() => onOpenResponses?.(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="View responses tray"
        >
          <Text style={styles.respondCtaText}>VIEW RESPONSES</Text>
        </TouchableOpacity>
      )}

      <View style={styles.feedFooter}>
        <Text style={styles.targetText}>TARGET: {item.target}</Text>
        <View style={styles.postedBadge}>
          <Text style={styles.postedText}>{item.sport}</Text>
        </View>
      </View>

      <BanterBottomSheet
        visible={banterOpen}
        reel={item}
        onClose={() => setBanterOpen(false)}
      />
    </View>
  );
});

/**
 * Primary Arena feed page — full-bleed VideoItem + mute + vault + floating ⋮ stack.
 */
const ChallengeFeedCard = memo(function ChallengeFeedCard({
  item,
  index,
  activeIndex,
  screenHeight,
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [banterOpen, setBanterOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [dmShareOpen, setDmShareOpen] = useState(false);
  const [burstParticles, setBurstParticles] = useState([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const cardRef = useRef(null);
  const vaultBtnRef = useRef(null);
  const isActive = Math.abs(index - activeIndex) <= 1;
  const shouldPlay = index === activeIndex;
  const roomId = resolveVaultBurstRoomId(item);
  const vaultSkullSource =
    SKULL_ASSETS.skullOrange ||
    SKULL_ASSETS.skull_orange123 ||
    REEL_VAULT_SKULL ||
    getSkullAsset(REEL_VAULT_ICON_KEY) ||
    SKULL_ASSETS.skull_fire_full;

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  const toggleVaultTray = useCallback(() => {
    setMoreMenuOpen(false);
    setBanterOpen(false);
    setDmShareOpen(false);
    setVaultOpen((open) => !open);
  }, []);

  const toggleMoreMenu = useCallback(() => {
    setVaultOpen(false);
    setBanterOpen(false);
    setMoreMenuOpen((open) => !open);
  }, []);

  const removeBurstParticle = useCallback((id) => {
    setBurstParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onVideoContainerLayout = useCallback((event) => {
    const { width, height } = event?.nativeEvent?.layout || {};
    if (width > 0 && height > 0) {
      setContainerSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    }
  }, []);

  const triggerLocalEmojiBurst = useCallback(
    (emojiId) => {
      if (!emojiId) return;
      const next = createCenteredEmojiBurst(emojiId, containerSize);
      setBurstParticles((prev) => appendBurstParticles(prev, next));
    },
    [containerSize]
  );

  // Active challenge page only — subscribe to arena_${roomId} vault_burst
  useEffect(() => {
    if (!shouldPlay || !roomId) {
      return undefined;
    }
    return subscribeVaultBurstChannel(roomId, {
      onVaultBurst: (emojiId) => {
        triggerLocalEmojiBurst(emojiId);
      },
    });
  }, [shouldPlay, roomId, triggerLocalEmojiBurst]);

  const handleSelectSkull = useCallback(
    (emojiId) => {
      setVaultOpen(false);
      if (!emojiId) return;
      triggerLocalEmojiBurst(emojiId);
      void (async () => {
        const userId = await resolveBurstActorId();
        await broadcastVaultBurst(roomId, { emojiId, userId });
      })();
    },
    [triggerLocalEmojiBurst, roomId]
  );

  const onMoreMenuAction = useCallback(
    (actionId, reelSnapshot) => {
      setMoreMenuOpen(false);
      setVaultOpen(false);
      if (actionId === 'banter' || actionId === 'comment') {
        setBanterOpen(true);
        return;
      }
      if (actionId === 'dm' || actionId === 'send') {
        setDmShareOpen(true);
        return;
      }
      void dispatchReelSocialAction(actionId, reelSnapshot || item).catch(
        (err) => {
          console.warn('[ChallengeFeedCard] reel social:', err?.message || err);
        }
      );
    },
    [item]
  );

  return (
    <View
      ref={cardRef}
      style={[styles.challengePage, { height: screenHeight }]}
      collapsable={false}
      onLayout={onVideoContainerLayout}
    >
      <VideoItem
        item={item}
        itemHeight={screenHeight}
        isActive={isActive}
        shouldPlay={shouldPlay}
        muted={isMuted}
      />

      {/* ========== RIGHT ACTION RAIL (3 controls only) ========== */}
      <View style={styles.rightActionRail} pointerEvents="box-none">
        <MuteToggleButton
          muted={isMuted}
          onPress={toggleMute}
          style={styles.challengeMuteBtn}
        />

        <TouchableOpacity
          ref={vaultBtnRef}
          style={styles.challengeVaultBtn}
          onPress={toggleVaultTray}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            vaultOpen
              ? 'Close BAWAAL skeleton vault'
              : 'Open BAWAAL skeleton vault'
          }
          accessibilityState={{ expanded: vaultOpen }}
          collapsable={false}
        >
          <Image
            source={vaultSkullSource}
            style={styles.reelVaultImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.challengeMoreBtn}
          onPress={toggleMoreMenu}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          accessibilityState={{ expanded: moreMenuOpen }}
        >
          <Text style={styles.reelMoreText}>⋮</Text>
        </TouchableOpacity>

        <ReelActionSheet
          visible={moreMenuOpen}
          showLabels
          compact
          actionIds={REEL_SECONDARY_ACTION_IDS}
          reel={item}
          onClose={() => setMoreMenuOpen(false)}
          onAction={onMoreMenuAction}
          style={styles.challengeMoreMenu}
        />
      </View>

      <FloatingEmojiBurstLayer
        particles={burstParticles}
        onParticleDone={removeBurstParticle}
        onLayout={onVideoContainerLayout}
        style={styles.challengeBurstOverlay}
      />

      <BanterBottomSheet
        visible={banterOpen}
        reel={item}
        onClose={() => setBanterOpen(false)}
      />
      <FullEmojiPickerDrawer
        visible={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onSelectEmoji={handleSelectSkull}
      />
      <DmSharePicker
        visible={dmShareOpen}
        reel={item}
        onClose={() => setDmShareOpen(false)}
      />
    </View>
  );
});

const SHELF_CARD_SIZE = 148;

function shelfPosterUri(item) {
  const raw =
    item?.thumbnail_url ||
    item?.thumbnailUrl ||
    item?.poster_url ||
    item?.posterUrl ||
    item?.coverUrl ||
    null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

const ArenaShelfCard = memo(function ArenaShelfCard({
  item,
  onPress,
  placeholder = false,
}) {
  const title =
    item?.caption || item?.title || item?.target || item?.sport || 'CLIP';
  const sport = String(item?.sport || item?.category || 'ARENA').toUpperCase();
  const poster = !placeholder ? shelfPosterUri(item) : null;
  const hasVideo = !!(
    item?.videoUri ||
    item?.video_url ||
    item?.uri ||
    item?.localVideoUri ||
    item?.publicCloudUrl
  );

  /** Square card only — no title / track / chrome beneath the thumb. */
  const thumb = (
    <View style={styles.shelfThumb}>
      {poster ? (
        <SafeRemoteImage
          uri={poster}
          style={styles.shelfThumbImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.shelfThumbFallback}>
          {!placeholder ? (
            <>
              <Text style={styles.shelfThumbSport} numberOfLines={1}>
                {sport}
              </Text>
              {hasVideo ? (
                <Text style={styles.shelfThumbPlay}>▶</Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}
    </View>
  );

  if (placeholder) {
    return (
      <View style={styles.shelfCard} accessibilityElementsHidden>
        {thumb}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.shelfCard}
      activeOpacity={0.88}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={String(title)}
    >
      {thumb}
    </TouchableOpacity>
  );
});

const SHELF_PLACEHOLDER_COUNT = 4;

const ArenaShelfRow = memo(function ArenaShelfRow({
  title,
  subtitle,
  items,
  emptyLabel,
  onPressItem,
  /** When true and items empty, show square placeholder boxes instead of text. */
  showEmptyPlaceholders = false,
}) {
  const list = Array.isArray(items) ? items : [];
  const showPlaceholders = list.length === 0 && showEmptyPlaceholders;

  return (
    <View style={styles.dashSection}>
      <Text style={styles.dashSectionTitle}>{title}</Text>
      {subtitle ? (
        <Text style={styles.dashSectionSub}>{subtitle}</Text>
      ) : null}
      {list.length === 0 && !showPlaceholders ? (
        <View style={styles.shelfEmptyCard}>
          <Text style={styles.shelfEmptyText}>
            {emptyLabel || 'Nothing here yet'}
          </Text>
        </View>
      ) : (
        <View
          style={styles.shelfScrollShell}
          {...(Platform.OS === 'web'
            ? { className: BAWAAL_HSCROLL_HIDDEN_CLASS }
            : null)}
        >
          <ScrollView
            horizontal
            {...HSCROLL_HIDDEN_PROPS}
            contentContainerStyle={styles.shelfRow}
            style={[
              styles.shelfScroll,
              styles.shelfScrollNoBar,
              HSCROLL_HIDDEN_STYLE,
            ]}
          >
            {showPlaceholders
              ? Array.from({ length: SHELF_PLACEHOLDER_COUNT }).map(
                  (_, index) => (
                    <ArenaShelfCard
                      key={`placeholder-${title}-${index}`}
                      placeholder
                    />
                  )
                )
              : list.map((item, index) => (
                  <ArenaShelfCard
                    key={String(item?.id || `${title}-${index}`)}
                    item={item}
                    onPress={onPressItem}
                  />
                ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

export default function ArenaFeed({ navigation, route }) {
  // Re-assert web CSS kill-switch whenever Arena mounts (covers SPA remounts).
  useEffect(() => {
    injectArenaHorizontalScrollbarKillCss();
  }, []);

  const screenHeight = Dimensions.get('window').height;
  const { headerHeight } = arenaOverlayClearance(useSafeAreaInsets());
  const { openProfileGateway, openBattlesCallout } = useMainTabs();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [liveArenaOpen, setLiveArenaOpen] = useState(false);
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const initialFilters = getArenaFilters();
  const [selectedFeedTier, setSelectedFeedTier] = useState(
    initialFilters.tierId || ARENA_FEED_TIER_ALL
  );
  const [selectedSportFilter, setSelectedSportFilter] = useState(
    initialFilters.sportLabel
  );
  const { callouts: liveCallouts, refresh: refreshOpenBattles } = useBattles();
  const {
    items: videoFeedItems,
    refresh: refreshVideoFeed,
    loading: videoFeedLoading,
  } = useArenaFeed();
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
  /** Full section playlist for Instagram-style vertical reel paging. */
  const [reelPlaylist, setReelPlaylist] = useState([]);
  const [reelInitialIndex, setReelInitialIndex] = useState(0);
  const [immersiveMuted, setImmersiveMuted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Initial / explicit Supabase fetch of arena_challenges. */
  const [feedLoading, setFeedLoading] = useState(true);
  /** Index of the row that has settled in the viewport. */
  const [activeIndex, setActiveIndex] = useState(0);
  const [videos, setVideos] = useState([]);
  const ingestedIds = useRef(new Set());
  const demosSeededRef = useRef(false);
  const listRef = useRef(null);

  /** Direct `arena_challenges` query (created_at desc) — no sport filters. */
  const load = useCallback(async () => {
    console.log('[ArenaFeed] FETCH arena_challenges start', {
      select: ARENA_CHALLENGES_FEED_SELECT,
      sportFilter: null,
    });
    if (!isSupabaseConfigured()) {
      console.warn(
        '[ArenaFeed] FETCH arena_challenges skipped — Supabase not configured'
      );
      setFeedLoading(false);
      return [];
    }
    setFeedLoading(true);
    try {
      // No .eq('sport', …) — COMBAT and every sport must appear in the feed
      let { data, error, status, statusText } = await supabase
        .from('arena_challenges')
        .select(ARENA_CHALLENGES_FEED_SELECT)
        .order('created_at', { ascending: false })
        .limit(40);

      if (
        error &&
        /description|column|schema cache|PGRST204|Could not find/i.test(
          String(error.message || error.code || '')
        )
      ) {
        console.warn(
          '[ArenaFeed] FETCH retry without description column',
          { message: error.message, code: error.code }
        );
        const lean = await supabase
          .from('arena_challenges')
          .select('id, user_id, title, sport, video_url, created_at')
          .order('created_at', { ascending: false })
          .limit(40);
        data = lean.data;
        error = lean.error;
        status = lean.status;
        statusText = lean.statusText;
      }

      if (error) {
        console.error(
          '[ArenaFeed] FETCH arena_challenges error — schema/RLS mismatch?',
          {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status,
            statusText,
          }
        );
        // Soft-fallback via service mapper (same table, richer logging)
        const cards = await fetchArenaChallenges({ limit: 40 });
        console.log('ARENA_CHALLENGES_FETCHED:', cards);
        const mapped = sortByCreatedAtDesc(
          cards.map((c) => ({
            id: c.id,
            user_id: c.user_id || null,
            title: c.title || c.target || c.caption,
            description: c.description || c.targetDetails || null,
            sport: c.sport || c.category,
            video_url: c.videoUri || c.video_url || c.openerVideoUri,
            created_at: c.createdAt
              ? new Date(c.createdAt).toISOString()
              : c.created_at,
            caption: c.caption || c.target || c.title,
            author: c.author || c.host,
            _fromArenaChallenges: true,
          }))
        );
        setVideos(mapped);
        return mapped;
      }
      const rows = sortByCreatedAtDesc(Array.isArray(data) ? data : []);
      console.log('ARENA_CHALLENGES_FETCHED:', rows);
      console.log('[ArenaFeed] FETCH arena_challenges ok', {
        count: rows.length,
        combatCount: rows.filter(
          (r) => String(r?.sport || '').toUpperCase() === 'COMBAT'
        ).length,
        newestId: rows[0]?.id || null,
        newestCreatedAt: rows[0]?.created_at || null,
        sports: [...new Set(rows.map((r) => r?.sport).filter(Boolean))],
        sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
      });
      setVideos(rows);
      return rows;
    } catch (err) {
      console.error('[ArenaFeed] FETCH arena_challenges crashed:', {
        message: err?.message || String(err),
        err,
      });
      return [];
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn(
        '[ArenaFeed] Supabase is not configured — arena_challenges feed offline'
      );
      return;
    }
    load();
  }, [load]);

  // Re-assert AV session when Arena mounts (camera/record may have changed it)
  useEffect(() => {
    void configureGlobalAudioSession();
  }, []);

  // FlatList requires a stable ref. Commit activeIndex only after a row has settled.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0 && typeof viewableItems[0].index === 'number') {
      const nextIndex = viewableItems[0].index;
      if (nextIndex === activeIndexRef.current) return;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
  }).current;
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
      // Re-query arena_challenges first (created_at desc) so newest clips lead
      await load();
      await refreshArenaChallengesIntoFeed({ emitEvent: true });
      const [posts, videoRows] = await Promise.all([
        refreshArenaPostsFromSupabase(),
        fetchArenaFeed('ALL').catch(() => []),
      ]);
      const playableVideos = (Array.isArray(videoRows) ? videoRows : []).filter(
        (row) =>
          row?._fromVideosTable &&
          (row.videoUri || row.videoUrl || row.video_url || row.uri)
      );
      const merged = sortByCreatedAtDesc([
        ...(Array.isArray(posts) ? posts : []),
        ...playableVideos,
      ]);
      setFeedItems((prev) => {
        // Keep fresh publishes + always-on official battle shells
        let next = prev.filter(
          (p) =>
            p?._demoBattle ||
            p?._freshPublish ||
            createdAtMs(p) > Date.now() - 120_000
        );
        // Ingest oldest→newest so final sortFeedItems leaves newest on top
        const ordered = [...merged].sort(
          (a, b) => createdAtMs(a) - createdAtMs(b)
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
      // Soft-fail dashboard shelves (war cry / sparks / battle / face-off)
      try {
        const sections = await fetchArenaDashboardSections();
        setDashboardRemote({
          warCryMatches: sections?.warCryMatches || [],
          sparksJosh: sections?.sparksJosh || [],
          battleBawaal: sections?.battleBawaal || [],
          faceOff: sections?.faceOff || [],
        });
        const live = sections?.warCryMatches?.[0];
        if (live) {
          setWarCryLiveMeta({
            hostScore: Number(live.host_score) || 0,
            rivalScore: Number(live.rival_score) || 0,
            spectatorCount: Number(live.spectator_count) || 0,
          });
        }
      } catch {
        /* keep prior dashboardRemote / mocks */
      }
    } catch (err) {
      console.warn('[ArenaFeed] pull-to-refresh failed:', err?.message || err);
      setFeedItems((prev) => sortFeedItems(ensureDefaultBattles(prev)));
    } finally {
      setRefreshing(false);
    }
  }, [refreshVideoFeed, refreshOpenBattles, load]);

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

  // Absorb freshly fetched `arena_challenges` rows into the cinematic feed
  useEffect(() => {
    if (!Array.isArray(videos) || videos.length === 0) return;
    for (const row of videos) {
      try {
        const card = mapArenaChallengeRowToCard(row);
        if (!card) continue;
        absorbPost({
          ...card,
          _fromRemote: true,
          _fromArenaChallenges: true,
        });
      } catch (err) {
        console.warn(
          '[ArenaFeed] arena_challenges absorb skipped:',
          err?.message || err
        );
      }
    }
  }, [videos, absorbPost]);

  /** Unified Arena video feed — reels + challenge cards; shelves inject every N rows. */
  const visibleFeed = useMemo(() => {
    // Loaded from public.arena_challenges (created_at desc)
    const cloudChallenges = videos
      .map((row) => {
        try {
          const card = mapArenaChallengeRowToCard(row);
          if (card) {
            return {
              ...card,
              _fromRemote: true,
              _fromArenaChallenges: true,
            };
          }
        } catch (_) {
          /* fall through to reel map */
        }
        const videoUrl = battleRowVideoUrl(row);
        if (!videoUrl) return null;
        return mapPostToReel({
          ...row,
          type: 'reel',
          video_url: videoUrl,
          videoUrl,
          videoUri: videoUrl,
          uri: videoUrl,
          thumbnail_url:
            row.thumbnail_url || row.thumbnail || row.thumbnailUrl || null,
          caption: row.caption || row.title || row.target || 'Battle',
          author: row.author || row.handle || row.creator || '@athlete',
          createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
          _fromArenaChallenges: true,
        });
      })
      .filter(Boolean);
    const source = ensureDefaultBattles([...cloudChallenges, ...feedItems]);
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
    // Newest created_at first (fresh publishes still win via feedSortScore)
    return sortFeedItems(out);
  }, [feedItems, videos]);

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

  /**
   * Vertical Arena list data — every Supabase `arena_challenges` row, newest first,
   plus any fresh local publishes not yet present in the cloud array.
   */
  const challengeVideoFeed = useMemo(() => {
    const seen = new Set();
    const out = [];

    const pushRow = (row, index) => {
      const mapped = mapChallengeRowToFeedItem(row, index);
      if (!mapped?.id || seen.has(mapped.id)) return;
      // Also dedupe by identical playable URI when both cloud + local copies exist
      const vKey = videoIdentityKey(mapped.video_url);
      if (vKey && seen.has(`v:${vKey}`)) return;
      seen.add(mapped.id);
      if (vKey) seen.add(`v:${vKey}`);
      out.push(mapped);
    };

    // 1) All rows returned from Supabase (created_at desc)
    const cloud = sortByCreatedAtDesc(Array.isArray(videos) ? videos : []);
    cloud.forEach((row, index) => pushRow(row, index));

    // 2) Fresh device publishes not yet mirrored in the cloud fetch
    const locals = sortByCreatedAtDesc(
      (Array.isArray(feedItems) ? feedItems : []).filter(
        (item) =>
          item &&
          item.type !== 'community_shelf' &&
          (item._freshPublish ||
            item._fromArenaChallenges ||
            battleRowVideoUrl(item))
      )
    );
    locals.forEach((row, index) => pushRow(row, cloud.length + index));

    return sortByCreatedAtDesc(out);
  }, [videos, feedItems]);

  /** Tier + sport filtered infinite feed (GAME ON drawer). */
  const filteredChallengeVideoFeed = useMemo(
    () =>
      applyArenaFeedFilters(challengeVideoFeed, {
        tierId: selectedFeedTier,
        sportLabel: selectedSportFilter,
      }),
    [challengeVideoFeed, selectedFeedTier, selectedSportFilter]
  );

  useEffect(() => {
    let cancelled = false;
    hydrateArenaFilters().then((f) => {
      if (cancelled || !f) return;
      setSelectedFeedTier(f.tierId || ARENA_FEED_TIER_ALL);
      setSelectedSportFilter(f.sportLabel);
    });
    const unsub = subscribeArenaFilters((f) => {
      setSelectedFeedTier(f.tierId || ARENA_FEED_TIER_ALL);
      setSelectedSportFilter(f.sportLabel);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      } catch {
        /* ignore */
      }
    });
  }, [selectedFeedTier, selectedSportFilter]);

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

  const onSelectFeedTier = useCallback((tierId) => {
    const next = tierId || ARENA_FEED_TIER_ALL;
    setSelectedFeedTier(next);
    setArenaFeedTier(next);
  }, []);

  const onSelectSportFilter = useCallback((sportLabel) => {
    setSelectedSportFilter(sportLabel);
    setArenaSportFilter(sportLabel);
  }, []);

  /** Category pills — All + 7 GAME ON section titles. */
  const [dashboardCategory, setDashboardCategory] = useState('All');
  /** Supabase dashboard shelves (+ mock seeds when tables missing/empty). */
  const [dashboardRemote, setDashboardRemote] = useState({
    warCryMatches: [],
    sparksJosh: [],
    battleBawaal: [],
    faceOff: [],
  });
  const [warCryLiveMeta, setWarCryLiveMeta] = useState({
    hostScore: 0,
    rivalScore: 0,
    spectatorCount: 0,
  });

  // Live Match Telecast hub badge (public live only — LIVE AROUND THE WORLD)
  useEffect(() => {
    let alive = true;
    const countPublic = (list) =>
      (Array.isArray(list) ? list : []).filter(isPublicLiveMatch).length;
    listLiveMatches()
      .then((list) => {
        if (alive) setLiveMatchCount(countPublic(list));
      })
      .catch(() => {});
    const unsub = subscribeLiveMatchList((list) => {
      if (alive) setLiveMatchCount(countPublic(list));
    });
    return () => {
      alive = false;
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  const openLiveMatchRoom = useCallback(
    (match, role) => {
      if (!match?.id) return;
      const inviteCode = String(match?.invite_code || '').trim();
      navigation?.navigate?.('LiveMatchRoom', {
        matchId: match.id,
        match,
        role: role === 'host' ? 'host' : 'viewer',
        ...(inviteCode ? { inviteCode } : null),
      });
    },
    [navigation]
  );

  const onSelectDashboardCategory = useCallback((label) => {
    setDashboardCategory(label || 'All');
  }, []);

  const filterByDashboardCategory = useCallback(
    (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!dashboardCategory || dashboardCategory === 'All') return list;
      return list.filter(
        (item) =>
          resolveDashboardCategory(item.sport || item.category) ===
          dashboardCategory
      );
    },
    [dashboardCategory]
  );

  const hydrateArenaDashboard = useCallback(async () => {
    try {
      const sections = await fetchArenaDashboardSections();
      setDashboardRemote({
        warCryMatches: sections.warCryMatches || [],
        sparksJosh: sections.sparksJosh || [],
        battleBawaal: sections.battleBawaal || [],
        faceOff: sections.faceOff || [],
      });
      const live = sections.warCryMatches?.[0];
      if (live) {
        setWarCryLiveMeta({
          hostScore: Number(live.host_score) || 0,
          rivalScore: Number(live.rival_score) || 0,
          spectatorCount: Number(live.spectator_count) || 0,
        });
      }
    } catch (_) {
      /* fetchArenaDashboardSections never throws — belt & suspenders */
    }
  }, []);

  useEffect(() => {
    void hydrateArenaDashboard();
  }, [hydrateArenaDashboard]);

  useFocusEffect(
    useCallback(() => {
      void hydrateArenaDashboard();
      return undefined;
    }, [hydrateArenaDashboard])
  );

  // Live scores / spectators / shelf inserts — soft-fail when offline
  useEffect(() => {
    const unsub = subscribeArenaDashboardRealtime({
      onWarCryMatch: (row) => {
        setDashboardRemote((prev) => {
          const rest = (prev.warCryMatches || []).filter(
            (m) => String(m.id) !== String(row.id)
          );
          const next = [
            {
              id: String(row.id),
              status: String(row.status || 'LIVE').toUpperCase(),
              sport: row.sport || 'COMBAT',
              host_handle: row.host_handle || '@host',
              rival_handle: row.rival_handle || '@rival',
              host_score: Number(row.host_score) || 0,
              rival_score: Number(row.rival_score) || 0,
              spectator_count: Number(row.spectator_count) || 0,
              room_id: row.room_id || String(row.id),
              title: row.title || 'WAR CRY · LIVE',
              thumbnail_url: row.thumbnail_url || null,
              _fromDashboard: true,
            },
            ...rest,
          ].slice(0, 4);
          return { ...prev, warCryMatches: next };
        });
      },
      onScoreUpdate: (payload) => {
        setWarCryLiveMeta((prev) => ({
          hostScore:
            payload.hostScore != null ? Number(payload.hostScore) : prev.hostScore,
          rivalScore:
            payload.rivalScore != null
              ? Number(payload.rivalScore)
              : prev.rivalScore,
          spectatorCount:
            payload.spectatorCount != null
              ? Number(payload.spectatorCount)
              : prev.spectatorCount,
        }));
        if (payload.hostHandle || payload.rivalHandle) {
          setDashboardRemote((prev) => {
            const first = prev.warCryMatches?.[0];
            if (!first) return prev;
            const updated = {
              ...first,
              host_handle: payload.hostHandle || first.host_handle,
              rival_handle: payload.rivalHandle || first.rival_handle,
              host_score:
                payload.hostScore != null
                  ? Number(payload.hostScore)
                  : first.host_score,
              rival_score:
                payload.rivalScore != null
                  ? Number(payload.rivalScore)
                  : first.rival_score,
              spectator_count:
                payload.spectatorCount != null
                  ? Number(payload.spectatorCount)
                  : first.spectator_count,
              sport: payload.sport || first.sport,
            };
            return {
              ...prev,
              warCryMatches: [updated, ...(prev.warCryMatches || []).slice(1)],
            };
          });
        }
      },
      onSparksJosh: () => {
        void hydrateArenaDashboard();
      },
      onBattleBawaal: () => {
        void hydrateArenaDashboard();
      },
      onFaceOff: () => {
        void hydrateArenaDashboard();
      },
    });
    return () => {
      try {
        unsub?.();
      } catch (_) {
        /* soft-fail */
      }
    };
  }, [hydrateArenaDashboard]);

  const discoveryFeed = useMemo(() => {
    const rows = filteredChallengeVideoFeed || [];
    if (!dashboardCategory || dashboardCategory === 'All') return rows;
    return rows.filter(
      (item) =>
        resolveDashboardCategory(item.sport || item.category) ===
        dashboardCategory
    );
  }, [filteredChallengeVideoFeed, dashboardCategory]);

  const sparkJoshShelf = useMemo(() => {
    const remote = filterByDashboardCategory(dashboardRemote.sparksJosh);
    if (remote.length) return remote.slice(0, 16);
    const rows = discoveryFeed.filter((item) => {
      const mode = String(
        item.mode || item.source || item.tier || ''
      ).toUpperCase();
      if (item.type === 'battle_thread') return false;
      if (mode.includes('FACEOFF') || mode.includes('FACE OFF')) return false;
      if (mode.includes('WAR') && mode.includes('CRY')) return false;
      return (
        mode.includes('SPARK') ||
        mode.includes('JOSH') ||
        item.type === 'reel' ||
        Boolean(item.video_url || item.videoUri || item.uri)
      );
    });
    return rows.slice(0, 16);
  }, [dashboardRemote.sparksJosh, discoveryFeed, filterByDashboardCategory]);

  const battleBawaalShelf = useMemo(() => {
    const remote = filterByDashboardCategory(dashboardRemote.battleBawaal);
    if (remote.length) return remote.slice(0, 16);
    const rows = discoveryFeed.filter((item) => {
      const mode = String(
        item.mode || item.source || item.tier || item.type || ''
      ).toLowerCase();
      return (
        item.type === 'battle_thread' ||
        mode.includes('battle') ||
        mode.includes('bawaal battle') ||
        mode.includes('group')
      );
    });
    return rows.slice(0, 16);
  }, [dashboardRemote.battleBawaal, discoveryFeed, filterByDashboardCategory]);

  const faceOffShelf = useMemo(() => {
    const remote = filterByDashboardCategory(dashboardRemote.faceOff);
    const isFaceOffItem = (item) => {
      if (!item) return false;
      const mode = String(
        item.mode || item.source || item.tier || item.type || ''
      ).toLowerCase();
      const shelf = String(item.shelf || '').toLowerCase();
      return (
        shelf === 'face_off' ||
        mode.includes('faceoff') ||
        mode.includes('face off') ||
        item.isOpenChallenge === true ||
        String(item.status || '').toUpperCase() === 'OPEN'
      );
    };
    // Fresh publishes (incl. local/blob URIs) must lead — remote alone used to hide them
    const fromFeed = discoveryFeed.filter(isFaceOffItem).map((item) => {
      const playable =
        item.videoUri ||
        item.video_url ||
        item.uri ||
        item.publicCloudUrl ||
        item.localVideoUri ||
        null;
      return {
        ...item,
        type: 'faceoff',
        mode: item.mode || 'FACEOFF',
        videoUri: playable,
        video_url: playable,
        uri: playable,
        title: item.title || item.caption || 'FACE OFF',
        caption: item.caption || item.title || 'FACE OFF',
        _freshPublish: item._freshPublish === true,
      };
    });
    const fromCallouts = (communityCallouts || [])
      .filter((c) => {
        if (!dashboardCategory || dashboardCategory === 'All') return true;
        return (
          resolveDashboardCategory(c.sport || c.category) === dashboardCategory
        );
      })
      .map((c, i) => ({
        id: c.id || `faceoff-callout-${i}`,
        title: c.target || c.title || c.description || 'FACE OFF',
        caption: c.target || c.title || 'FACE OFF',
        sport: c.sport || c.category || 'ARENA',
        author: c.host || c.author || '@athlete',
        thumbnail_url: c.thumbnail_url || c.posterUrl || null,
        videoUri:
          c.videoUri || c.video_url || c.uri || c.openerVideoUri || null,
        video_url:
          c.video_url || c.videoUri || c.uri || c.openerVideoUri || null,
        type: 'faceoff',
        _fromCallout: true,
        raw: c,
      }));
    const merged = [...fromFeed, ...remote, ...fromCallouts];
    const seen = new Set();
    const out = [];
    for (const row of merged) {
      const key = String(row.id || row.videoUri || row.uri || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= 16) break;
    }
    return out;
  }, [
    dashboardRemote.faceOff,
    discoveryFeed,
    communityCallouts,
    dashboardCategory,
    filterByDashboardCategory,
  ]);

  /** War Cry LIVE dual-lane — prefer live match row from Supabase / mock. */
  const warCryDualFeeds = useMemo(() => {
    const live = filterByDashboardCategory(dashboardRemote.warCryMatches)[0];
    if (live) {
      return {
        host: {
          handle: live.host_handle || '@warcry_host',
          sport:
            live.sport ||
            (dashboardCategory === 'All' ? 'ARENA' : dashboardCategory),
        },
        rival: {
          handle: live.rival_handle || '@warcry_rival',
          sport:
            live.sport ||
            (dashboardCategory === 'All' ? 'ARENA' : dashboardCategory),
        },
        matchId: live.id,
        roomId: live.room_id || live.id,
        hostScore: Number(live.host_score) || warCryLiveMeta.hostScore || 0,
        rivalScore: Number(live.rival_score) || warCryLiveMeta.rivalScore || 0,
        spectatorCount:
          Number(live.spectator_count) || warCryLiveMeta.spectatorCount || 0,
      };
    }
    const pool = sparkJoshShelf.length ? sparkJoshShelf : discoveryFeed;
    const a = pool[0] || null;
    const b = pool[1] || pool[0] || null;
    return {
      host: {
        handle: a?.author || a?.host || '@warcry_host',
        sport:
          a?.sport ||
          a?.category ||
          (dashboardCategory === 'All' ? 'ARENA' : dashboardCategory),
      },
      rival: {
        handle: b?.author || b?.host || '@warcry_rival',
        sport:
          b?.sport ||
          b?.category ||
          (dashboardCategory === 'All' ? 'ARENA' : dashboardCategory),
      },
      matchId: null,
      roomId: null,
      hostScore: warCryLiveMeta.hostScore || 0,
      rivalScore: warCryLiveMeta.rivalScore || 0,
      spectatorCount: warCryLiveMeta.spectatorCount || 0,
    };
  }, [
    dashboardRemote.warCryMatches,
    sparkJoshShelf,
    discoveryFeed,
    dashboardCategory,
    filterByDashboardCategory,
    warCryLiveMeta,
  ]);

  /** Full-screen immersive War Cry / 1v1 active battle. */
  const openImmersiveBattle = useCallback(
    (opts = {}) => {
      const battle = opts.item || null;
      const battleId = String(
        battle?.battleId ||
          battle?.challengeId ||
          battle?.id ||
          `war-cry-live-${Date.now()}`
      );
      const hostHandle =
        opts.playerA?.handle ||
        warCryDualFeeds.host.handle ||
        battle?.author ||
        '@host';
      const rivalHandle =
        opts.playerB?.handle ||
        warCryDualFeeds.rival.handle ||
        battle?.rival ||
        '@rival';
      navigation?.navigate?.('Live1v1Battle', {
        mode: 'spectator',
        role: 'spectator',
        battleId,
        forceDual: true,
        focusSide: opts.side || 'card',
        match: {
          category:
            battle?.title ||
            battle?.caption ||
            battle?.target ||
            '[WAR CRY] 1v1 LIVE CHALLENGE',
          timerLabel: '90',
          spectatorsLabel: 'LIVE',
          status: 'live',
          forceDual: true,
          hostHandle,
          rivalHandle,
          hostScore: warCryDualFeeds.hostScore,
          rivalScore: warCryDualFeeds.rivalScore,
          initialHostVotes: warCryDualFeeds.hostScore || 12,
          initialRivalVotes: warCryDualFeeds.rivalScore || 9,
          initialHype: warCryDualFeeds.spectatorCount || 88,
          sport:
            battle?.sport ||
            battle?.category ||
            warCryDualFeeds.host.sport ||
            (dashboardCategory === 'All' ? 'ARENA' : dashboardCategory),
          host: {
            handle: hostHandle,
            label: String(hostHandle).replace(/^@/, ''),
            flag: '🇮🇳',
          },
          challengers: [
            {
              id: 'arena-rival',
              userId: 'arena-rival',
              handle: rivalHandle,
              label: String(rivalHandle).replace(/^@/, ''),
              flag: '🇮🇳',
              votes: warCryDualFeeds.rivalScore || 9,
            },
          ],
        },
      });
    },
    [navigation, warCryDualFeeds, dashboardCategory]
  );

  const openWarCryLive = useCallback(() => {
    openImmersiveBattle({
      side: 'warcry',
      playerA: warCryDualFeeds.host,
      playerB: warCryDualFeeds.rival,
    });
  }, [openImmersiveBattle, warCryDualFeeds]);

  const normalizeReelForViewer = useCallback((item) => {
    if (!item) return null;
    const videoUri =
      item.videoUri ||
      item.videoUrl ||
      item.video_url ||
      item.uri ||
      item.publicCloudUrl ||
      null;
    return {
      ...item,
      type: item.type || 'reel',
      author: item.author || item.handle || item.host || '@athlete',
      caption: item.caption || item.title || item.target || '',
      title: item.title || item.caption || item.target || 'ARENA REEL',
      videoUri,
      video_url: item.video_url || videoUri,
      uri: item.uri || videoUri,
      thumbnailUrl:
        item.thumbnailUrl ||
        item.thumbnail_url ||
        item.posterUri ||
        item.poster_url ||
        null,
      thumbnail_url:
        item.thumbnail_url ||
        item.thumbnailUrl ||
        item.posterUri ||
        item.poster_url ||
        null,
    };
  }, []);

  const openReel = useCallback((item, opts) => {
    if (!item) return;
    if (item._fromCallout || item.raw) {
      openShelfCallout(item.raw || item);
      return;
    }
    const normalized = normalizeReelForViewer(item);
    if (!normalized) return;

    const rawPlaylist = Array.isArray(opts?.playlist) ? opts.playlist : null;
    let playlist = rawPlaylist
      ? rawPlaylist.map(normalizeReelForViewer).filter(Boolean)
      : [normalized];
    if (!playlist.length) playlist = [normalized];

    let initialIndex = Number(opts?.initialIndex);
    if (!Number.isFinite(initialIndex) || initialIndex < 0) {
      const byId =
        normalized.id != null
          ? playlist.findIndex((r) => String(r.id) === String(normalized.id))
          : -1;
      initialIndex = byId >= 0 ? byId : 0;
    }
    initialIndex = Math.min(initialIndex, playlist.length - 1);

    setImmersiveMuted(!!opts?.muted);
    setReelPlaylist(playlist);
    setReelInitialIndex(initialIndex);
    setWarmReel(playlist[initialIndex] || normalized);
    setActiveReel(playlist[initialIndex] || normalized);
  }, [normalizeReelForViewer, openShelfCallout]);

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
      const pageStyle = {
        height: screenHeight,
        width: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
      };
      if (item.type === 'community_shelf') {
        return (
          <View style={[pageStyle, { paddingTop: headerHeight }]}>
            <CommunityChallengesShelf
              callouts={communityCallouts}
              onOpenCallout={openShelfCallout}
            />
          </View>
        );
      }
      const shouldPlay = index === activeIndex;
      const isMounted = Math.abs(index - activeIndex) <= 1;
      if (item.type === 'reel') {
        return (
          <View style={pageStyle}>
            <GeneralReelCard
              item={item}
              onOpen={openReel}
              shouldPlay={shouldPlay}
              isMounted={isMounted}
              // Hide ALL feed overlays while any fullscreen reel is open
              immersiveOpen={!!activeReel}
            />
          </View>
        );
      }
      if (item.type === 'battle_thread') {
        return (
          <View style={pageStyle}>
            <BattleCard
              item={item}
              onOpenResponses={openResponses}
              onRespond={openChallengeRespond}
              shouldPlay={shouldPlay && !activeReel}
              isMounted={isMounted && !activeReel}
            />
          </View>
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
      activeIndex,
      activeReel,
      screenHeight,
      headerHeight,
    ]
  );

  const emptyFilter = useMemo(
    () => (
      <View style={styles.emptyFeed}>
        <Text style={styles.emptyFeedTitle}>
          {selectedFeedTier === ARENA_FEED_TIER_ALL
            ? 'NO CLIPS YET'
            : 'NO CLIPS IN THIS TIER'}
        </Text>
        <Text style={styles.emptyFeedSub}>
          {selectedFeedTier === ARENA_FEED_TIER_ALL
            ? 'Drop a clip to light up Arena. Open callouts live on the Battles tab.'
            : 'Try All, or publish a challenge into this destination tier.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyFeedBtn}
          onPress={() =>
            navigation?.navigate?.('UniversalCamera', { initialMode: 'JOSH' })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.emptyFeedBtnText}>POST A CLIP</Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation, selectedFeedTier]
  );

  const getFeedItemLayout = useCallback(
    (_, index) => ({
      length: screenHeight,
      offset: screenHeight * index,
      index,
    }),
    [screenHeight]
  );

  /** Local / blob clip still uploading — show busy indicator on Arena. */
  const isUploadingClip = useMemo(() => {
    const checkUri = (uri) => {
      if (typeof uri !== 'string' || !uri.trim()) return false;
      const t = uri.trim();
      return (
        t.startsWith('blob:') ||
        t.startsWith('file:') ||
        t.startsWith('content:') ||
        t.startsWith('ph://')
      );
    };
    const fromRoute = route?.params?.newArenaPost;
    if (
      fromRoute &&
      checkUri(
        fromRoute.videoUri ||
          fromRoute.video_url ||
          fromRoute.uri ||
          fromRoute.localVideoUri
      )
    ) {
      return true;
    }
    return (feedItems || []).some(
      (item) =>
        item?._freshPublish === true &&
        checkUri(
          item.localVideoUri || item.videoUri || item.uri || item.video_url
        ) &&
        !/^https?:\/\//i.test(
          String(item.videoUri || item.uri || item.video_url || '')
        )
    );
  }, [feedItems, route?.params?.newArenaPost]);

  const showFeedSpinner =
    isUploadingClip ||
    (feedLoading && challengeVideoFeed.length === 0 && !refreshing) ||
    (videoFeedLoading && challengeVideoFeed.length === 0 && !refreshing);

  /** One full-bleed page per challenge — mute + ⋮ overlays on the video card. */
  const renderChallengeVideo = useCallback(
    ({ item, index }) => (
      <ChallengeFeedCard
        item={item}
        index={index}
        activeIndex={activeIndex}
        screenHeight={screenHeight}
      />
    ),
    [activeIndex, screenHeight]
  );

  const emptyChallengeList = useMemo(
    () =>
      showFeedSpinner || refreshing ? (
        <View style={styles.loadingEmpty}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.loadingEmptyText}>
            {isUploadingClip ? 'UPLOADING…' : 'LOADING CLIPS…'}
          </Text>
        </View>
      ) : (
        emptyFilter
      ),
    [showFeedSpinner, refreshing, isUploadingClip, emptyFilter]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <ArenaV2Header
          onBrandPress={openProfileGateway}
          onLivePress={() => setLiveArenaOpen(true)}
          liveCount={liveMatchCount}
          onNearMePress={() => navigation?.navigate?.('SportHubMap')}
          onNotificationsPress={() => setNotificationsOpen(true)}
        />
      </View>

      <ScrollView
        style={styles.feedList}
        contentContainerStyle={styles.dashboardScroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
            progressBackgroundColor="#121212"
          />
        }
      >
        {/* ========== TIER 1 · WAR CRY · LIVE ========== */}
        <View style={styles.dashSection}>
          <Pressable
            style={styles.warCryLiveCard}
            onPress={openWarCryLive}
            accessibilityRole="button"
            accessibilityLabel="Enter War Cry live battle"
          >
            <View style={styles.warCryLiveHeader} pointerEvents="none">
              <View style={styles.warCryLiveDot} />
              <Text style={styles.warCryLiveTitle}>
                WAR CRY ·{' '}
                <Text style={styles.warCryLiveAccent}>LIVE</Text>
              </Text>
            </View>
            <View style={styles.warCryDualRow}>
              <TouchableOpacity
                style={[styles.warCryPane, styles.warCryPaneHost]}
                activeOpacity={0.88}
                onPress={openWarCryLive}
                accessibilityRole="button"
                accessibilityLabel="Open host War Cry lane"
              >
                <Text style={styles.warCryPaneBadgeText}>HOST</Text>
                <Text style={styles.warCryPaneHandle} numberOfLines={1}>
                  {warCryDualFeeds.host.handle}
                </Text>
                <Text style={styles.warCryPaneSport} numberOfLines={1}>
                  {String(warCryDualFeeds.host.sport).toUpperCase()}
                  {warCryDualFeeds.hostScore
                    ? ` · ${warCryDualFeeds.hostScore}`
                    : ''}
                </Text>
              </TouchableOpacity>

              <View style={styles.warCryDualVs} pointerEvents="none">
                <Text style={styles.warCryDualVsText}>VS</Text>
              </View>

              <TouchableOpacity
                style={[styles.warCryPane, styles.warCryPaneRival]}
                activeOpacity={0.88}
                onPress={openWarCryLive}
                accessibilityRole="button"
                accessibilityLabel="Open rival War Cry lane"
              >
                <Text
                  style={[styles.warCryPaneBadgeText, styles.warCryPaneTextEnd]}
                >
                  RIVAL
                </Text>
                <Text
                  style={[styles.warCryPaneHandle, styles.warCryPaneTextEnd]}
                  numberOfLines={1}
                >
                  {warCryDualFeeds.rival.handle}
                </Text>
                <Text
                  style={[styles.warCryPaneSport, styles.warCryPaneTextEnd]}
                  numberOfLines={1}
                >
                  {String(warCryDualFeeds.rival.sport).toUpperCase()}
                  {warCryDualFeeds.rivalScore
                    ? ` · ${warCryDualFeeds.rivalScore}`
                    : ''}
                </Text>
              </TouchableOpacity>
            </View>
            {warCryDualFeeds.spectatorCount > 0 ? (
              <Text style={styles.warCrySpectatorMeta} pointerEvents="none">
                {warCryDualFeeds.spectatorCount} SPECTATING
              </Text>
            ) : null}
          </Pressable>
        </View>

        {/* ========== TIER 2 · Category pills ========== */}
        <ScrollView
          horizontal
          {...HSCROLL_HIDDEN_PROPS}
          contentContainerStyle={styles.filterPillRow}
          style={[
            styles.filterPillScroll,
            styles.shelfScroll,
            styles.shelfScrollNoBar,
            HSCROLL_HIDDEN_STYLE,
          ]}
        >
          {ARENA_DASHBOARD_CATEGORY_PILLS.map((label) => {
            const active = dashboardCategory === label;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.filterPill, active && styles.filterPillOn]}
                activeOpacity={0.85}
                onPress={() => onSelectDashboardCategory(label)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextOn,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ========== TIER 3 · Sparks & Josh ========== */}
        <ArenaShelfRow
          title="SPARKS & JOSH"
          subtitle="Short clips lighting up the Arena"
          items={sparkJoshShelf}
          emptyLabel="No Sparks or Josh clips yet"
          onPressItem={(item) => {
            const idx = sparkJoshShelf.findIndex(
              (r) => String(r?.id) === String(item?.id)
            );
            openReel(item, {
              muted: true,
              playlist: sparkJoshShelf,
              initialIndex: idx >= 0 ? idx : 0,
            });
          }}
        />

        {/* ========== TIER 4 · Battle Bawaal ========== */}
        <ArenaShelfRow
          title="BATTLE BAWAAL"
          subtitle="Recorded group battle feeds"
          items={battleBawaalShelf}
          showEmptyPlaceholders
          onPressItem={(item) => {
            const idx = battleBawaalShelf.findIndex(
              (r) => String(r?.id) === String(item?.id)
            );
            openReel(item, {
              muted: true,
              playlist: battleBawaalShelf,
              initialIndex: idx >= 0 ? idx : 0,
            });
          }}
        />

        {/* ========== TIER 5 · Face Off ========== */}
        <ArenaShelfRow
          title="FACE OFF"
          subtitle="Open challenges ready to answer"
          items={faceOffShelf}
          emptyLabel="No Face Off challenges yet"
          onPressItem={(item) => {
            const idx = faceOffShelf.findIndex(
              (r) => String(r?.id) === String(item?.id)
            );
            openReel(item, {
              muted: true,
              playlist: faceOffShelf,
              initialIndex: idx >= 0 ? idx : 0,
            });
          }}
        />

        {/* ========== Bottom · Ads slot ========== */}
        <View style={[styles.dashSection, styles.dashSectionLast]}>
          <View style={styles.adsSlot}>
            <Text style={styles.adsSlotLabel}>ADS</Text>
          </View>
        </View>
      </ScrollView>

      <LiveArenaModal
        visible={liveArenaOpen}
        onClose={() => setLiveArenaOpen(false)}
        onGoLive={(match) => openLiveMatchRoom(match, 'host')}
        onWatchMatch={(match) => openLiveMatchRoom(match, 'viewer')}
      />
      <NotificationsDrawer
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <ArenaReelViewer
        visible={!!activeReel}
        reel={activeReel || warmReel}
        playlist={reelPlaylist}
        initialIndex={reelInitialIndex}
        initialMuted={immersiveMuted}
        onClose={() => {
          setActiveReel(null);
          setReelPlaylist([]);
          setReelInitialIndex(0);
        }}
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
    backgroundColor: 'black',
  },
  feedList: {
    flex: 1,
    backgroundColor: 'black',
  },
  headerBar: {
    backgroundColor: '#0A0A0A',
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  scrollContentEmpty: {
    flexGrow: 1,
    paddingBottom: 110,
    paddingTop: 0,
  },
  dashboardScroll: {
    paddingBottom: 120,
    paddingTop: 8,
  },
  warCryLiveCard: {
    borderRadius: 16,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.5)',
    padding: 12,
    overflow: 'hidden',
  },
  warCryLiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warCryLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF5A00',
  },
  warCryLiveTitle: {
    color: '#FF5A00',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  warCryLiveAccent: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  warCrySpectatorMeta: {
    marginTop: 10,
    color: '#888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  warCryDualRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  warCryPane: {
    flex: 1,
    minHeight: 132,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  warCryPaneHost: {
    backgroundColor: '#090D16',
    borderColor: 'rgba(255,90,0,0.4)',
    marginRight: 4,
    alignItems: 'flex-start',
  },
  warCryPaneRival: {
    backgroundColor: '#121826',
    borderColor: 'rgba(255,90,0,0.28)',
    marginLeft: 4,
    alignItems: 'flex-end',
  },
  warCryPaneBadgeText: {
    color: '#FF5A00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  warCryPaneHandle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  warCryPaneSport: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  warCryPaneTextEnd: {
    textAlign: 'right',
    width: '100%',
  },
  warCryDualVs: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#FF5A00',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  warCryDualVsText: {
    color: '#FF5A00',
    fontSize: 11,
    fontWeight: '900',
  },
  filterPillScroll: {
    marginBottom: 18,
    flexGrow: 0,
  },
  filterPillRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#121212',
  },
  filterPillOn: {
    borderColor: '#FF5A00',
    backgroundColor: 'rgba(255,90,0,0.18)',
  },
  filterPillText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextOn: {
    color: '#FF5A00',
  },
  dashSection: {
    marginBottom: 22,
    paddingHorizontal: 16,
  },
  dashSectionLast: {
    marginBottom: 8,
  },
  dashSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  dashSectionSub: {
    color: '#7A7A7A',
    fontSize: 12,
    marginBottom: 10,
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 8,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  /** Outer shell clips any web scrollbar / arrow chrome under the card row */
  shelfScrollShell: {
    overflow: 'hidden',
    paddingBottom: 0,
    marginBottom: 0,
  },
  /** Tight height — no reserved scrollbar gutter under card rows */
  shelfScroll: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 0,
    marginBottom: 0,
    overflow: 'hidden',
  },
  shelfScrollNoBar: Platform.select({
    web: {
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: 0,
      marginBottom: 0,
    },
    default: {
      paddingBottom: 0,
      marginBottom: 0,
    },
  }),
  shelfCard: {
    width: SHELF_CARD_SIZE,
    height: SHELF_CARD_SIZE,
    marginBottom: 0,
    paddingBottom: 0,
  },
  shelfThumb: {
    width: SHELF_CARD_SIZE,
    height: SHELF_CARD_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  shelfThumbImage: {
    width: '100%',
    height: '100%',
  },
  shelfThumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14100E',
    padding: 10,
  },
  shelfThumbSport: {
    color: '#FF5A00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  shelfThumbPlay: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  shelfEmptyCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#0A0A0A',
  },
  shelfEmptyText: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
  },
  adsSlot: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adsSlotLabel: {
    color: '#444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  emptySupabase: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 100,
  },
  loadingEmpty: {
    flexGrow: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingEmptyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginTop: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 20,
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
  reelCard: {
    position: 'relative',
    width: '100%',
    flex: 1,
    height: '100%',
    minHeight: 450,
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: DARK_BG,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  /** Full video-card bounds for vault reaction particles */
  reelBurstOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  clipShell: {
    position: 'relative',
    width: '100%',
    height: '100%',
    flex: 1,
    minHeight: 450,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  feedVideoUnderlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  clipVideoFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  reelFullBleed: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  challengePage: {
    position: 'relative',
    width: '100%',
    minHeight: 450,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  /** Full challenge-page bounds for vault reaction particles */
  challengeBurstOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  /** LOCKED — top-right mute (arenaReelOverlay.REEL_MUTE) */
  challengeMuteBtn: {
    position: 'absolute',
    top: REEL_MUTE.top,
    right: REEL_MUTE.right,
    zIndex: REEL_MUTE.zIndex,
  },
  /** LOCKED — bottom-right ⋮ (arenaReelOverlay.REEL_MORE) */
  challengeMoreBtn: {
    position: 'absolute',
    bottom: REEL_MORE.bottom,
    right: REEL_MORE.right,
    zIndex: REEL_MORE.zIndex,
    width: REEL_MORE.width,
    height: REEL_MORE.height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  /** skullOrange Vault — pinned directly above ⋮ */
  challengeVaultBtn: {
    position: 'absolute',
    bottom: REEL_MORE.bottom + REEL_VAULT.aboveMore,
    right: REEL_VAULT.right,
    zIndex: REEL_VAULT.zIndex,
    width: REEL_VAULT.width,
    height: REEL_VAULT.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeQuickTray: {
    position: 'absolute',
    left: 0,
    right: 72,
    bottom: 16,
    zIndex: 26,
  },
  reelVaultImage: {
    width: REEL_VAULT.iconSize,
    height: REEL_VAULT.iconSize,
  },
  /** Full-bleed wrapper — mute / skull / ⋮ position absolutely inside */
  rightActionRail: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  reelMuteBtn: {
    position: 'absolute',
    top: REEL_MUTE.top,
    right: REEL_MUTE.right,
    zIndex: REEL_MUTE.zIndex,
  },
  reelMoreBtn: {
    position: 'absolute',
    right: REEL_MORE.right,
    zIndex: REEL_MORE.zIndex,
    width: REEL_MORE.width,
    height: REEL_MORE.height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  reelVaultBtn: {
    position: 'absolute',
    right: REEL_VAULT.right,
    zIndex: REEL_VAULT.zIndex,
    width: REEL_VAULT.width,
    height: REEL_VAULT.height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  reelMoreMenu: {
    top: undefined,
    right: REEL_MORE.right,
  },
  challengeMoreMenu: {
    bottom: REEL_MORE.bottom + REEL_MORE.height + 8,
    top: undefined,
    right: REEL_MORE.right,
  },
  reelMoreText: {
    color: BAWAAL_ORANGE,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  battleMuteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 14,
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
    flex: 1,
    height: '100%',
    backgroundColor: SURFACE,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 0,
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
    flex: 1,
    minHeight: 220,
    backgroundColor: DARK_BG,
  },
  splitRowWide: {
    flexDirection: 'row',
  },
  splitRowStack: {
    flexDirection: 'column',
  },
  splitPane: {
    flex: 1,
    minHeight: 140,
  },
  splitClip: {
    flex: 1,
    minHeight: 140,
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
    textAlign: 'center',
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
  splitDividerHorizontal: {
    width: '100%',
    height: 28,
  },
  splitVs: {
    color: CRIMSON,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.2,
    textShadowColor: 'rgba(255,0,51,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  voteBanterBar: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingVertical: 8,
  },
  voteTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    marginBottom: 8,
  },
  voteFillA: {
    backgroundColor: '#3B82F6',
  },
  voteFillB: {
    backgroundColor: '#FF5722',
  },
  voteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voteBtnA: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 8,
    alignItems: 'center',
  },
  voteBtnB: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF5722',
    paddingVertical: 8,
    alignItems: 'center',
  },
  voteBtnText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  banterBarBtn: {
    borderRadius: 10,
    backgroundColor: '#FF5722',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  banterBarBtnText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,69,0,0.45)',
    backgroundColor: 'rgba(255,69,0,0.08)',
  },
  processingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF4500',
  },
  clipPlaceholderSub: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  clipPlaceholderText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
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
