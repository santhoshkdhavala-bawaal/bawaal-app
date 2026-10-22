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
  CameraView,
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
import {
  ACTIVE_USER,
  toChallengerAthlete,
} from './src/services/activeUserProfile';
import AthleteProfileSheet from './AthleteProfileSheet';
import ChallengerRosterSheet from './ChallengerRosterSheet';

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

function AthleteAvatarPlaceholder({ handle, flag, cameraOff }) {
  const initial = String(handle || '?')
    .replace(/^@/, '')
    .charAt(0)
    .toUpperCase();
  return (
    <View style={styles.avatarPlaceholder}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      <Text style={styles.avatarFlag}>{flag || '🌐'}</Text>
      <Text style={styles.streamHint}>
        {cameraOff ? 'CAMERA OFF' : 'STANDBY'}
      </Text>
    </View>
  );
}

/**
 * Local tile → expo-camera CameraView.
 * Remote tile → Agora RtcSurfaceView when a stream is connected.
 */
function StreamSurface({
  streamId,
  rtcUid,
  label,
  flag,
  role = 'challenger',
  isLocal = false,
  hasRemote = false,
  cameraOff = false,
  cameraFacing = 'front',
  micMuted = false,
  style,
}) {
  const showLocalCamera = isLocal && !cameraOff;
  const showRemoteRtc =
    !isLocal && Boolean(RtcSurfaceView) && hasRemote && Number(rtcUid) > 0;

  return (
    <View
      style={[styles.streamSurface, role === 'host' && styles.streamSurfaceHost, style]}
      accessibilityLabel={`stream-${streamId || rtcUid || label}`}
    >
      {showLocalCamera ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing}
          mute={micMuted}
          mirror={cameraFacing === 'front'}
        />
      ) : showRemoteRtc ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{
            uid: Number(rtcUid) || 0,
            sourceType: VideoSourceType.VideoSourceRemote,
            renderMode: RenderModeType.RenderModeHidden ?? 1,
          }}
          zOrderMediaOverlay
        />
      ) : isLocal || cameraOff ? (
        <AthleteAvatarPlaceholder
          handle={label}
          flag={flag}
          cameraOff={cameraOff && isLocal}
        />
      ) : (
        <Text style={styles.streamHint}>STANDBY</Text>
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
          <Animated.Text
            style={[
              rx.text ? styles.floatingPillEmoji : styles.floatingEmoji,
              rx.scale ? { transform: [{ scale: rx.scale }] } : null,
            ]}
          >
            {rx.emoji}
          </Animated.Text>
          {!!rx.text && <Text style={styles.floatingPillText}>{rx.text}</Text>}
        </Animated.View>
      ))}
    </View>
  );
}

/** Participant-only HUD above the vote bar — never shown to spectators. */
function ParticipantHudToolbar({
  visible,
  micMuted,
  cameraOff,
  onFlip,
  onToggleMic,
  onToggleCamera,
}) {
  if (!visible) return null;
  return (
    <View style={styles.participantHud}>
      <TouchableOpacity
        style={styles.participantHudBtn}
        onPress={onFlip}
        activeOpacity={0.85}
      >
        <Text style={styles.participantHudIcon}>🔄</Text>
        <Text style={styles.participantHudLabel}>Flip</Text>
      </TouchableOpacity>
      <View style={styles.participantHudDivider} />
      <TouchableOpacity
        style={[styles.participantHudBtn, micMuted && styles.participantHudBtnActive]}
        onPress={onToggleMic}
        activeOpacity={0.85}
      >
        <Text style={styles.participantHudIcon}>{micMuted ? '🔇' : '🎙️'}</Text>
        <Text style={styles.participantHudLabel}>{micMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>
      <View style={styles.participantHudDivider} />
      <TouchableOpacity
        style={[styles.participantHudBtn, cameraOff && styles.participantHudBtnActive]}
        onPress={onToggleCamera}
        activeOpacity={0.85}
      >
        <Text style={styles.participantHudIcon}>{cameraOff ? '📷' : '📹'}</Text>
        <Text style={styles.participantHudLabel}>{cameraOff ? 'Cam On' : 'Cam Off'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function HostSpotlight({
  host,
  live,
  onRepPress,
  isLocal,
  hasRemote,
  cameraOff,
  cameraFacing,
  micMuted,
}) {
  return (
    <View style={styles.hostSpotlight}>
      <StreamSurface
        streamId={host.streamId}
        rtcUid={host.rtcUid}
        label={host.handle}
        flag={host.flag}
        role="host"
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        cameraFacing={cameraFacing}
        micMuted={micMuted}
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

function ChallengerTile({
  athlete,
  onPress,
  isLocal,
  hasRemote,
  cameraOff,
  cameraFacing,
  micMuted,
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, isLocal && styles.tileLocal]}
      activeOpacity={0.88}
      onPress={() => onPress?.(athlete)}
    >
      <StreamSurface
        streamId={athlete.streamId}
        rtcUid={athlete.rtcUid}
        label={athlete.handle}
        flag={athlete.flag}
        role="challenger"
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        cameraFacing={cameraFacing}
        micMuted={micMuted}
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
      {isLocal ? (
        <View style={styles.tileYouPill}>
          <Text style={styles.tileYouText}>YOU</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function DualFocusPane({
  athlete,
  variant,
  onRepPress,
  isLocal,
  hasRemote,
  cameraOff,
  cameraFacing,
  micMuted,
}) {
  const isHost = variant === 'host';
  return (
    <View style={styles.dualPane}>
      <StreamSurface
        streamId={athlete.streamId}
        rtcUid={athlete.rtcUid}
        label={athlete.handle}
        flag={athlete.flag}
        role={isHost ? 'host' : 'challenger'}
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        cameraFacing={cameraFacing}
        micMuted={micMuted}
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

  const arenaRole = route?.params?.role || 'spectator';
  const isBroadcaster = arenaRole === 'host' || arenaRole === 'challenger';

  const match = useMemo(() => {
    const incoming = route?.params?.match || {};
    const host = { ...DEFAULT_HOST, ...(incoming.host || {}) };
    let challengers = incoming.challengers;
    if (!challengers?.length && incoming.challenger) {
      challengers = [{ ...DEFAULT_CHALLENGERS[0], ...incoming.challenger }];
    }
    if (!challengers?.length) {
      challengers = [...DEFAULT_CHALLENGERS];
    } else {
      challengers = [...challengers];
    }

    // ACCEPT CHALLENGE → bind logged-in profile into slot 0 (replaces mock @NYC_LIFT).
    if (arenaRole === 'challenger') {
      const participant =
        route?.params?.participant ||
        toChallengerAthlete(route?.params?.activeUser || {});
      const pool = [
        ...challengers,
        ...DEFAULT_CHALLENGERS.filter(
          (d) => !challengers.some((c) => c.id === d.id || c.handle === d.handle)
        ),
      ];
      const withoutSelf = pool.filter(
        (c) =>
          c.id !== participant.id &&
          c.userId !== participant.userId &&
          c.handle !== participant.handle &&
          c.handle !== '@NYC_LIFT'
      );
      challengers = [participant, ...withoutSelf].slice(0, 9);
    }

    return {
      ...DEFAULT_MATCH,
      ...incoming,
      host,
      challengers,
    };
  }, [arenaRole, route?.params?.activeUser, route?.params?.match, route?.params?.participant]);

  const battleId =
    route?.params?.battleId || match.id || match.battleId || null;

  const selfAthlete = useMemo(() => {
    if (arenaRole === 'host') return match.host;
    if (arenaRole === 'challenger') {
      return (
        match.challengers.find((c) => c.isSelf || c.id === ACTIVE_USER.id) ||
        match.challengers[0]
      );
    }
    return null;
  }, [arenaRole, match.challengers, match.host]);

  const [viewMode, setViewMode] = useState(
    arenaRole === 'challenger' ? VIEW_DUAL : VIEW_SPOTLIGHT
  );
  const [hostAthlete, setHostAthlete] = useState(match.host);
  const [challengers, setChallengers] = useState(match.challengers);
  const [focusedRival, setFocusedRival] = useState(
    () => (arenaRole === 'challenger' ? match.challengers[0] : match.challengers[0])
  );
  const [hostVotes, setHostVotes] = useState(match.initialHostVotes ?? 1240);
  const [rivalVotes, setRivalVotes] = useState(
    () => match.challengers[0]?.votes ?? 1060
  );
  const [hypeCount, setHypeCount] = useState(match.initialHype ?? 88);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterDraft, setBanterDraft] = useState('');
  const [remoteUids, setRemoteUids] = useState([]);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('front');
  const [rtcJoined, setRtcJoined] = useState(false);
  const [profileAthlete, setProfileAthlete] = useState(null);
  const [profileRole, setProfileRole] = useState('ATHLETE');
  const [rosterOpen, setRosterOpen] = useState(false);

  const myRtcUid = useMemo(() => {
    if (arenaRole === 'host') return Number(match.host?.rtcUid) || 1001;
    if (arenaRole === 'challenger') {
      return (
        Number(route?.params?.rtcUid) ||
        Number(selfAthlete?.rtcUid) ||
        Number(ACTIVE_USER.rtcUid) ||
        2101
      );
    }
    return 0;
  }, [arenaRole, match.host?.rtcUid, route?.params?.rtcUid, selfAthlete?.rtcUid]);

  const isLocalHost = isBroadcaster && arenaRole === 'host';
  const isLocalAthlete = useCallback(
    (athlete) => {
      if (!isBroadcaster || !athlete) return false;
      if (arenaRole === 'host') {
        return athlete.id === hostAthlete.id || athlete.rtcUid === hostAthlete.rtcUid;
      }
      return (
        athlete.isSelf === true ||
        athlete.id === ACTIVE_USER.id ||
        athlete.userId === ACTIVE_USER.userId ||
        Number(athlete.rtcUid) === myRtcUid
      );
    },
    [arenaRole, hostAthlete.id, hostAthlete.rtcUid, isBroadcaster, myRtcUid]
  );

  const hasRemoteUid = useCallback(
    (uid) => remoteUids.includes(Number(uid)),
    [remoteUids]
  );

  const totalVotes = Math.max(1, hostVotes + rivalVotes);
  const hostPercent = Math.round((hostVotes / totalVotes) * 100);
  const rivalPercent = 100 - hostPercent;

  const [hostBarAnim] = useState(() => new Animated.Value(hostPercent));
  const [hypeBurstScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(hostBarAnim, {
      toValue: hostPercent,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [hostBarAnim, hostPercent]);

  const hostBarWidth = useMemo(
    () =>
      hostBarAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
      }),
    [hostBarAnim]
  );
  const rivalBarWidth = useMemo(
    () =>
      hostBarAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['100%', '0%'],
      }),
    [hostBarAnim]
  );

  const trayBottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 4;

  const spawnFloatingReaction = useCallback((emoji, options = {}) => {
    const id = `rx-${Date.now()}-${reactionSeq++}`;
    const left = options.left ?? Math.max(12, Math.random() * (SCREEN_W - 56));
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(0);
    const scale = new Animated.Value(0.6);

    setFloatingReactions((prev) => [
      ...prev.slice(-22),
      {
        id,
        emoji,
        left,
        text: options.text || null,
        opacity,
        translateY,
        scale,
      },
    ]);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: options.burst ? 1.35 : 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: options.burst ? -180 - Math.random() * 40 : -150,
        duration: options.burst ? 1200 : 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(options.burst ? 700 : 900),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
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
    setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'));
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

  const openChallengerRoster = useCallback(() => {
    setRosterOpen(true);
  }, []);

  const selectRivalFromRoster = useCallback(
    (athlete) => {
      focusChallenger(athlete);
      setRosterOpen(false);
    },
    [focusChallenger]
  );

  const viewGridFromRoster = useCallback(() => {
    setRosterOpen(false);
    setViewMode(VIEW_SPOTLIGHT);
  }, []);

  const handleHype = useCallback(() => {
    setHypeCount((n) => n + 1);
    onHype?.();
    Animated.sequence([
      Animated.timing(hypeBurstScale, {
        toValue: 1.18,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(hypeBurstScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
    for (let i = 0; i < 6; i += 1) {
      setTimeout(() => {
        spawnFloatingReaction('🔥', {
          burst: true,
          left: 20 + Math.random() * (SCREEN_W - 64),
        });
      }, i * 55);
    }
    if (battleId) {
      void sendHype(battleId, senderIdRef.current);
    }
  }, [battleId, hypeBurstScale, onHype, spawnFloatingReaction]);

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
      text: `VOTED ${hostAthlete.handle || hostAthlete.label}`,
    });
    if (battleId) {
      void castVote(battleId, null, senderIdRef.current);
    }
  }, [
    battleId,
    focusedRival?.id,
    hostAthlete.handle,
    hostAthlete.label,
    onVote,
    spawnFloatingReaction,
  ]);

  const handleVoteRival = useCallback(() => {
    const rivalId = focusedRival?.userId || focusedRival?.id || null;
    setRivalVotes((n) => n + 1);
    setFocusedRival((fr) =>
      fr ? { ...fr, votes: (fr.votes ?? 0) + 1 } : fr
    );
    onVote?.('challenger', rivalId);
    spawnFloatingReaction('🥊', {
      left: SCREEN_W * 0.55,
      text: `VOTED ${focusedRival?.handle || focusedRival?.label || 'RIVAL'}`,
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
          style={styles.headerBrand}
          onPress={() => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else navigation?.navigate?.('Main', { tab: 'Battles' });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.brandTitle}>BAWAAL</Text>
          <Text style={styles.brandSubtitle} numberOfLines={1}>
            {viewMode === VIEW_SPOTLIGHT ? 'BATTLE BAWAAL ARENA' : 'DUAL FOCUS 1v1'}
          </Text>
        </TouchableOpacity>

        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{match.timerLabel}</Text>
          <Text style={styles.categoryText} numberOfLines={1}>
            {match.category}
          </Text>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText} numberOfLines={1}>
            {rtcJoined ? 'LIVE' : match.spectatorsLabel}
          </Text>
        </View>
      </View>

      <View style={styles.rosterTriggerRow}>
        {viewMode === VIEW_DUAL ? (
          <TouchableOpacity
            style={styles.showAllBtn}
            onPress={() => setViewMode(VIEW_SPOTLIGHT)}
            activeOpacity={0.85}
          >
            <Text style={styles.showAllBtnText}>▦ SHOW ALL CHALLENGERS</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[
            styles.watchRosterBtn,
            viewMode === VIEW_SPOTLIGHT && styles.watchRosterBtnGrow,
          ]}
          onPress={openChallengerRoster}
          activeOpacity={0.85}
        >
          <Text style={styles.watchRosterBtnText}>👁️ WATCH</Text>
        </TouchableOpacity>
      </View>

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
                cameraFacing={cameraFacing}
                micMuted={micMuted && isLocalHost}
              />
            </View>
            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.grid}>
                {gridAthletes.map((athlete) => {
                  const localTile = isLocalAthlete(athlete);
                  return (
                    <ChallengerTile
                      key={athlete.id}
                      athlete={athlete}
                      onPress={focusChallenger}
                      isLocal={localTile}
                      hasRemote={!localTile && hasRemoteUid(athlete.rtcUid)}
                      cameraOff={cameraOff && localTile}
                      cameraFacing={cameraFacing}
                      micMuted={micMuted && localTile}
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
              cameraFacing={cameraFacing}
              micMuted={micMuted && isLocalHost}
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
              isLocal={isLocalAthlete(focusedRival || challengers[0])}
              hasRemote={
                !isLocalAthlete(focusedRival || challengers[0]) &&
                hasRemoteUid((focusedRival || challengers[0])?.rtcUid)
              }
              cameraOff={
                cameraOff && isLocalAthlete(focusedRival || challengers[0])
              }
              cameraFacing={cameraFacing}
              micMuted={
                micMuted && isLocalAthlete(focusedRival || challengers[0])
              }
            />
          </>
        )}

        <FloatingReactionLayer reactions={floatingReactions} />
      </View>

      <ParticipantHudToolbar
        visible={isBroadcaster}
        micMuted={micMuted}
        cameraOff={cameraOff}
        onFlip={handleFlipCamera}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
      />

      <View style={styles.pollSection}>
        <View style={styles.pollLabelRow}>
          <TouchableOpacity
            style={styles.pollHandleHit}
            activeOpacity={0.8}
            onPress={() => {
              setProfileRole('HOST');
              setProfileAthlete(hostAthlete);
            }}
          >
            <View style={styles.pollBadgeHost}>
              <Text style={styles.pollBadgeHostText}>[H]</Text>
            </View>
            <Text style={styles.pollHostText} numberOfLines={1}>
              {hostAthlete.handle || '@HOST'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.pollPercentMid}>
            {hostPercent}% ⚡ {rivalPercent}%
          </Text>

          <TouchableOpacity
            style={[styles.pollHandleHit, styles.pollHandleHitRight]}
            activeOpacity={0.8}
            onPress={() => {
              setProfileRole('RIVAL');
              setProfileAthlete(focusedRival || challengers[0]);
            }}
          >
            <Text style={styles.pollChallengerText} numberOfLines={1}>
              {(focusedRival || challengers[0])?.handle || '@RIVAL'}
            </Text>
            <View style={styles.pollBadgeRival}>
              <Text style={styles.pollBadgeRivalText}>[R]</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.pollBarTrack}>
          <Animated.View style={[styles.pollBarHost, { width: hostBarWidth }]}>
            {hostPercent >= 18 ? (
              <Text style={styles.pollBarPctHost}>{hostPercent}%</Text>
            ) : null}
          </Animated.View>
          <Animated.View style={[styles.pollBarChallenger, { width: rivalBarWidth }]}>
            {rivalPercent >= 18 ? (
              <Text style={styles.pollBarPctRival}>{rivalPercent}%</Text>
            ) : null}
          </Animated.View>
        </View>
        <Text style={styles.tapToVoteText}>
          TAP HANDLE TO FOLLOW ·{' '}
          {viewMode === VIEW_SPOTLIGHT
            ? 'TAP A TILE TO FOCUS · THEN VOTE'
            : 'TAP HOST / RIVAL TO CAST YOUR VOTE'}
        </Text>
      </View>

      <View style={[styles.actionTray, { paddingBottom: trayBottomPad }]}>
        <Animated.View style={{ transform: [{ scale: hypeBurstScale }] }}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHype}
            activeOpacity={0.85}
          >
            <Text style={styles.actionIcon}>🔥</Text>
            <Text style={styles.actionLabel}>HYPE ({hypeCount})</Text>
          </TouchableOpacity>
        </Animated.View>

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

      <AthleteProfileSheet
        visible={Boolean(profileAthlete)}
        athlete={profileAthlete}
        roleLabel={profileRole}
        onClose={() => setProfileAthlete(null)}
      />

      <ChallengerRosterSheet
        visible={rosterOpen}
        host={hostAthlete}
        challengers={challengers}
        activeRivalId={focusedRival?.id || focusedRival?.handle}
        onSelectRival={selectRivalFromRoster}
        onViewGrid={viewGridFromRoster}
        onClose={() => setRosterOpen(false)}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  headerBrand: {
    flexShrink: 1,
    maxWidth: '28%',
  },
  brandTitle: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: MUTED,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  timerBadge: {
    flexShrink: 1,
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '42%',
  },
  timerText: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 16,
  },
  categoryText: {
    color: '#CCCCCC',
    fontSize: 7,
    fontWeight: '700',
  },
  liveBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF0000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: '28%',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF0000',
    marginRight: 5,
  },
  liveText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 9,
  },
  participantHud: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  participantHudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  participantHudBtnActive: {
    backgroundColor: 'rgba(255,87,34,0.22)',
  },
  participantHudIcon: {
    fontSize: 13,
  },
  participantHudLabel: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  participantHudDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  rosterTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  showAllBtn: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  watchRosterBtn: {
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderWidth: 1,
    borderColor: CYAN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  watchRosterBtnGrow: {
    flex: 1,
    alignItems: 'center',
  },
  watchRosterBtnText: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  tileLocal: {
    borderColor: ORANGE,
    borderWidth: 1.5,
  },
  tileYouPill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: ORANGE,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tileYouText: {
    color: WHITE,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
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
    color: '#444444',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  avatarPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    gap: 6,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SURFACE,
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: WHITE,
    fontSize: 26,
    fontWeight: '900',
  },
  avatarFlag: {
    fontSize: 18,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: SURFACE,
  },
  pollLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  pollHandleHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  pollHandleHitRight: {
    justifyContent: 'flex-end',
  },
  pollBadgeHost: {
    backgroundColor: '#FFE600',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pollBadgeHostText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  pollBadgeRival: {
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pollBadgeRivalText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  pollHostText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
    flexShrink: 1,
  },
  pollChallengerText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  pollPercentMid: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
    flexShrink: 0,
    paddingHorizontal: 4,
  },
  pollBarTrack: {
    height: 16,
    width: '100%',
    backgroundColor: SURFACE,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pollBarHost: {
    height: '100%',
    backgroundColor: ORANGE,
    justifyContent: 'center',
    paddingLeft: 6,
  },
  pollBarPctHost: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
  },
  pollBarPctRival: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'right',
    paddingRight: 6,
  },
  pollBarChallenger: {
    height: '100%',
    backgroundColor: CYAN,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
