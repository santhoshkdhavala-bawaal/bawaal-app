/**
 * Live1v1BattleScreen — BAWAAL Multi-Challenger Arena Matrix
 *
 * LOCK-IN (role UI):
 *  - Spectator (!isParticipant): transparent VOTE HOST · BANTER · VOTE RIVAL dock;
 *    floating poll bar; no camera tools.
 *  - Athlete (isParticipant): no vote UI / no poll; Flip/Mute/Cam at bottom:24;
 *    showControls 5s auto-fade; [HOST]/[RIVAL] handle badges.
 *  - 9-tile challenger grid lives ONLY inside ChallengerRosterSheet (never on main stage).
 *
 * LOCK-IN (roster → 1v1):
 *  - Selecting a rival from the roster / grid immediately enters DUAL_FOCUS (50/50 Host|Rival),
 *    unmounts the tile grid, and streams only those two panes.
 *  - Spectator HUD: top-right ROSTER (N) opens ChallengerRosterSheet over live A/V.
 *  - Spectator SPECTATE switches focusedRival in the bottom viewport (queue unchanged).
 *
 * LOCK-IN (auto-queue matchmaking):
 *  - At battle start with Host live → promote queue[0] into dual 1v1.
 *  - 10s rival presence timeout → evict to standby, auto-calibrate queue[0] next.
 *  - Host "QUEUED ATHLETES (X)" + CALL OUT overrides auto order.
 *
 * DEV mock bar (__DEV__ only): TOGGLE RIVAL · TOGGLE SPECTATOR · SIMULATE REP.
 * Production styling tokens / HUD chrome are unchanged outside that overlay.
 *
 * Camera lock-in:
 *  - Host viewport mounts expo-camera CameraView (facing front) under transparent HUD.
 *  - Rival uses Agora remote when present; otherwise RivalSimFeed (simulated WebRTC).
 *
 * View modes:
 *  - SPOTLIGHT_GRID: Host spotlight + challenger matrix
 *  - DUAL_FOCUS: Host vs rival 50/50 (no grid behind)
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
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import {
  castVote,
  incrementReps,
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

const BG = '#000000';
const SURFACE = '#121212';
const BORDER = '#1F2937';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ORANGE = '#FF5722';
const CYAN = '#00E5FF';
/** Arena viewport panels — visible even when camera / RTC tracks are offline. */
const PANEL_HOST = '#090D16';
const PANEL_RIVAL = '#121826';

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
  /** ISO UTC start — null/past means matchmaking may arm as soon as Host is live. */
  scheduledAtUTC: null,
  status: 'live',
});

/** Rival must publish video within this window or get auto-evicted. */
const RIVAL_PRESENCE_TIMEOUT_MS = 10000;

let reactionSeq = 0;

function athleteKey(athlete) {
  return athlete?.id || athlete?.userId || athlete?.handle || athlete?.rtcUid || null;
}

function formatVoteCount(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(v);
}

/** Clean slate only — never render letter circles / initials over video. */
function StreamFallbackPanel({ cameraOff, role = 'challenger' }) {
  return (
    <View
      style={[
        styles.streamFallback,
        role === 'host' ? styles.streamFallbackHost : styles.streamFallbackRival,
      ]}
      pointerEvents="none"
    >
      {cameraOff ? (
        <Text style={styles.streamHint} numberOfLines={1}>
          CAMERA OFF
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Simulated remote WebRTC layer for Rival when no Agora publish is present.
 * Visual-only (no center copy) so the VS badge stays crisp and collision-free.
 */
function RivalSimFeed() {
  const [pulse] = useState(() => new Animated.Value(0.28));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.28,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.rivalSimRoot} pointerEvents="none">
      <Animated.View style={[styles.rivalSimScan, { opacity: pulse }]} />
    </View>
  );
}

function AthleteHandlePill({ handle, flag, tone = 'host' }) {
  const isRival = tone === 'rival';
  return (
    <View
      style={[
        styles.handlePillWrap,
        isRival ? styles.handlePillWrapRival : styles.handlePillWrapHost,
      ]}
    >
      <View style={styles.handlePillRow}>
        {flag ? <Text style={styles.flagText}>{flag}</Text> : null}
        <Text style={styles.handleText} numberOfLines={1}>
          {handle || (isRival ? '@RIVAL' : '@HOST')}
        </Text>
      </View>
      <View
        style={[
          styles.roleIdBadge,
          isRival ? styles.roleIdBadgeRival : styles.roleIdBadgeHost,
        ]}
      >
        <Text
          style={[
            styles.roleIdBadgeText,
            isRival ? styles.roleIdBadgeTextRival : styles.roleIdBadgeTextHost,
          ]}
        >
          {isRival ? '[RIVAL]' : '[HOST]'}
        </Text>
      </View>
    </View>
  );
}

/** Catches native/view crashes in CameraView / RtcSurfaceView so the arena never goes blank. */
class StreamErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('[Live1v1 StreamErrorBoundary]', error?.message || error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PANEL_RIVAL }]} />
      );
    }
    return this.props.children ?? null;
  }
}

/** Screen-level guard — Live1v1 never unmounts to a blank/null tree. */
class ArenaSafeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('[Live1v1 ArenaSafeBoundary]', error?.message || error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.safeCrashRoot}>
          <View style={styles.safeCrashHostPane}>
            <Text style={styles.safeCrashLabel}>HOST · STANDBY</Text>
          </View>
          <View style={styles.safeCrashRivalPane}>
            <Text style={styles.safeCrashLabel}>RIVAL · STANDBY</Text>
          </View>
          <Text style={styles.safeCrashHint}>Arena recovering — tap back and re-enter</Text>
        </View>
      );
    }
    return this.props.children ?? (
      <View style={styles.safeCrashRoot}>
        <View style={styles.safeCrashHostPane} />
        <View style={styles.safeCrashRivalPane} />
      </View>
    );
  }
}

/**
 * Local Host → expo-camera CameraView (front by default).
 * Remote Rival → Agora RtcSurfaceView, or RivalSimFeed in simulation mode.
 * Camera layer sits at zIndex 0; pane HUD overlays float above at zIndex 10.
 */
function StreamSurface({
  streamId,
  rtcUid,
  label,
  role = 'challenger',
  isLocal = false,
  hasRemote = false,
  cameraOff = false,
  cameraFacing = 'front',
  micMuted = false,
  mediaReady = false,
  style,
}) {
  const uid = Number(rtcUid) || 0;
  const showLocalCamera = Boolean(isLocal && !cameraOff && mediaReady);
  const showRemoteRtc =
    !isLocal && Boolean(RtcSurfaceView) && hasRemote && uid > 0;
  const showRivalSim = !isLocal && !showRemoteRtc && role !== 'host';

  if (__DEV__ && !showLocalCamera && !showRemoteRtc && !showRivalSim) {
    console.log('[StreamSurface] using fallback panel', {
      streamId,
      rtcUid: uid,
      role,
      isLocal,
      hasRemote,
      cameraOff,
      mediaReady,
      agoraReady: Boolean(RtcSurfaceView),
    });
  }

  const renderFallback = (key) => (
    <StreamFallbackPanel
      key={key}
      cameraOff={cameraOff && isLocal}
      role={role}
    />
  );

  let liveTrack = null;
  if (showLocalCamera) {
    liveTrack = (
      <View style={styles.cameraLayer} pointerEvents="none">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing || 'front'}
          mute={micMuted}
          mirror={(cameraFacing || 'front') === 'front'}
        />
      </View>
    );
  } else if (showRemoteRtc) {
    liveTrack = (
      <View style={styles.cameraLayer} pointerEvents="none">
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{
            uid,
            sourceType: VideoSourceType.VideoSourceRemote,
            renderMode: RenderModeType.RenderModeHidden ?? 1,
          }}
          zOrderMediaOverlay
        />
      </View>
    );
  } else if (showRivalSim) {
    liveTrack = (
      <View style={styles.cameraLayer} pointerEvents="none">
        <RivalSimFeed />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.streamSurface,
        role === 'host' ? styles.streamSurfaceHost : styles.streamSurfaceRival,
        style,
      ]}
      accessibilityLabel={`stream-${streamId || rtcUid || label}`}
    >
      {renderFallback('base-fallback')}
      {liveTrack ? (
        <StreamErrorBoundary fallback={renderFallback('error-fallback')}>
          {liveTrack}
        </StreamErrorBoundary>
      ) : null}
    </View>
  );
}

function FloatingReactionLayer({ reactions }) {
  return (
    <View style={styles.floatingLayer} pointerEvents="none">
      {(reactions || []).map((rx) => {
        const isGloveToast = rx.placement === 'toast';
        return (
          <Animated.View
            key={rx.id}
            style={[
              isGloveToast ? styles.floatingToastItem : styles.floatingItem,
              rx.text ? styles.floatingPill : null,
              isGloveToast ? styles.floatingToastPill : null,
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
        );
      })}
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
  if (!visible) {
    return <View style={styles.participantHudHidden} />;
  }
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
  mediaReady = false,
  overlaysVisible = true,
  topInset = 50,
}) {
  const safeHost = host || DEFAULT_HOST;
  return (
    <View style={styles.hostSpotlight}>
      <StreamSurface
        streamId={safeHost.streamId}
        rtcUid={safeHost.rtcUid}
        label={safeHost.handle}
        role="host"
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        cameraFacing={cameraFacing}
        micMuted={micMuted}
        mediaReady={mediaReady}
        style={styles.cameraLayer}
      />
      {/* Host handle — top-left inside host viewport, below status bar */}
      <View
        style={[styles.handleAnchorInPane, { top: topInset, left: 12 }]}
        pointerEvents="none"
      >
        <AthleteHandlePill
          handle={safeHost.handle}
          flag={safeHost.flag}
          tone="host"
        />
      </View>
      {overlaysVisible ? (
        <View
          style={[styles.statsAnchorHost, { top: topInset }]}
          pointerEvents="box-none"
        >
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
            <Text style={styles.repsCountHost}>{safeHost.reps ?? 0}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
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
  mediaReady = false,
  overlaysVisible = true,
  topInset = 50,
}) {
  const isHost = variant === 'host';
  const safe = athlete || (isHost ? DEFAULT_HOST : DEFAULT_CHALLENGERS[0]);
  // Host clears the status bar; rival sits at top of its own bottom pane (under VS).
  const handleTop = isHost ? topInset : 12;
  return (
    <View style={styles.dualPane} pointerEvents="box-none">
      <StreamSurface
        streamId={safe.streamId}
        rtcUid={safe.rtcUid}
        label={safe.handle}
        role={isHost ? 'host' : 'challenger'}
        isLocal={isLocal}
        hasRemote={hasRemote}
        cameraOff={cameraOff}
        cameraFacing={cameraFacing}
        micMuted={micMuted}
        mediaReady={mediaReady}
        style={styles.cameraLayer}
      />
      <View
        style={[styles.handleAnchorInPane, { top: handleTop, left: 12 }]}
        pointerEvents="none"
      >
        <AthleteHandlePill
          handle={safe.handle}
          flag={safe.flag}
          tone={isHost ? 'host' : 'rival'}
        />
      </View>
      {overlaysVisible ? (
        <View
          style={[styles.statsAnchorHost, { top: handleTop }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={isHost ? styles.hostRepsBadge : styles.challengerRepsBadge}
            onPress={onRepPress}
            activeOpacity={0.85}
            hitSlop={8}
          >
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={isHost ? styles.repsCountHost : styles.repsCountChallenger}>
              {safe.reps ?? 0}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function Live1v1BattleScreenInner({
  navigation,
  route,
  onVote,
  onBanter,
}) {
  const insets = useSafeAreaInsets();
  const senderIdRef = useRef('spectator-local');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const mediaReady =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  const arenaRole = route?.params?.role || 'spectator';
  /** Route-derived participant flag — production source of truth. */
  const routeIsParticipant = arenaRole === 'host' || arenaRole === 'challenger';
  /**
   * DEV-only override for Athlete HUD vs Spectator gloves.
   * Production builds always use routeIsParticipant (toggle bar is not mounted).
   */
  const [devIsParticipant, setDevIsParticipant] = useState(routeIsParticipant);
  const isParticipant = __DEV__ ? devIsParticipant : routeIsParticipant;
  const isBroadcaster = isParticipant;

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

  // --- Live arena UI state (local until fully mirrored via Supabase Realtime) ---
  // Host starts full-bleed until matchmaking promotes queue[0]; challenger enters dual.
  /** Solo (false) vs 50/50 Dual Split (true) — drives VIEW_DUAL / VIEW_SPOTLIGHT. */
  const [hasActiveRival, setHasActiveRival] = useState(
    () => arenaRole === 'challenger'
  );
  const viewMode = hasActiveRival ? VIEW_DUAL : VIEW_SPOTLIGHT;
  const [hostAthlete, setHostAthlete] = useState(match.host);
  const [challengers, setChallengers] = useState(match.challengers);
  /** FIFO checked-in queue — excludes the athlete currently in the duel. */
  const [queue, setQueue] = useState(() => {
    const list = [...(match.challengers || [])];
    if (arenaRole === 'challenger') return list.slice(1);
    return list;
  });
  const [standbyPool, setStandbyPool] = useState([]);
  const [focusedRival, setFocusedRival] = useState(() =>
    arenaRole === 'challenger' ? match.challengers[0] : null
  );
  const [matchmakingActive, setMatchmakingActive] = useState(false);
  const [rivalSlotStartedAt, setRivalSlotStartedAt] = useState(null);
  /** Crowd tallies — drive animated progress bar + glove vote actions. */
  const [hostVotes, setHostVotes] = useState(
    () => Number(match.initialHostVotes ?? 1240)
  );
  const [rivalVotes, setRivalVotes] = useState(
    () => Number(match.challengers[0]?.votes ?? 1060)
  );
  const [hypeCount, setHypeCount] = useState(() => Number(match.initialHype ?? 88));
  /** Floating HUD chrome — starts visible; 5s auto-fade. Gloves stay persistent. */
  const [showControls, setShowControls] = useState(true); // HUD visible on enter
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterDraft, setBanterDraft] = useState('');
  /** Agora remote publisher uids currently in the channel. */
  const [remoteUids, setRemoteUids] = useState([]);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('front');
  const [rtcJoined, setRtcJoined] = useState(false);
  const [profileAthlete, setProfileAthlete] = useState(null);
  const [profileRole, setProfileRole] = useState('ATHLETE');
  const [rosterOpen, setRosterOpen] = useState(false);
  const [voteHintVisible, setVoteHintVisible] = useState(true);
  const [hudOpacity] = useState(() => new Animated.Value(1));
  const [hintOpacity] = useState(() => new Animated.Value(1));
  const hudHideTimerRef = useRef(null);
  const voteHintTimerRef = useRef(null);
  const rivalFailoverTimerRef = useRef(null);
  const HUD_FADE_MS = 5000;
  const isHostRole = arenaRole === 'host';

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

  /**
   * Host viewport prefers the device front camera.
   * In DEV / no remote host publish, always preview locally so solo testing works.
   */
  const hostUsesDeviceCamera =
    isLocalHost ||
    (__DEV__ && !hasRemoteUid(hostAthlete?.rtcUid));

  const totalVotes = Math.max(1, hostVotes + rivalVotes);
  const hostPercent = Math.round((hostVotes / totalVotes) * 100);
  const rivalPercent = 100 - hostPercent;

  const [hostBarAnim] = useState(() => new Animated.Value(hostPercent));

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

  const clearHudHideTimer = useCallback(() => {
    if (hudHideTimerRef.current) {
      clearTimeout(hudHideTimerRef.current);
      hudHideTimerRef.current = null;
    }
  }, []);

  const scheduleHudHide = useCallback(() => {
    clearHudHideTimer();
    hudHideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      Animated.timing(hudOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, HUD_FADE_MS);
  }, [HUD_FADE_MS, clearHudHideTimer, hudOpacity]);

  /** Show HUD at full opacity and restart the 5s auto-fade timer. */
  const showHud = useCallback(() => {
    setShowControls(true);
    Animated.timing(hudOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    scheduleHudHide();
  }, [hudOpacity, scheduleHudHide]);

  /** Empty video space: toggle HUD; when turning ON, restart 5s auto-fade. */
  const toggleHud = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (next) {
        Animated.timing(hudOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
        clearHudHideTimer();
        hudHideTimerRef.current = setTimeout(() => {
          setShowControls(false);
          Animated.timing(hudOpacity, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, HUD_FADE_MS);
      } else {
        clearHudHideTimer();
        Animated.timing(hudOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
      return next;
    });
  }, [HUD_FADE_MS, clearHudHideTimer, hudOpacity]);

  const bumpHud = useCallback(() => {
    showHud();
  }, [showHud]);

  useEffect(() => {
    scheduleHudHide();
    voteHintTimerRef.current = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVoteHintVisible(false);
      });
    }, HUD_FADE_MS + 500);
    return () => {
      clearHudHideTimer();
      if (voteHintTimerRef.current) clearTimeout(voteHintTimerRef.current);
    };
  }, [HUD_FADE_MS, clearHudHideTimer, hintOpacity, scheduleHudHide]);

  const spawnFloatingReaction = useCallback((emoji, options = {}) => {
    const id = `rx-${Date.now()}-${reactionSeq++}`;
    const isToast = options.placement === 'toast';
    // Vote toasts rise from glove columns; other floats stay mid-lower.
    let left = options.left;
    if (left == null) {
      if (isToast && options.side === 'host') left = SCREEN_W * 0.12;
      else if (isToast && options.side === 'rival') left = SCREEN_W * 0.52;
      else if (isToast) left = Math.max(24, (SCREEN_W - 200) / 2);
      else left = Math.max(12, Math.random() * (SCREEN_W - 56));
    }
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(0);
    const scale = new Animated.Value(0.7);

    setFloatingReactions((prev) => [
      ...prev.slice(-22),
      {
        id,
        emoji,
        left,
        text: options.text || null,
        placement: options.placement || 'float',
        opacity,
        translateY,
        scale,
      },
    ]);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: options.burst ? 1.35 : 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        // Glove toasts stream UP from the bottom bar (never park on upper video).
        toValue: isToast
          ? -110 - Math.random() * 36
          : options.burst
            ? -180 - Math.random() * 40
            : -150,
        duration: isToast ? 1100 : options.burst ? 1200 : 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(isToast ? 900 : options.burst ? 700 : 900),
        Animated.timing(opacity, { toValue: 0, duration: 420, useNativeDriver: true }),
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
          placement: 'toast',
          side: 'host',
          text: `VOTED ${hostAthlete.handle || hostAthlete.label}`,
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
          placement: 'toast',
          side: 'rival',
          text: 'VOTED RIVAL',
        });
      }
    },
    [hostAthlete.handle, hostAthlete.label, spawnFloatingReaction]
  );

  const focusedRivalRef = useRef(focusedRival);

  useEffect(() => {
    senderIdRef.current = `spectator-${Date.now().toString(36)}`;
  }, []);

  useEffect(() => {
    focusedRivalRef.current = focusedRival;
  }, [focusedRival]);

  // Request camera (+ mic) permissions automatically on arena mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Camera.requestCameraPermissionsAsync();
        if (cancelled) return;
        await Camera.requestMicrophonePermissionsAsync();
      } catch (err) {
        if (__DEV__) {
          console.warn('[Live1v1] permission request failed', err?.message || err);
        }
        // Fallback to hook requesters if static Camera API is unavailable.
        if (!cancelled && cameraPermission && !cameraPermission.granted) {
          await requestCameraPermission();
        }
        if (!cancelled && micPermission && !micPermission.granted) {
          await requestMicPermission();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only — hooks refresh mediaReady via permission state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount prompt
  }, []);

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

  /** Local hardware only — host/rival never mutate the other athlete's stream. */
  const handleFlipCamera = useCallback(() => {
    if (!isParticipant) return;
    setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'));
    switchCamera();
  }, [isParticipant]);

  const handleToggleMic = useCallback(() => {
    if (!isParticipant) return;
    setMicMuted((prev) => {
      const next = !prev;
      muteLocalAudioStream(next);
      return next;
    });
  }, [isParticipant]);

  const handleToggleCamera = useCallback(() => {
    if (!isParticipant) return;
    setCameraOff((prev) => {
      const next = !prev;
      muteLocalVideoStream(next);
      return next;
    });
  }, [isParticipant]);

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

  /**
   * Promote athlete into active dual 1v1.
   * Removes them from the waiting queue; optional prior rival returns to queue front.
   */
  const promoteRival = useCallback(
    (athlete, { requeueCurrent = false } = {}) => {
      if (!athlete) return;
      const nextKey = athleteKey(athlete);
      setFocusedRival((current) => {
        if (requeueCurrent && current && athleteKey(current) !== nextKey) {
          setQueue((q) => {
            const withoutNext = q.filter((a) => athleteKey(a) !== nextKey);
            const alreadyQueued = withoutNext.some(
              (a) => athleteKey(a) === athleteKey(current)
            );
            return alreadyQueued ? withoutNext : [current, ...withoutNext];
          });
        } else {
          setQueue((q) => q.filter((a) => athleteKey(a) !== nextKey));
        }
        return athlete;
      });
      setRivalVotes(Number(athlete.votes) || 500);
      setHasActiveRival(true);
      setRivalSlotStartedAt(Date.now());
      setRosterOpen(false);
      bumpHud();
    },
    [bumpHud]
  );

  /** Enter clean 50/50 Host|Rival — grid unmounts; only these two streams stay live. */
  const focusChallenger = useCallback(
    (athlete) => {
      promoteRival(athlete, { requeueCurrent: false });
    },
    [promoteRival]
  );

  /** Host override — jump the queue and launch a duel with a specific athlete. */
  const callOutRival = useCallback(
    (athlete) => {
      if (!isHostRole || !athlete) return;
      promoteRival(athlete, { requeueCurrent: true });
      if (__DEV__) {
        console.log('[matchmaking] HOST CALL OUT', athlete.handle || athlete.id);
      }
    },
    [isHostRole, promoteRival]
  );

  /** Open roster sheet over live 1v1 — does not pause or tear down streams. */
  const openChallengerRoster = useCallback(() => {
    bumpHud();
    setRosterOpen(true);
  }, [bumpHud]);

  /**
   * Spectator stream switch — focus a queued athlete in the bottom viewport
   * without mutating the host matchmaking queue / CALL OUT order.
   */
  const spectateRival = useCallback(
    (athlete) => {
      if (!athlete || isParticipant) return;
      setFocusedRival(athlete);
      setRivalVotes(Number(athlete.votes) || 500);
      setHasActiveRival(true);
      setRosterOpen(false);
      bumpHud();
      if (__DEV__) {
        console.log('[spectate] focus rival', athlete.handle || athlete.id);
      }
    },
    [bumpHud, isParticipant]
  );

  const selectRivalFromRoster = useCallback(
    (athlete) => {
      if (isHostRole) {
        callOutRival(athlete);
        return;
      }
      if (!isParticipant) {
        spectateRival(athlete);
        return;
      }
      focusChallenger(athlete);
    },
    [callOutRival, focusChallenger, isHostRole, isParticipant, spectateRival]
  );

  /** Grid browse stays inside ChallengerRosterSheet — never remount tiles on the main stage. */
  const viewGridFromRoster = useCallback(() => {
    bumpHud();
  }, [bumpHud]);

  /** DEV: Solo host ⟷ Dual 50/50 without touching production style tokens. */
  const toggleDevRival = useCallback(() => {
    setHasActiveRival((prev) => {
      const next = !prev;
      if (next) {
        setFocusedRival((current) => {
          if (current) return current;
          const fallback =
            queue[0] || challengers[0] || DEFAULT_CHALLENGERS[0];
          setRivalVotes(Number(fallback?.votes) || 500);
          setQueue((q) =>
            q.filter((a) => athleteKey(a) !== athleteKey(fallback))
          );
          return fallback;
        });
        setRivalSlotStartedAt(Date.now());
      } else {
        setRivalSlotStartedAt(null);
      }
      return next;
    });
    bumpHud();
  }, [bumpHud, challengers, queue]);

  /** DEV: Athlete camera HUD ⟷ Spectator voting gloves. */
  const toggleDevSpectator = useCallback(() => {
    setDevIsParticipant((prev) => !prev);
    bumpHud();
  }, [bumpHud]);

  // Arm auto-queue when scheduled time is due and Host is live.
  useEffect(() => {
    if (!isHostRole) return undefined;
    const scheduled =
      match.scheduledAtUTC ||
      route?.params?.scheduledAtUTC ||
      route?.params?.match?.scheduledAtUTC ||
      null;

    const tick = () => {
      const due =
        !scheduled ||
        Number.isNaN(new Date(scheduled).getTime()) ||
        Date.now() >= new Date(scheduled).getTime();
      const hostLive =
        Boolean(rtcJoined) ||
        Boolean(mediaReady) ||
        String(match.status || '').toLowerCase() === 'live';
      if (due && hostLive) {
        setMatchmakingActive(true);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [
    isHostRole,
    match.scheduledAtUTC,
    match.status,
    mediaReady,
    route?.params?.match?.scheduledAtUTC,
    route?.params?.scheduledAtUTC,
    rtcJoined,
  ]);

  // First-come: promote queue[0] into dual 1v1 when matchmaking arms and no rival is active.
  useEffect(() => {
    if (!isHostRole || !matchmakingActive) return undefined;
    if (focusedRival) return undefined;
    if (!queue.length) return undefined;
    const first = queue[0];
    const id = setTimeout(() => {
      if (__DEV__) {
        console.log('[matchmaking] auto-promote queue[0]', first.handle || first.id);
      }
      promoteRival(first, { requeueCurrent: false });
    }, 0);
    return () => clearTimeout(id);
  }, [focusedRival, isHostRole, matchmakingActive, promoteRival, queue]);

  // 10s camera/presence heartbeat — failover to next queued athlete.
  useEffect(() => {
    if (rivalFailoverTimerRef.current) {
      clearTimeout(rivalFailoverTimerRef.current);
      rivalFailoverTimerRef.current = null;
    }
    if (!isHostRole || !focusedRival || !hasActiveRival) return undefined;
    if (!rivalSlotStartedAt) return undefined;

    // Without Agora we cannot observe remote publish — skip eviction in that mode.
    if (!isAgoraConfigured() || !rtcJoined) return undefined;

    const rivalUid = Number(focusedRival.rtcUid) || 0;
    const present =
      (rivalUid > 0 && hasRemoteUid(rivalUid)) || isLocalAthlete(focusedRival);
    if (present) return undefined;

    const slotId = athleteKey(focusedRival);
    const elapsed = Date.now() - rivalSlotStartedAt;
    const waitMs = Math.max(0, RIVAL_PRESENCE_TIMEOUT_MS - elapsed);

    rivalFailoverTimerRef.current = setTimeout(() => {
      const stillMissing =
        rivalUid <= 0 || !remoteUids.includes(rivalUid);
      if (!stillMissing) return;

      const evicted = focusedRival;
      if (__DEV__) {
        console.warn(
          '[matchmaking] rival presence timeout — failover',
          evicted?.handle || slotId
        );
      }
      setStandbyPool((prev) =>
        prev.some((a) => athleteKey(a) === slotId) ? prev : [...prev, evicted]
      );
      setQueue((q) => {
        const waiting = q.filter((a) => athleteKey(a) !== slotId);
        const next = waiting[0];
        if (next) {
          setFocusedRival(next);
          setRivalVotes(Number(next.votes) || 500);
          setHasActiveRival(true);
          setRivalSlotStartedAt(Date.now());
          bumpHud();
          return waiting.slice(1);
        }
        setFocusedRival(null);
        setRivalSlotStartedAt(null);
        setHasActiveRival(false);
        bumpHud();
        return waiting;
      });
    }, waitMs);

    return () => {
      if (rivalFailoverTimerRef.current) {
        clearTimeout(rivalFailoverTimerRef.current);
        rivalFailoverTimerRef.current = null;
      }
    };
  }, [
    bumpHud,
    focusedRival,
    hasRemoteUid,
    isHostRole,
    isLocalAthlete,
    remoteUids,
    rivalSlotStartedAt,
    rtcJoined,
    hasActiveRival,
  ]);

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
      placement: 'toast',
      side: 'host',
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
      placement: 'toast',
      side: 'rival',
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

  /** DEV: bump host (+ rival when dual) rep counters for HUD smoke tests. */
  const simulateDevRep = useCallback(() => {
    handleHostRep();
    if (hasActiveRival) {
      handleRivalRep();
    }
    bumpHud();
  }, [bumpHud, handleHostRep, handleRivalRep, hasActiveRival]);

  const safeHostAthlete = hostAthlete || DEFAULT_HOST;
  const rivalAthlete =
    focusedRival || challengers?.[0] || DEFAULT_CHALLENGERS[0];
  const hostVotesLabel = formatVoteCount(hostVotes);
  const rivalVotesLabel = formatVoteCount(rivalVotes);
  /** Keep host handle / top HUD clear of the status-bar clock. */
  const hostTopInset =
    (Platform.OS === 'android'
      ? StatusBar.currentHeight || 40
      : Math.max(insets.top, 44)) + 10;
  /** Extra clearance only in __DEV__ so the floating mock bar does not cover badges. */
  const DEV_MOCK_BAR_H = 34;
  const stageTopInset = __DEV__ ? hostTopInset + DEV_MOCK_BAR_H + 4 : hostTopInset;
  /** Reps stay up for athletes; spectators only see them with HUD chrome. */
  const repsVisible = isParticipant || showControls;
  const isDualFocus = hasActiveRival;

  // Never return null/undefined — always mount a full arena tree.
  return (
    <View style={styles.rootScreen}>
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent />

      {__DEV__ ? (
        <View
          style={[styles.devMockBar, { paddingTop: Math.max(insets.top, 4) }]}
          pointerEvents="box-none"
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.devMockBarInner}
          >
            <TouchableOpacity
              style={[
                styles.devMockBtn,
                hasActiveRival && styles.devMockBtnOn,
              ]}
              onPress={toggleDevRival}
              activeOpacity={0.85}
            >
              <Text style={styles.devMockBtnText}>
                {hasActiveRival ? 'RIVAL ON' : 'TOGGLE RIVAL'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.devMockBtn,
                !isParticipant && styles.devMockBtnSpectator,
              ]}
              onPress={toggleDevSpectator}
              activeOpacity={0.85}
            >
              <Text style={styles.devMockBtnText}>
                {isParticipant ? 'TOGGLE SPECTATOR' : 'SPECTATOR ON'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devMockBtn}
              onPress={simulateDevRep}
              activeOpacity={0.85}
            >
              <Text style={styles.devMockBtnText}>SIMULATE REP</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

      {/* Tap empty video space to toggle HUD — gloves live OUTSIDE this catcher */}
      <Pressable
        style={styles.tapStage}
        onPress={toggleHud}
        accessibilityRole="button"
        accessibilityLabel="Toggle battle HUD"
      >
      {/* Full-bleed video stage — 1v1 dual panes OR roster grid (never both) */}
      <View style={styles.stageContainer} pointerEvents="box-none">
        {isDualFocus ? (
          <View style={styles.dualFocusColumn} pointerEvents="box-none">
            <View style={styles.streamPaneShell} pointerEvents="box-none">
              <DualFocusPane
                athlete={safeHostAthlete}
                variant="host"
                overlaysVisible={repsVisible}
                mediaReady={mediaReady}
                topInset={stageTopInset}
                onRepPress={() => {
                  bumpHud();
                  handleHostRep();
                }}
                isLocal={hostUsesDeviceCamera}
                hasRemote={hasRemoteUid(safeHostAthlete.rtcUid)}
                cameraOff={cameraOff && hostUsesDeviceCamera}
                cameraFacing={cameraFacing}
                micMuted={micMuted && hostUsesDeviceCamera}
              />
            </View>
            <View style={styles.vsCenterSeam} pointerEvents="none">
              <View style={styles.vsLine} />
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.vsLine} />
            </View>
            <View style={styles.streamPaneShell} pointerEvents="box-none">
              <DualFocusPane
                athlete={rivalAthlete}
                variant="rival"
                overlaysVisible={repsVisible}
                mediaReady={mediaReady}
                onRepPress={() => {
                  bumpHud();
                  handleRivalRep();
                }}
                isLocal={isLocalAthlete(rivalAthlete)}
                hasRemote={
                  !isLocalAthlete(rivalAthlete) &&
                  hasRemoteUid(rivalAthlete?.rtcUid)
                }
                cameraOff={cameraOff && isLocalAthlete(rivalAthlete)}
                cameraFacing={cameraFacing}
                micMuted={micMuted && isLocalAthlete(rivalAthlete)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.fullVideoColumn} pointerEvents="box-none">
            <View style={styles.spotlightHostWrap}>
              <HostSpotlight
                host={safeHostAthlete}
                live
                overlaysVisible={repsVisible}
                mediaReady={mediaReady}
                topInset={stageTopInset}
                onRepPress={() => {
                  bumpHud();
                  handleHostRep();
                }}
                isLocal={hostUsesDeviceCamera}
                hasRemote={hasRemoteUid(safeHostAthlete.rtcUid)}
                cameraOff={cameraOff && hostUsesDeviceCamera}
                cameraFacing={cameraFacing}
                micMuted={micMuted && hostUsesDeviceCamera}
              />
            </View>
          </View>
        )}
      </View>

      {/* Floating HUD chrome — transparent stack above gloves (no dark patches) */}
      <Animated.View
        style={[
          styles.hudChrome,
          {
            opacity: hudOpacity,
            transform: [
              {
                translateY: hudOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showControls ? 'box-none' : 'none'}
      >
        <View
          style={[styles.hudTopBlock, { paddingTop: stageTopInset }]}
          pointerEvents="box-none"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBrand}
              onPress={() => {
                bumpHud();
                if (navigation?.canGoBack?.()) navigation.goBack();
                else navigation?.navigate?.('Main', { tab: 'Battles' });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.brandTitle}>BAWAAL</Text>
              <Text style={styles.brandSubtitle} numberOfLines={1}>
                {viewMode === VIEW_DUAL ? 'DUAL FOCUS 1v1' : 'BATTLE BAWAAL ARENA'}
              </Text>
            </TouchableOpacity>

            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{match.timerLabel}</Text>
              <Text style={styles.categoryText} numberOfLines={1}>
                {match.category}
              </Text>
            </View>

            <View style={styles.headerRightCluster}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText} numberOfLines={1}>
                  {rtcJoined ? 'LIVE' : match.spectatorsLabel}
                  {hypeCount > 0 ? ` · 🔥${hypeCount}` : ''}
                </Text>
              </View>
              {!isParticipant ? (
                <TouchableOpacity
                  style={styles.liveRosterPill}
                  onPress={openChallengerRoster}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Live roster ${queue.length} waiting`}
                >
                  <Text style={styles.liveRosterPillText}>
                    ROSTER ({queue.length})
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.rosterTriggerRow}>
            {isHostRole ? (
              <TouchableOpacity
                style={styles.queuedAthletesPill}
                onPress={openChallengerRoster}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Queued athletes ${queue.length}`}
              >
                <Text style={styles.queuedAthletesPillText}>
                  QUEUED ATHLETES ({queue.length})
                </Text>
              </TouchableOpacity>
            ) : isParticipant && isDualFocus ? (
              <TouchableOpacity
                style={styles.showChallengersPill}
                onPress={openChallengerRoster}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Show challengers roster"
              >
                <Text style={styles.showChallengersPillText}>
                  ▦ SHOW CHALLENGERS
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!isParticipant && voteHintVisible ? (
            <Animated.View
              style={[styles.voteHintBanner, { opacity: hintOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.voteHintText}>
                TAP GLOVES TO VOTE · TAP SCREEN TO TOGGLE HUD
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.hudMidTapZone} pointerEvents="none" />

        {/* Spectator-only vote split — athletes must not vote their own bout */}
        {!isParticipant ? (
          <View style={styles.hudBottomBlock} pointerEvents="box-none">
            <View style={styles.pollSection}>
              <View style={styles.pollLabelRow}>
                <TouchableOpacity
                  style={styles.pollHandleHit}
                  activeOpacity={0.8}
                  onPress={() => {
                    bumpHud();
                    setProfileRole('HOST');
                    setProfileAthlete(safeHostAthlete);
                  }}
                >
                  <View style={styles.pollBadgeHost}>
                    <Text style={styles.pollBadgeHostText}>[H]</Text>
                  </View>
                  <Text style={styles.pollHostText} numberOfLines={1}>
                    {safeHostAthlete.handle || '@HOST'}
                  </Text>
                  <Text style={styles.pollTallyHost}>{hostVotesLabel}</Text>
                </TouchableOpacity>

                <Text style={styles.pollPercentMid}>
                  ({hostPercent}%) ⚡ ({rivalPercent}%)
                </Text>

                <TouchableOpacity
                  style={[styles.pollHandleHit, styles.pollHandleHitRight]}
                  activeOpacity={0.8}
                  onPress={() => {
                    bumpHud();
                    setProfileRole('RIVAL');
                    setProfileAthlete(rivalAthlete);
                  }}
                >
                  <Text style={styles.pollTallyRival}>{rivalVotesLabel}</Text>
                  <Text style={styles.pollChallengerText} numberOfLines={1}>
                    {rivalAthlete?.handle || '@RIVAL'}
                  </Text>
                  <View style={styles.pollBadgeRival}>
                    <Text style={styles.pollBadgeRivalText}>[R]</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.pollBarTrack}>
                <Animated.View style={[styles.pollBarHost, { width: hostBarWidth }]}>
                  {hostPercent >= 18 ? (
                    <Text style={styles.pollBarPctHost}>
                      {hostVotesLabel} · {hostPercent}%
                    </Text>
                  ) : null}
                </Animated.View>
                <Animated.View
                  style={[styles.pollBarChallenger, { width: rivalBarWidth }]}
                >
                  {rivalPercent >= 18 ? (
                    <Text style={styles.pollBarPctRival}>
                      {rivalPercent}% · {rivalVotesLabel}
                    </Text>
                  ) : null}
                </Animated.View>
              </View>
            </View>
          </View>
        ) : null}
      </Animated.View>

      <FloatingReactionLayer reactions={floatingReactions || []} />
      </Pressable>

      {/* Athlete Mode — camera tools only (no gloves / no poll). Auto-fades with HUD. */}
      {isParticipant ? (
        <Animated.View
          style={[
            styles.athleteToolsDock,
            {
              bottom: 24 + Math.max(0, insets.bottom || 0),
              opacity: hudOpacity,
            },
          ]}
          pointerEvents={showControls ? 'box-none' : 'none'}
        >
          <ParticipantHudToolbar
            visible
            micMuted={micMuted}
            cameraOff={cameraOff}
            onFlip={() => {
              bumpHud();
              handleFlipCamera();
            }}
            onToggleMic={() => {
              bumpHud();
              handleToggleMic();
            }}
            onToggleCamera={() => {
              bumpHud();
              handleToggleCamera();
            }}
          />
        </Animated.View>
      ) : null}

      {/* Spectator Mode — floating gloves only (no camera tools). */}
      {!isParticipant ? (
        <View
          style={[
            styles.persistentGlovesDock,
            { bottom: Math.max(15, insets.bottom || 0) },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.persistentGlovesTray} pointerEvents="auto">
            <TouchableOpacity
              style={styles.persistentGloveBtn}
              onPress={handleVoteHost}
              activeOpacity={0.75}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel="Vote host"
            >
              <Text style={styles.gloveEmojiFloat}>🥊</Text>
              <Text style={[styles.actionLabel, styles.actionLabelHost]}>
                VOTE HOST
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.persistentGloveBtn}
              onPress={() => {
                bumpHud();
                setBanterOpen(true);
              }}
              activeOpacity={0.75}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel="Open banter"
            >
              <Text style={styles.banterEmojiFloat}>💬</Text>
              <Text style={[styles.actionLabel, styles.actionLabelBanter]}>
                BANTER
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.persistentGloveBtn}
              onPress={handleVoteRival}
              activeOpacity={0.75}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel="Vote rival"
            >
              <Text style={styles.gloveEmojiFloat}>🥊</Text>
              <Text style={[styles.actionLabel, styles.actionLabelRival]}>
                VOTE RIVAL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal
        visible={Boolean(banterOpen)}
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
        visible={Boolean(rosterOpen)}
        host={safeHostAthlete}
        hostMode={isHostRole}
        spectatorMode={!isParticipant}
        queuedCount={queue.length}
        nextUpId={queue[0]?.id || queue[0]?.handle}
        challengers={
          isHostRole
            ? [
                ...queue,
                ...standbyPool.filter(
                  (a) => !queue.some((q) => athleteKey(q) === athleteKey(a))
                ),
              ]
            : !isParticipant
              ? queue.length
                ? queue
                : (challengers?.length ? challengers : DEFAULT_CHALLENGERS).filter(
                    (a) =>
                      athleteKey(a) !== athleteKey(focusedRival)
                  )
              : challengers?.length
                ? challengers
                : DEFAULT_CHALLENGERS
        }
        activeRivalId={focusedRival?.id || focusedRival?.handle}
        onSelectRival={selectRivalFromRoster}
        onSpectate={spectateRival}
        onCallOut={callOutRival}
        onViewGrid={viewGridFromRoster}
        onClose={() => setRosterOpen(false)}
      />
    </View>
  );
}

export default function Live1v1BattleScreen(props) {
  return (
    <ArenaSafeBoundary>
      <Live1v1BattleScreenInner {...props} />
    </ArenaSafeBoundary>
  );
}

const styles = StyleSheet.create({
  rootScreen: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  /** __DEV__ only — floating mock controls; never ships in release UI. */
  devMockBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  devMockBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    paddingTop: 2,
  },
  devMockBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devMockBtnOn: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0,229,255,0.18)',
  },
  devMockBtnSpectator: {
    borderColor: '#FF8A65',
    backgroundColor: 'rgba(255,138,101,0.2)',
  },
  devMockBtnText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tapStage: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
    overflow: 'hidden',
  },
  safeCrashRoot: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 48,
  },
  safeCrashHostPane: {
    flex: 1,
    backgroundColor: PANEL_HOST,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeCrashRivalPane: {
    flex: 1,
    backgroundColor: PANEL_RIVAL,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeCrashLabel: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  safeCrashHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  hudChrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 40,
    elevation: 40,
  },
  persistentGlovesDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 15,
    zIndex: 100,
    elevation: 100,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  persistentGlovesTray: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginHorizontal: 36,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  persistentGloveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
    maxWidth: 110,
    zIndex: 101,
    backgroundColor: 'transparent',
  },
  hudMidTapZone: {
    flex: 1,
    width: '100%',
  },
  hudTopBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  athleteToolsDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 90,
    elevation: 90,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  hudBottomBlock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 40,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderTopWidth: 0,
    shadowOpacity: 0,
    // Poll sits above the 3-item floating dock
    marginBottom: 96,
    paddingBottom: 4,
  },
  voteHintBanner: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  voteHintText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
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
  headerRightCluster: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '42%',
  },
  liveBadge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF0000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
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
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderWidth: 0,
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
  liveRosterPill: {
    backgroundColor: 'rgba(0,229,255,0.14)',
    borderWidth: 1,
    borderColor: CYAN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 132,
    alignItems: 'center',
  },
  liveRosterPillText: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  showChallengersPill: {
    flex: 1,
    backgroundColor: 'rgba(255,87,34,0.14)',
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  showChallengersPillText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  queuedAthletesPill: {
    flex: 1,
    backgroundColor: 'rgba(255,230,0,0.12)',
    borderWidth: 1,
    borderColor: '#FFE600',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  queuedAthletesPillText: {
    color: '#FFE600',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  watchRosterBtn: {
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderWidth: 1,
    borderColor: CYAN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  stageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: PANEL_HOST,
    zIndex: 0,
  },
  fullVideoColumn: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: PANEL_HOST,
  },
  /** Pure 1v1 — host + rival only, no roster grid mounted behind. */
  dualFocusColumn: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  streamPaneShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  spotlightHostWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  panelHost: {
    backgroundColor: PANEL_HOST,
  },
  panelRival: {
    backgroundColor: PANEL_RIVAL,
  },
  hostSpotlight: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  dualPane: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  streamSurface: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Keep native video layers from stealing glove taps at the screen bottom
    pointerEvents: 'none',
  },
  streamSurfaceHost: {
    backgroundColor: 'transparent',
  },
  streamSurfaceRival: {
    backgroundColor: 'transparent',
  },
  /** Live camera / RTC / sim feed — fills the Host or Rival viewport under HUD. */
  cameraLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  streamHint: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  streamFallback: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamFallbackHost: {
    backgroundColor: PANEL_HOST,
  },
  streamFallbackRival: {
    backgroundColor: PANEL_RIVAL,
  },
  rivalSimRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PANEL_RIVAL,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rivalSimScan: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.18)',
  },
  participantHudHidden: {
    height: 0,
    overflow: 'hidden',
  },
  handleAnchorInPane: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    maxWidth: '70%',
    backgroundColor: 'transparent',
  },
  statsAnchorHost: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    elevation: 10,
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: 'transparent',
  },
  handlePillWrap: {
    maxWidth: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  handlePillWrapHost: {
    borderColor: 'rgba(255,87,34,0.65)',
  },
  handlePillWrapRival: {
    borderColor: 'rgba(0,229,255,0.65)',
  },
  handlePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  handleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  handleBadgeHost: {
    borderColor: 'rgba(255,87,34,0.65)',
  },
  handleBadgeRival: {
    borderColor: 'rgba(0,229,255,0.65)',
  },
  roleIdBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleIdBadgeHost: {
    backgroundColor: 'rgba(255,87,34,0.22)',
  },
  roleIdBadgeRival: {
    backgroundColor: 'rgba(0,229,255,0.18)',
  },
  roleIdBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  roleIdBadgeTextHost: {
    color: ORANGE,
  },
  roleIdBadgeTextRival: {
    color: CYAN,
  },
  flagText: {
    fontSize: 13,
    marginRight: 6,
  },
  handleText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 12,
    flexShrink: 1,
    letterSpacing: 0.2,
  },
  paneLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  challengerRepsBadge: {
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    zIndex: 10,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
    zIndex: 60,
    elevation: 60,
    pointerEvents: 'none',
  },
  floatingItem: {
    position: 'absolute',
    bottom: '22%',
  },
  floatingToastItem: {
    position: 'absolute',
    bottom: 118,
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
  floatingToastPill: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: SCREEN_W - 48,
    alignSelf: 'center',
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
    paddingVertical: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    fontSize: 11,
    flexShrink: 1,
  },
  pollChallengerText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 11,
    flexShrink: 1,
    textAlign: 'right',
  },
  pollTallyHost: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 2,
  },
  pollTallyRival: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '900',
    marginRight: 2,
  },
  pollPercentMid: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    flexShrink: 0,
    paddingHorizontal: 2,
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
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  gloveChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  gloveChipHost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  gloveChipRival: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  gloveEmoji: {
    fontSize: 18,
  },
  gloveEmojiFloat: {
    fontSize: 28,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  banterEmojiFloat: {
    fontSize: 26,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
    backgroundColor: 'transparent',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionLabelHost: { color: ORANGE },
  actionLabelRival: { color: '#00E5FF' },
  actionLabelBanter: { color: WHITE },
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
