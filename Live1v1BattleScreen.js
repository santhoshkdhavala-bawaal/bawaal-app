/**
 * Live1v1BattleScreen — BAWAAL Multi-Challenger Arena Matrix
 *
 * View modes:
 *  - SPOTLIGHT_GRID (default): Host spotlight 40% + 3×3 challenger matrix 60%
 *  - DUAL_FOCUS: Host vs tapped challenger 50/50 vertical split
 *
 * WebRTC-ready: StreamSurface accepts `streamId` / `rtcUid` for Agora / 100ms wiring.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  Easing,
  Share,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import {
  castVote,
  incrementReps,
  sendHype,
  sendReaction,
  subscribeToBattle,
} from './src/services/battleSyncService';
import {
  battleChannelName,
  destroyAgoraEngine,
  getAgoraSdk,
  isAgoraConfigured,
  joinBattleChannel,
  leaveChannel,
  muteLocalAudioStream,
  muteLocalVideoStream,
  onRemoteUsersChanged,
  switchCamera,
} from './src/services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const VideoSourceType = AgoraSdk?.VideoSourceType || {};
const RenderModeType = AgoraSdk?.RenderModeType || {};

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 4;
const TILE_W = (SCREEN_W - GRID_GAP * 4) / 3;

const BG = '#000000';
const SURFACE = '#121212';
const BORDER = '#1F2937';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ORANGE = '#FF5722';
const CYAN = '#00E5FF';

const VIEW_SPOTLIGHT = 'SPOTLIGHT_GRID';
const VIEW_DUAL = 'DUAL_FOCUS';

const DEFAULT_HOST = Object.freeze({
  id: 'host-mumbai',
  handle: '@MUMBAI_STRIKER',
  flag: '🇮🇳',
  label: 'INDIA',
  country: 'IND',
  reps: 43,
  streamId: 'rtc-host-mumbai',
  rtcUid: 1001,
});

const DEFAULT_CHALLENGERS = Object.freeze([
  {
    id: 'c-nyc',
    handle: '@NYC_LIFT',
    flag: '🇺🇸',
    label: 'USA',
    country: 'USA',
    reps: 41,
    streamId: 'rtc-c-nyc',
    rtcUid: 2001,
    votes: 1060,
  },
  {
    id: 'c-karachi',
    handle: '@KARACHI_IRON',
    flag: '🇵🇰',
    label: 'PAKISTAN',
    country: 'PAK',
    reps: 38,
    streamId: 'rtc-c-karachi',
    rtcUid: 2002,
    votes: 980,
  },
  {
    id: 'c-london',
    handle: '@LDN_STRIKE',
    flag: '🇬🇧',
    label: 'UK',
    country: 'GBR',
    reps: 36,
    streamId: 'rtc-c-london',
    rtcUid: 2003,
    votes: 720,
  },
  {
    id: 'c-tokyo',
    handle: '@TOKYO_PR',
    flag: '🇯🇵',
    label: 'JAPAN',
    country: 'JPN',
    reps: 44,
    streamId: 'rtc-c-tokyo',
    rtcUid: 2004,
    votes: 890,
  },
  {
    id: 'c-dubai',
    handle: '@DXB_POWER',
    flag: '🇦🇪',
    label: 'UAE',
    country: 'UAE',
    reps: 33,
    streamId: 'rtc-c-dubai',
    rtcUid: 2005,
    votes: 610,
  },
  {
    id: 'c-berlin',
    handle: '@BERLIN_REP',
    flag: '🇩🇪',
    label: 'GERMANY',
    country: 'DEU',
    reps: 35,
    streamId: 'rtc-c-berlin',
    rtcUid: 2006,
    votes: 540,
  },
  {
    id: 'c-lagos',
    handle: '@LAGOS_HEAT',
    flag: '🇳🇬',
    label: 'NIGERIA',
    country: 'NGA',
    reps: 40,
    streamId: 'rtc-c-lagos',
    rtcUid: 2007,
    votes: 770,
  },
  {
    id: 'c-sao',
    handle: '@SAO_FORCA',
    flag: '🇧🇷',
    label: 'BRAZIL',
    country: 'BRA',
    reps: 37,
    streamId: 'rtc-c-sao',
    rtcUid: 2008,
    votes: 650,
  },
  {
    id: 'c-seoul',
    handle: '@SEOUL_MAX',
    flag: '🇰🇷',
    label: 'KOREA',
    country: 'KOR',
    reps: 39,
    streamId: 'rtc-c-seoul',
    rtcUid: 2009,
    votes: 700,
  },
]);

const DEFAULT_MATCH = Object.freeze({
  category: '[COMBAT] 3-ROUND SPAR · BATTLE BAWAAL',
  timerLabel: '01:32',
  spectatorsLabel: '4.2K LIVE',
  host: DEFAULT_HOST,
  challengers: DEFAULT_CHALLENGERS,
  initialHostVotes: 1240,
  initialHype: 88,
});

let reactionSeq = 0;

/**
 * Agora-backed video surface. Falls back to placeholder when SDK / stream unavailable.
 * Local broadcaster uses uid 0 + VideoSourceCamera; remotes use VideoSourceRemote.
 */
function StreamSurface({
  streamId,
  rtcUid,
  label,
  role = 'challenger',
  isLocal = false,
  hasRemote = false,
  cameraOff = false,
  style,
}) {
  const showVideo =
    Boolean(RtcSurfaceView) &&
    ((isLocal && !cameraOff) || (hasRemote && Number(rtcUid) > 0));

  return (
    <View
      style={[styles.streamSurface, role === 'host' && styles.streamSurfaceHost, style]}
      accessibilityLabel={`stream-${streamId || rtcUid || label}`}
    >
      {showVideo ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{
            uid: isLocal ? 0 : Number(rtcUid) || 0,
            sourceType: isLocal
              ? VideoSourceType.VideoSourceCamera
              : VideoSourceType.VideoSourceRemote,
            renderMode: RenderModeType.RenderModeHidden ?? 1,
          }}
          zOrderMediaOverlay={!isLocal}
        />
      ) : (
        <>
          <Text style={styles.streamHint}>
            {cameraOff && isLocal
              ? 'CAMERA OFF'
              : isAgoraConfigured()
                ? 'WAITING FOR STREAM'
                : 'RTC READY'}
          </Text>
          <Text style={styles.streamIdHint} numberOfLines={1}>
            {streamId || `uid:${rtcUid || '—'}`}
          </Text>
        </>
      )}
    </View>
  );
}

function FloatingReactionLayer({ reactions }) {
  return (
    <View style={styles.floatingLayer} pointerEvents="none">
      {reactions.map((rx) => (
        <Animated.View
          key={rx.id}
          style={[
            styles.floatingItem,
            rx.text ? styles.floatingPill : null,
            {
              left: rx.left,
              opacity: rx.opacity,
              transform: [{ translateY: rx.translateY }],
            },
          ]}
        >
          <Text style={rx.text ? styles.floatingPillEmoji : styles.floatingEmoji}>
            {rx.emoji}
          </Text>
          {!!rx.text && <Text style={styles.floatingPillText}>{rx.text}</Text>}
        </Animated.View>
      ))}
    </View>
  );
}

function HostSpotlight({ host, live, onRepPress, isLocal, hasRemote, cameraOff }) {
  return (
    <View style={styles.hostSpotlight}>
      <StreamSurface
        streamId={host.streamId}
        rtcUid={host.rtcUid}
        label={host.handle}
        role="host"
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlayRow}>
        <View style={styles.handleBadge}>
          <Text style={styles.flagText}>{host.flag}</Text>
          <Text style={styles.handleText} numberOfLines={1}>
            {host.handle}
          </Text>
        </View>
        <View style={styles.hostMetaCol}>
          {live ? (
            <View style={styles.paneLivePill}>
              <View style={styles.liveDot} />
              <Text style={styles.paneLiveText}>LIVE</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.hostRepsBadge}
            onPress={onRepPress}
            activeOpacity={0.85}
            hitSlop={8}
          >
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsCountHost}>{host.reps}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ChallengerTile({ athlete, onPress, isLocal, hasRemote, cameraOff }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.88}
      onPress={() => onPress?.(athlete)}
    >
      <StreamSurface
        streamId={athlete.streamId}
        rtcUid={athlete.rtcUid}
        label={athlete.handle}
        role="challenger"
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.tileTop}>
        <Text style={styles.tileFlag}>{athlete.flag}</Text>
        <Text style={styles.tileHandle} numberOfLines={1}>
          {athlete.handle}
        </Text>
      </View>
      <View style={styles.tileReps}>
        <Text style={styles.tileRepsText}>{athlete.reps}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DualFocusPane({ athlete, variant, onRepPress, isLocal, hasRemote, cameraOff }) {
  const isHost = variant === 'host';
  return (
    <View style={styles.dualPane}>
      <StreamSurface
        streamId={athlete.streamId}
        rtcUid={athlete.rtcUid}
        label={athlete.handle}
        role={isHost ? 'host' : 'challenger'}
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlayRow}>
        <View style={styles.handleBadge}>
          <Text style={styles.flagText}>{athlete.flag}</Text>
          <Text style={styles.handleText} numberOfLines={1}>
            {athlete.handle}
          </Text>
        </View>
        <TouchableOpacity
          style={isHost ? styles.hostRepsBadge : styles.challengerRepsBadge}
          onPress={onRepPress}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <Text style={styles.repsLabel}>REPS</Text>
          <Text style={isHost ? styles.repsCountHost : styles.repsCountChallenger}>
            {athlete.reps}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Live1v1BattleScreen({
  navigation,
  route,
  onVote,
  onHype,
  onBanter,
  onShare,
}) {
  const insets = useSafeAreaInsets();
  const senderIdRef = useRef('spectator-local');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const mediaReady =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  const match = useMemo(() => {
    const incoming = route?.params?.match || {};
    const host = { ...DEFAULT_HOST, ...(incoming.host || {}) };
    let challengers = incoming.challengers;
    if (!challengers?.length && incoming.challenger) {
      challengers = [{ ...DEFAULT_CHALLENGERS[0], ...incoming.challenger }];
    }
    return {
      ...DEFAULT_MATCH,
      ...incoming,
      host,
      challengers: challengers?.length ? challengers : [...DEFAULT_CHALLENGERS],
    };
  }, [route?.params?.match]);

  const battleId =
    route?.params?.battleId || match.id || match.battleId || null;
  const arenaRole = route?.params?.role || 'spectator';
  const isBroadcaster = arenaRole === 'host' || arenaRole === 'challenger';

  const [viewMode, setViewMode] = useState(VIEW_SPOTLIGHT);
  const [hostAthlete, setHostAthlete] = useState(match.host);
  const [challengers, setChallengers] = useState(match.challengers);
  const [focusedRival, setFocusedRival] = useState(match.challengers[0]);
  const [hostVotes, setHostVotes] = useState(match.initialHostVotes ?? 1240);
  const [rivalVotes, setRivalVotes] = useState(
    () => focusedRival?.votes ?? match.challengers[0]?.votes ?? 1060
  );
  const [hypeCount, setHypeCount] = useState(match.initialHype ?? 88);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterDraft, setBanterDraft] = useState('');
  const [remoteUids, setRemoteUids] = useState([]);
  const [gearOpen, setGearOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [rtcJoined, setRtcJoined] = useState(false);

  const myRtcUid = useMemo(() => {
    if (arenaRole === 'host') return Number(match.host?.rtcUid) || 1001;
    if (arenaRole === 'challenger') {
      return (
        Number(route?.params?.rtcUid) ||
        Number(match.challengers?.[0]?.rtcUid) ||
        2001
      );
    }
    return 0;
  }, [arenaRole, match.challengers, match.host?.rtcUid, route?.params?.rtcUid]);

  const isLocalHost = isBroadcaster && arenaRole === 'host';
  const isLocalChallengerUid = useCallback(
    (uid) => isBroadcaster && arenaRole === 'challenger' && Number(uid) === myRtcUid,
    [arenaRole, isBroadcaster, myRtcUid]
  );

  const hasRemoteUid = useCallback(
    (uid) => remoteUids.includes(Number(uid)),
    [remoteUids]
  );

  const totalVotes = Math.max(1, hostVotes + rivalVotes);
  const hostPercent = Math.round((hostVotes / totalVotes) * 100);
  const rivalPercent = 100 - hostPercent;

  const trayBottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 4;

  const spawnFloatingReaction = useCallback((emoji, options = {}) => {
    const id = `rx-${Date.now()}-${reactionSeq++}`;
    const left = options.left ?? Math.max(12, Math.random() * (SCREEN_W - 56));
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(0);

    setFloatingReactions((prev) => [
      ...prev.slice(-18),
      { id, emoji, left, text: options.text || null, opacity, translateY },
    ]);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: -150,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  const applyRemoteEvent = useCallback(
    (row) => {
      if (!row || row.sender_id === senderIdRef.current) return;
      const type = row.event_type;
      if (type === 'HYPE') {
        setHypeCount((n) => n + 1);
        spawnFloatingReaction('🔥', {
          left: 24 + Math.random() * (SCREEN_W - 72),
        });
        return;
      }
      if (type === 'VOTE_HOST') {
        setHostVotes((n) => n + 1);
        spawnFloatingReaction('🥊', {
          left: SCREEN_W * 0.18,
          text: `VOTED ${hostAthlete.label}`,
        });
        return;
      }
      if (type === 'VOTE_RIVAL') {
        setRivalVotes((n) => n + 1);
        setChallengers((prev) =>
          prev.map((c) =>
            c.id === row.target_challenger_id || c.userId === row.target_challenger_id
              ? { ...c, votes: (c.votes || 0) + 1 }
              : c
          )
        );
        spawnFloatingReaction('🥊', {
          left: SCREEN_W * 0.55,
          text: 'VOTED RIVAL',
        });
      }
    },
    [hostAthlete.label, spawnFloatingReaction]
  );

  const focusedRivalRef = useRef(focusedRival);

  useEffect(() => {
    senderIdRef.current = `spectator-${Date.now().toString(36)}`;
  }, []);

  useEffect(() => {
    focusedRivalRef.current = focusedRival;
  }, [focusedRival]);

  // Explicit camera + mic prompts when entering the Battle Arena.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain !== false) {
        await requestCameraPermission();
      }
      if (cancelled) return;
      if (micPermission && !micPermission.granted && micPermission.canAskAgain !== false) {
        await requestMicPermission();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  useEffect(() => {
    if (!isAgoraConfigured()) return undefined;
    // Broadcasters must have cam/mic before publishing; spectators can join as audience earlier.
    if (isBroadcaster && !mediaReady) return undefined;

    let cancelled = false;
    const channel = battleChannelName(battleId || 'featured-live');
    const unsubRemote = onRemoteUsersChanged((uids) => {
      if (!cancelled) setRemoteUids(uids);
    });

    (async () => {
      const join = await joinBattleChannel(channel, myRtcUid, isBroadcaster);
      if (!cancelled) setRtcJoined(Boolean(join?.ok));
    })();

    return () => {
      cancelled = true;
      unsubRemote?.();
      setRtcJoined(false);
      void leaveChannel();
    };
  }, [battleId, isBroadcaster, mediaReady, myRtcUid]);

  useEffect(
    () => () => {
      void destroyAgoraEngine();
    },
    []
  );

  const handleFlipCamera = useCallback(() => {
    switchCamera();
  }, []);

  const handleToggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      muteLocalAudioStream(next);
      return next;
    });
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCameraOff((prev) => {
      const next = !prev;
      muteLocalVideoStream(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!battleId) return undefined;
    const unsubscribe = subscribeToBattle(battleId, (payload) => {
      if (payload.table === 'battle_events' && payload.eventType === 'INSERT') {
        applyRemoteEvent(payload.new);
        return;
      }
      if (payload.table === 'battles' && payload.new) {
        const next = payload.new;
        if (typeof next.host_reps === 'number') {
          setHostAthlete((h) => ({ ...h, reps: next.host_reps }));
        }
        return;
      }
      if (payload.table === 'battle_challengers' && payload.new) {
        const row = payload.new;
        setChallengers((prev) =>
          prev.map((c) =>
            c.id === row.user_id || c.userId === row.user_id
              ? { ...c, reps: row.reps ?? c.reps, votes: row.votes ?? c.votes }
              : c
          )
        );
        setFocusedRival((fr) =>
          fr && (fr.id === row.user_id || fr.userId === row.user_id)
            ? { ...fr, reps: row.reps ?? fr.reps, votes: row.votes ?? fr.votes }
            : fr
        );
        const fr = focusedRivalRef.current;
        if (
          typeof row.votes === 'number' &&
          fr &&
          (fr.id === row.user_id || fr.userId === row.user_id)
        ) {
          setRivalVotes(row.votes);
        }
      }
    });
    return unsubscribe;
  }, [applyRemoteEvent, battleId]);

  const focusChallenger = useCallback((athlete) => {
    setFocusedRival(athlete);
    setRivalVotes(athlete.votes ?? 500);
    setViewMode(VIEW_DUAL);
  }, []);

  const showAllChallengers = useCallback(() => {
    setViewMode(VIEW_SPOTLIGHT);
  }, []);

  const handleHype = useCallback(() => {
    setHypeCount((n) => n + 1);
    onHype?.();
    for (let i = 0; i < 3; i += 1) {
      setTimeout(() => {
        spawnFloatingReaction('🔥', {
          left: 24 + Math.random() * (SCREEN_W - 72),
        });
      }, i * 80);
    }
    if (battleId) {
      void sendHype(battleId, senderIdRef.current);
    }
  }, [battleId, onHype, spawnFloatingReaction]);

  const submitBanter = useCallback(() => {
    const text = banterDraft.trim() || "Let's go Mumbai! 🔥";
    setBanterOpen(false);
    setBanterDraft('');
    onBanter?.(text);
    spawnFloatingReaction('💬', {
      left: 20 + Math.random() * Math.max(40, SCREEN_W - 220),
      text: `@You: ${text}`,
    });
    if (battleId) {
      void sendReaction(battleId, senderIdRef.current, 'BANTER', null);
    }
  }, [banterDraft, battleId, onBanter, spawnFloatingReaction]);

  const handleVoteHost = useCallback(() => {
    setHostVotes((n) => n + 1);
    onVote?.('host', focusedRival?.id);
    spawnFloatingReaction('🥊', {
      left: SCREEN_W * 0.18,
      text: `VOTED ${hostAthlete.label}`,
    });
    if (battleId) {
      void castVote(battleId, null, senderIdRef.current);
    }
  }, [battleId, focusedRival?.id, hostAthlete.label, onVote, spawnFloatingReaction]);

  const handleVoteRival = useCallback(() => {
    const rivalId = focusedRival?.userId || focusedRival?.id || null;
    setRivalVotes((n) => n + 1);
    onVote?.('challenger', rivalId);
    spawnFloatingReaction('🥊', {
      left: SCREEN_W * 0.55,
      text: `VOTED ${focusedRival?.label || 'RIVAL'}`,
    });
    if (battleId) {
      void castVote(battleId, rivalId, senderIdRef.current);
    }
  }, [battleId, focusedRival, onVote, spawnFloatingReaction]);

  const handleHostRep = useCallback(() => {
    const current = hostAthlete.reps ?? 0;
    setHostAthlete((h) => ({ ...h, reps: current + 1 }));
    if (battleId) {
      void incrementReps(battleId, hostAthlete.id || hostAthlete.userId || 'host', current);
    }
  }, [battleId, hostAthlete.id, hostAthlete.reps, hostAthlete.userId]);

  const handleRivalRep = useCallback(() => {
    if (!focusedRival) return;
    const current = focusedRival.reps ?? 0;
    const next = { ...focusedRival, reps: current + 1 };
    setFocusedRival(next);
    setChallengers((prev) =>
      prev.map((c) => (c.id === focusedRival.id ? next : c))
    );
    if (battleId) {
      void incrementReps(
        battleId,
        focusedRival.userId || focusedRival.id,
        current
      );
    }
  }, [battleId, focusedRival]);

  const handleShare = useCallback(async () => {
    onShare?.();
    try {
      await Share.share({
        message: `Watch BATTLE BAWAAL live — ${hostAthlete.handle} arena on BAWAAL!`,
        title: 'BAWAAL Live Arena',
      });
    } catch (_) {
      /* dismissed */
    }
  }, [hostAthlete.handle, onShare]);

  const gridAthletes = challengers.slice(0, 9);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else navigation?.navigate?.('Main', { tab: 'Battles' });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.brandTitle}>BAWAAL</Text>
          <Text style={styles.brandSubtitle}>
            {viewMode === VIEW_SPOTLIGHT ? 'BATTLE BAWAAL ARENA' : 'DUAL FOCUS 1v1'}
          </Text>
        </TouchableOpacity>

        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{match.timerLabel}</Text>
          <Text style={styles.categoryText} numberOfLines={1}>
            {match.category}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={() => setGearOpen((v) => !v)}
            activeOpacity={0.85}
            hitSlop={8}
          >
            <Text style={styles.gearBtnText}>⚙️</Text>
          </TouchableOpacity>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {rtcJoined ? 'LIVE RTC' : match.spectatorsLabel}
            </Text>
          </View>
        </View>
      </View>

      {gearOpen ? (
        <View style={styles.gearMenu}>
          <Text style={styles.gearMenuTitle}>CAMERA CONTROLS</Text>
          <View style={styles.gearMenuRow}>
            <TouchableOpacity
              style={[styles.gearControl, !isBroadcaster && styles.gearControlDisabled]}
              onPress={isBroadcaster ? handleFlipCamera : undefined}
              activeOpacity={0.85}
              disabled={!isBroadcaster}
            >
              <Text style={styles.gearControlIcon}>🔄</Text>
              <Text style={styles.gearControlLabel}>Flip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.gearControl,
                micMuted && styles.gearControlActive,
                !isBroadcaster && styles.gearControlDisabled,
              ]}
              onPress={isBroadcaster ? handleToggleMic : undefined}
              activeOpacity={0.85}
              disabled={!isBroadcaster}
            >
              <Text style={styles.gearControlIcon}>{micMuted ? '🔇' : '🎙️'}</Text>
              <Text style={styles.gearControlLabel}>{micMuted ? 'Muted' : 'Mic'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.gearControl,
                cameraOff && styles.gearControlActive,
                !isBroadcaster && styles.gearControlDisabled,
              ]}
              onPress={isBroadcaster ? handleToggleCamera : undefined}
              activeOpacity={0.85}
              disabled={!isBroadcaster}
            >
              <Text style={styles.gearControlIcon}>{cameraOff ? '📷' : '📹'}</Text>
              <Text style={styles.gearControlLabel}>{cameraOff ? 'Cam Off' : 'Cam'}</Text>
            </TouchableOpacity>
          </View>
          {!isBroadcaster ? (
            <Text style={styles.gearSpectatorHint}>
              Spectator mode — watching only (low bandwidth)
            </Text>
          ) : null}
        </View>
      ) : null}

      {viewMode === VIEW_DUAL ? (
        <TouchableOpacity
          style={styles.showAllBtn}
          onPress={showAllChallengers}
          activeOpacity={0.85}
        >
          <Text style={styles.showAllBtnText}>▦ SHOW ALL CHALLENGERS</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.stageContainer}>
        {viewMode === VIEW_SPOTLIGHT ? (
          <>
            <View style={styles.spotlightHostWrap}>
              <HostSpotlight
                host={hostAthlete}
                live
                onRepPress={handleHostRep}
                isLocal={isLocalHost}
                hasRemote={hasRemoteUid(hostAthlete.rtcUid)}
                cameraOff={cameraOff && isLocalHost}
              />
            </View>
            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.grid}>
                {gridAthletes.map((athlete) => {
                  const localTile = isLocalChallengerUid(athlete.rtcUid);
                  return (
                    <ChallengerTile
                      key={athlete.id}
                      athlete={athlete}
                      onPress={focusChallenger}
                      isLocal={localTile}
                      hasRemote={hasRemoteUid(athlete.rtcUid)}
                      cameraOff={cameraOff && localTile}
                    />
                  );
                })}
              </View>
            </ScrollView>
          </>
        ) : (
          <>
            <DualFocusPane
              athlete={hostAthlete}
              variant="host"
              onRepPress={handleHostRep}
              isLocal={isLocalHost}
              hasRemote={hasRemoteUid(hostAthlete.rtcUid)}
              cameraOff={cameraOff && isLocalHost}
            />
            <View style={styles.vsCenterSeam} pointerEvents="none">
              <View style={styles.vsLine} />
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.vsLine} />
            </View>
            <DualFocusPane
              athlete={focusedRival || challengers[0]}
              variant="rival"
              onRepPress={handleRivalRep}
              isLocal={isLocalChallengerUid(
                (focusedRival || challengers[0])?.rtcUid
              )}
              hasRemote={hasRemoteUid((focusedRival || challengers[0])?.rtcUid)}
              cameraOff={
                cameraOff &&
                isLocalChallengerUid((focusedRival || challengers[0])?.rtcUid)
              }
            />
          </>
        )}

        <FloatingReactionLayer reactions={floatingReactions} />
      </View>

      <View style={styles.pollSection}>
        <View style={styles.pollLabelRow}>
          <Text style={styles.pollHostText}>
            {hostAthlete.label} {hostPercent}%
          </Text>
          <Text style={styles.thunderIcon}>⚡</Text>
          <Text style={styles.pollChallengerText}>
            {rivalPercent}% {focusedRival?.label || 'RIVAL'}
          </Text>
        </View>
        <View style={styles.pollBarTrack}>
          <View style={[styles.pollBarHost, { width: `${hostPercent}%` }]} />
          <View style={[styles.pollBarChallenger, { width: `${rivalPercent}%` }]} />
        </View>
        <Text style={styles.tapToVoteText}>
          {viewMode === VIEW_SPOTLIGHT
            ? 'TAP A TILE TO FOCUS RIVALRY · THEN VOTE'
            : 'TAP HOST / RIVAL TO CAST YOUR VOTE'}
        </Text>
      </View>

      <View style={[styles.actionTray, { paddingBottom: trayBottomPad }]}>
        <TouchableOpacity style={styles.actionButton} onPress={handleHype} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>🔥</Text>
          <Text style={styles.actionLabel}>HYPE ({hypeCount})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setBanterOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>BANTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleVoteHost}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>🥊</Text>
          <Text style={[styles.actionLabel, styles.actionLabelHost]}>HOST</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleVoteRival}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>🥊</Text>
          <Text style={[styles.actionLabel, styles.actionLabelRival]}>RIVAL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>🚀</Text>
          <Text style={styles.actionLabel}>SHARE</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={banterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBanterOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.banterOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.banterBackdrop} onPress={() => setBanterOpen(false)} />
          <View style={[styles.banterSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.banterHandle} />
            <Text style={styles.banterTitle}>DROP BANTER</Text>
            <TextInput
              style={styles.banterInput}
              placeholder="Let's go Mumbai! 🔥"
              placeholderTextColor="#666666"
              value={banterDraft}
              onChangeText={setBanterDraft}
              autoFocus
              onSubmitEditing={submitBanter}
              returnKeyType="send"
            />
            <View style={styles.banterActions}>
              <TouchableOpacity
                style={styles.banterQuick}
                onPress={() => setBanterDraft("Let's go Mumbai! 🔥")}
              >
                <Text style={styles.banterQuickText}>{"Quick: Let's go Mumbai! 🔥"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.banterSend} onPress={submitBanter}>
                <Text style={styles.banterSendText}>SEND</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  brandTitle: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 160,
  },
  timerText: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 18,
  },
  categoryText: {
    color: '#CCCCCC',
    fontSize: 8,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF0000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF0000',
    marginRight: 6,
  },
  liveText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtnText: {
    fontSize: 14,
  },
  gearMenu: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gearMenuTitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  gearMenuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gearControl: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
  },
  gearControlActive: {
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,87,34,0.12)',
  },
  gearControlDisabled: {
    opacity: 0.4,
  },
  gearControlIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  gearControlLabel: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
  },
  gearSpectatorHint: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  showAllBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  showAllBtnText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  stageContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  spotlightHostWrap: {
    flex: 0.4,
    width: '100%',
  },
  hostSpotlight: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#080808',
    overflow: 'hidden',
  },
  gridScroll: {
    flex: 0.6,
    width: '100%',
    backgroundColor: BG,
  },
  gridContent: {
    padding: GRID_GAP,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W,
    height: TILE_W * 1.15,
    backgroundColor: SURFACE,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    position: 'relative',
  },
  tileTop: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  tileFlag: { fontSize: 11 },
  tileHandle: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '800',
    flexShrink: 1,
  },
  tileReps: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: CYAN,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tileRepsText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  dualPane: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#080808',
  },
  streamSurface: {
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamSurfaceHost: {
    backgroundColor: '#0D0D0D',
  },
  streamHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  streamIdHint: {
    color: '#333333',
    fontSize: 9,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  overlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 5,
  },
  handleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '58%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  flagText: {
    fontSize: 14,
    marginRight: 6,
  },
  handleText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 13,
    flexShrink: 1,
  },
  hostMetaCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  paneLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.2)',
    borderWidth: 1,
    borderColor: '#FF0000',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paneLiveText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
  },
  hostRepsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  challengerRepsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1.5,
    borderColor: CYAN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  repsLabel: {
    color: MUTED,
    fontSize: 8,
    fontWeight: '800',
  },
  repsCountHost: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '900',
  },
  repsCountChallenger: {
    color: CYAN,
    fontSize: 22,
    fontWeight: '900',
  },
  vsCenterSeam: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 48,
    marginTop: -24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  vsLine: {
    flex: 1,
    height: 2,
    backgroundColor: ORANGE,
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginHorizontal: 10,
    backgroundColor: BG,
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  vsText: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 14,
  },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  floatingItem: {
    position: 'absolute',
    bottom: 40,
  },
  floatingEmoji: {
    fontSize: 34,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,18,18,0.88)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
  },
  floatingPillEmoji: {
    fontSize: 16,
  },
  floatingPillText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  pollSection: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: SURFACE,
  },
  pollLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  pollHostText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
  },
  thunderIcon: {
    color: ORANGE,
    marginHorizontal: 8,
    fontSize: 12,
  },
  pollChallengerText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
  },
  pollBarTrack: {
    height: 12,
    width: '100%',
    backgroundColor: SURFACE,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pollBarHost: {
    height: '100%',
    backgroundColor: ORANGE,
  },
  pollBarChallenger: {
    height: '100%',
    backgroundColor: CYAN,
  },
  tapToVoteText: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  actionTray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: BG,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SURFACE,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  actionLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
  },
  actionLabelHost: { color: ORANGE },
  actionLabelRival: { color: CYAN },
  banterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  banterBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  banterSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  banterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555555',
    marginBottom: 12,
  },
  banterTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  banterInput: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  banterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  banterQuick: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  banterQuickText: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '700',
  },
  banterSend: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  banterSendText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
});
