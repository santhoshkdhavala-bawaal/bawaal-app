/**
 * BAWAAL Live Match Telecast — Phase 1 room (Host + Viewer).
 * Option A: Host = real CameraView preview; Viewer = HOST IS LIVE stage
 * with // PHASE 2: LIVE_VIDEO_STREAM_SLOT for LiveKit/Agora later.
 *
 * Clean HUD: compact top score pill (no top skulls), host side score skulls,
 * slim banter bar + single flaming-skull tray trigger.
 * Theme: #08120F / #FF5A1F / #E53935
 */
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Animated,
  Easing,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BawaalEmoji } from './components/BawaalEmoji';
import {
  fetchLiveMatch,
  joinLiveMatchRoom,
  updateMatchScore,
  updateMatchCricket,
  endLiveMatch,
  broadcastBanter,
  broadcastReaction,
  broadcastVotePulse,
  pushBanterCapped,
  formatCricketOvers,
  isCricketSport,
  canUserScoreMatch,
} from './src/services/liveMatchService';
import { getActiveUser } from './src/services/activeUserProfile';
import {
  SKULL_TEAM_A,
  SKULL_TEAM_B,
} from './src/constants/liveMatchTeamSkulls';
import {
  LIVE_MATCH_FLAMING_SKULLS,
  SKULL_FIRE,
} from './src/constants/liveMatchFlamingSkulls';
import LiveMatchInviteModal from './src/components/LiveMatchInviteModal';

const BG = '#08120F';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const TEAM_A_GLOW = '#FF2A2A';
const TEAM_B_GLOW = '#2A7BFF';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const PANEL = 'rgba(8,18,15,0.78)';

/** Single-tap live reaction burst — short-lived, never loops. */
const LIVE_REACTION_BURST_MS = 1500;
const LIVE_REACTION_CLEANUP_MS = 1800;
const LIVE_REACTION_MAX_PARTICLES = 3;
const LIVE_BANTER_TTL_MS = 4500;
const LIVE_BANTER_VISIBLE_CAP = 4;

let liveBurstSeq = 0;

function createLiveMatchReactionBurst(emojiKey) {
  const key = String(emojiKey || 'skull_fire').toLowerCase();
  const count = 2;
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    liveBurstSeq += 1;
    particles.push({
      id: `live-rx-${Date.now()}-${liveBurstSeq}-${i}`,
      emojiKey: key,
      targetX: (Math.random() - 0.5) * 110,
      kickY: 18 + Math.random() * 10,
      floatY: -160 - Math.random() * 40,
      delay: i * 40,
      duration: LIVE_REACTION_BURST_MS,
      size: 44 + Math.floor((Math.random() - 0.5) * 8),
    });
  }
  return particles;
}

const LiveReactionParticle = memo(function LiveReactionParticle({
  id,
  emojiKey,
  targetX,
  kickY,
  floatY,
  delay,
  duration,
  size,
  originX,
  originY,
  onDone,
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    const wait = Math.max(0, delay || 0);
    const life = Math.min(
      LIVE_REACTION_BURST_MS + 300,
      Math.max(1200, duration || LIVE_REACTION_BURST_MS)
    );
    const cleanupMs = Math.min(
      LIVE_REACTION_CLEANUP_MS + 200,
      wait + life + 120
    );
    const anim = Animated.sequence([
      Animated.delay(wait),
      Animated.timing(progress, {
        toValue: 1,
        duration: life,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    const cleanupTimer = setTimeout(() => {
      onDone?.(id);
    }, cleanupMs);
    return () => {
      anim.stop();
      clearTimeout(cleanupTimer);
    };
  }, [progress, id, onDone, delay, duration]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.72, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [0.45, 1.12, 1],
    extrapolate: 'clamp',
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX || 0],
    extrapolate: 'clamp',
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.16, 1],
    outputRange: [0, Math.abs(kickY || 20), floatY || -160],
    extrapolate: 'clamp',
  });
  const dim = typeof size === 'number' && size > 0 ? size : 44;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: originX - dim / 2,
        top: originY - dim / 2,
        width: dim,
        height: dim,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <BawaalEmoji name={emojiKey || 'skull_fire'} size={dim} />
    </Animated.View>
  );
});

const LiveReactionBurstLayer = memo(function LiveReactionBurstLayer({
  particles,
  onParticleDone,
}) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const originX = bounds.width / 2;
  const originY = bounds.height * 0.55;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e?.nativeEvent?.layout || {};
        if (width > 0 && height > 0) {
          setBounds((prev) =>
            prev.width === width && prev.height === height
              ? prev
              : { width, height }
          );
        }
      }}
      style={StyleSheet.absoluteFillObject}
    >
      {(particles || []).slice(-LIVE_REACTION_MAX_PARTICLES * 2).map((p) => (
        <LiveReactionParticle
          key={p.id}
          {...p}
          originX={originX}
          originY={originY}
          onDone={onParticleDone}
        />
      ))}
    </View>
  );
});

/** Show team name exactly as entered (trimmed); fallback if blank. */
function displayTeamName(raw, fallback) {
  const t = String(raw || '').trim();
  return t || fallback;
}

function PulsingLiveChip({ label = 'LIVE' }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  return (
    <View style={styles.liveChip}>
      <Animated.View style={[styles.liveDot, { opacity }]} />
      <Text style={styles.liveChipText}>{label}</Text>
    </View>
  );
}

/**
 * Compact top score pill — names + scores only (no skulls / large cards).
 */
function CompactScorePill({ teamA, teamB, scoreA, scoreB }) {
  const nameA = displayTeamName(teamA, 'TEAM A');
  const nameB = displayTeamName(teamB, 'TEAM B');
  return (
    <View style={styles.scorePill} accessibilityRole="text">
      <Text
        style={[styles.scorePillName, { color: TEAM_A_GLOW }]}
        numberOfLines={1}
      >
        {nameA}
      </Text>
      <Text style={styles.scorePillNums} numberOfLines={1}>
        {scoreA} — {scoreB}
      </Text>
      <Text
        style={[styles.scorePillName, { color: TEAM_B_GLOW }]}
        numberOfLines={1}
      >
        {nameB}
      </Text>
    </View>
  );
}

/**
 * Cricket top bar: BATTING  RUNS/WICKETS (O.B)  vs  bowling side.
 */
function CricketScorePill({
  teamA,
  teamB,
  battingTeam,
  runsA,
  wicketsA,
  ballsA,
  runsB,
  wicketsB,
  ballsB,
  canSwap,
  onSwapBatting,
}) {
  const nameA = displayTeamName(teamA, 'TEAM A');
  const nameB = displayTeamName(teamB, 'TEAM B');
  const battingIsA = battingTeam !== 'B';
  const batName = battingIsA ? nameA : nameB;
  const bowlName = battingIsA ? nameB : nameA;
  const batColor = battingIsA ? TEAM_A_GLOW : TEAM_B_GLOW;
  const bowlColor = battingIsA ? TEAM_B_GLOW : TEAM_A_GLOW;
  const runs = battingIsA ? runsA : runsB;
  const wickets = battingIsA ? wicketsA : wicketsB;
  const balls = battingIsA ? ballsA : ballsB;
  const overs = formatCricketOvers(balls);

  return (
    <View style={styles.cricketScoreWrap}>
      <View style={styles.scorePill} accessibilityRole="text">
        <Text style={[styles.scorePillName, { color: batColor }]} numberOfLines={1}>
          {batName}
        </Text>
        <Text style={styles.scorePillNums} numberOfLines={1}>
          {runs}/{wickets} ({overs})
        </Text>
        <Text style={styles.cricketVsMuted}>vs</Text>
        <Text
          style={[styles.scorePillName, { color: bowlColor }]}
          numberOfLines={1}
        >
          {bowlName}
        </Text>
      </View>
      {canSwap ? (
        <TouchableOpacity
          style={styles.swapBattingBtn}
          onPress={onSwapBatting}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Swap batting team"
        >
          <Text style={styles.swapBattingText}>SWAP BATTING</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Host-only one-thumb cricket scorer pad. */
function CricketScorerPad({ onRuns, onDot, onWicket, onUndo, canUndo }) {
  return (
    <View style={styles.cricketPad}>
      <View style={styles.cricketRunRow}>
        {[1, 2, 4, 6].map((n) => (
          <TouchableOpacity
            key={`run-${n}`}
            style={styles.cricketRunBtn}
            onPress={() => onRuns?.(n)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Plus ${n} runs`}
          >
            <Text style={styles.cricketRunBtnText}>+{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.cricketActionRow}>
        <TouchableOpacity
          style={[styles.cricketActionBtn, styles.cricketDotBtn]}
          onPress={onDot}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Dot ball"
        >
          <Text style={styles.cricketActionText}>DOT / +1 BALL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cricketActionBtn, styles.cricketWicketBtn]}
          onPress={onWicket}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Wicket"
        >
          <Text style={styles.cricketActionText}>WICKET</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.cricketActionBtn,
            styles.cricketUndoBtn,
            !canUndo && styles.cricketBtnDisabled,
          ]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Undo last cricket score"
        >
          <Text style={styles.cricketActionText}>UNDO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function snapshotCricket(match) {
  return {
    batting_team: match?.batting_team === 'B' ? 'B' : 'A',
    cricket_runs_a: Math.max(0, Number(match?.cricket_runs_a) || 0),
    cricket_wickets_a: Math.max(0, Number(match?.cricket_wickets_a) || 0),
    cricket_balls_a: Math.max(0, Number(match?.cricket_balls_a) || 0),
    cricket_runs_b: Math.max(0, Number(match?.cricket_runs_b) || 0),
    cricket_wickets_b: Math.max(0, Number(match?.cricket_wickets_b) || 0),
    cricket_balls_b: Math.max(0, Number(match?.cricket_balls_b) || 0),
  };
}

/**
 * Host/scorer +1 control — static Image skull (Metro-bundled), never wide text bars.
 * Left = red Team A · Right = blue Team B. Score names live on the top pill only.
 */
function HornedSkullScoreButton({ side, teamName, onPress }) {
  const isA = side === 'A';
  const skull = isA ? SKULL_TEAM_A : SKULL_TEAM_B;
  const glow = isA ? TEAM_A_GLOW : TEAM_B_GLOW;
  const name = displayTeamName(teamName, isA ? 'TEAM A' : 'TEAM B');
  const [scale] = useState(() => new Animated.Value(1));
  const [glowOp] = useState(() => new Animated.Value(0.35));
  const [imgFailed, setImgFailed] = useState(false);

  const handlePress = useCallback(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 85,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 170,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowOp, {
          toValue: 1,
          duration: 85,
          useNativeDriver: true,
        }),
        Animated.timing(glowOp, {
          toValue: 0.35,
          duration: 240,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    onPress?.();
  }, [onPress, scale, glowOp]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`Score plus one for ${name}`}
      style={styles.skullBtnHit}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.skullBtnGlow,
          {
            backgroundColor: glow,
            opacity: glowOp,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        {imgFailed ? (
          <View style={[styles.skullBtnFallback, { borderColor: glow }]}>
            <Text style={[styles.skullBtnFallbackText, { color: glow }]}>
              +1
            </Text>
          </View>
        ) : (
          <Image
            source={skull}
            style={styles.skullBtnImage}
            resizeMode="contain"
            onError={() => setImgFailed(true)}
            accessibilityIgnoresInvertColors
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function VoteTugBar({ votesA, votesB, teamA, teamB, onVoteA, onVoteB }) {
  const total = Math.max(1, votesA + votesB);
  const pctA = Math.round((votesA / total) * 100);
  const pctB = 100 - pctA;
  const nameA = displayTeamName(teamA, 'TEAM A');
  const nameB = displayTeamName(teamB, 'TEAM B');
  return (
    <View style={styles.voteBlock}>
      <View style={styles.voteBtns}>
        <TouchableOpacity
          style={[styles.voteBtn, styles.voteBtnA]}
          onPress={onVoteA}
          activeOpacity={0.88}
          accessibilityLabel={`Vote ${nameA}`}
        >
          <Image
            source={SKULL_TEAM_A}
            style={styles.voteSkull}
            resizeMode="contain"
          />
          <Text style={styles.voteBtnText}>VOTE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteBtn, styles.voteBtnB]}
          onPress={onVoteB}
          activeOpacity={0.88}
          accessibilityLabel={`Vote ${nameB}`}
        >
          <Image
            source={SKULL_TEAM_B}
            style={styles.voteSkull}
            resizeMode="contain"
          />
          <Text style={styles.voteBtnText}>VOTE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tugTrack}>
        <View style={[styles.tugA, { flex: Math.max(pctA, 4) }]} />
        <View style={[styles.tugB, { flex: Math.max(pctB, 4) }]} />
      </View>
      <View style={styles.tugLabels}>
        <Text style={styles.tugPct}>{pctA}%</Text>
        <Text style={styles.tugPct}>{pctB}%</Text>
      </View>
    </View>
  );
}

/**
 * Viewer center stage — Option A placeholder.
 * PHASE 2: replace / fill LIVE_VIDEO_STREAM_SLOT with LiveKit / Agora player.
 */
function ViewerVideoStage({ sport, title }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const signalOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <View style={styles.viewerStage}>
      {/* PHASE 2: LIVE_VIDEO_STREAM_SLOT — LiveKit / Agora remote stream mounts here */}
      <View
        style={styles.liveVideoStreamSlot}
        accessibilityLabel="Live video stream slot phase 2"
      >
        <Text style={styles.hostIsLive}>HOST IS LIVE</Text>
        <Animated.View style={[styles.signalRow, { opacity: signalOpacity }]}>
          <View style={styles.signalDot} />
          <Text style={styles.signalText}>LIVE SIGNAL</Text>
        </Animated.View>
        <Text style={styles.stageSport}>{sport || 'MATCH'}</Text>
        {title ? (
          <Text style={styles.stageTitle} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.phase2Hint}>
          Phase 2 stream slot ready · LiveKit / Agora
        </Text>
      </View>
    </View>
  );
}

function HostCameraStage({ facing }) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.cameraFallback}>
        <Text style={styles.cameraFallbackText}>Requesting camera…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.cameraFallback}>
        <Text style={styles.cameraFallbackText}>
          Camera permission needed to go live
        </Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={() => requestPermission()}
        >
          <Text style={styles.permBtnText}>ALLOW CAMERA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <CameraView style={StyleSheet.absoluteFill} facing={facing} mute />
  );
}

function LiveMatchRoomScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialMatch = route?.params?.match || null;
  const matchId = String(
    route?.params?.matchId || initialMatch?.id || ''
  ).trim();

  const user = getActiveUser();
  const handle = String(user?.handle || user?.username || 'fan').replace(
    /^@/,
    ''
  );
  const userId = String(user?.id || user?.userId || '').trim();

  // Host = telecast starter (camera). Scorer role alone does not grant host camera.
  const roleParam = String(route?.params?.role || '').toLowerCase();
  const isHostParam =
    roleParam === 'host' || route?.params?.isHost === true;

  const [match, setMatch] = useState(initialMatch);
  const [watching, setWatching] = useState(1);
  const [facing, setFacing] = useState('back');
  const [endConfirm, setEndConfirm] = useState(false);
  const [banter, setBanter] = useState([]);
  const [banterDraft, setBanterDraft] = useState('');
  const [skullTrayOpen, setSkullTrayOpen] = useState(false);
  const [burstParticles, setBurstParticles] = useState([]);
  const [votesA, setVotesA] = useState(Number(initialMatch?.votes_a) || 0);
  const [votesB, setVotesB] = useState(Number(initialMatch?.votes_b) || 0);
  const seenReactionsRef = useRef(new Set());
  const reactionBusyRef = useRef(false);
  const cricketUndoRef = useRef([]);
  const [cricketUndoDepth, setCricketUndoDepth] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

  const scoreActor = useMemo(
    () => ({
      id: userId,
      userId,
      handle,
      username: user?.username,
      displayName: user?.displayName,
      name: user?.name,
    }),
    [userId, handle, user?.username, user?.displayName, user?.name]
  );

  const spawnReactionBurst = useCallback((data) => {
    const key = String(data?.emojiKey || 'skull_fire').trim();
    if (!key) return;
    const rid = String(
      data?.reactionId ||
        `${data?.at || ''}|${data?.handle || ''}|${key}`
    );
    if (!rid || seenReactionsRef.current.has(rid)) return;
    seenReactionsRef.current.add(rid);
    if (seenReactionsRef.current.size > 40) {
      const keep = Array.from(seenReactionsRef.current).slice(-20);
      seenReactionsRef.current = new Set(keep);
    }
    // Replace active burst — never stack endless spawn loops
    setBurstParticles(createLiveMatchReactionBurst(key));
  }, []);

  const teamA = match?.team_a_name || 'TEAM A';
  const teamB = match?.team_b_name || 'TEAM B';
  const scoreA = match?.score_a ?? 0;
  const scoreB = match?.score_b ?? 0;
  const hasScoreboard = match?.has_scoreboard !== false;
  const cricketMode = isCricketSport(match?.sport) && hasScoreboard;
  const battingTeam = match?.batting_team === 'B' ? 'B' : 'A';
  const cricketRunsA = Math.max(0, Number(match?.cricket_runs_a) || 0);
  const cricketWicketsA = Math.max(0, Number(match?.cricket_wickets_a) || 0);
  const cricketBallsA = Math.max(0, Number(match?.cricket_balls_a) || 0);
  const cricketRunsB = Math.max(0, Number(match?.cricket_runs_b) || 0);
  const cricketWicketsB = Math.max(0, Number(match?.cricket_wickets_b) || 0);
  const cricketBallsB = Math.max(0, Number(match?.cricket_balls_b) || 0);
  const adminLabel = String(
    match?.admin_name || match?.scorer_name || match?.host_handle || ''
  )
    .replace(/^@/, '')
    .trim();
  const isHost =
    isHostParam ||
    (!!userId &&
      !!match?.host_id &&
      String(match.host_id) === userId);
  const isDesignatedAdmin = Boolean(
    match && !isHost && canUserScoreMatch(match, scoreActor)
  );
  const role = isHost ? 'host' : 'viewer';
  /** Only telecast host or designated admin may punch scores — never audience. */
  const canScore = Boolean(isHost || isDesignatedAdmin);

  useEffect(() => {
    let alive = true;
    if (!match && matchId) {
      fetchLiveMatch(matchId).then((m) => {
        if (alive && m) {
          setMatch(m);
          setVotesA(m.votes_a || 0);
          setVotesB(m.votes_b || 0);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [match, matchId]);

  useEffect(() => {
    if (!matchId) return undefined;
    const unsub = joinLiveMatchRoom(matchId, {
      role,
      onScore: (m) => {
        if (m) {
          setMatch((prev) => ({ ...(prev || {}), ...m }));
          if (m.votes_a != null) setVotesA(m.votes_a);
          if (m.votes_b != null) setVotesB(m.votes_b);
        }
      },
      onStatus: (m) => {
        if (m) setMatch((prev) => ({ ...(prev || {}), ...m }));
        if (m?.status === 'ended' && role === 'viewer') {
          navigation?.goBack?.();
        }
      },
      onBanter: (data) => {
        setBanter((prev) =>
          pushBanterCapped(prev, {
            ...data,
            at: data?.at || Date.now(),
          }, LIVE_BANTER_VISIBLE_CAP)
        );
      },
      onReaction: (data) => {
        spawnReactionBurst(data);
      },
      onVotePulse: (data) => {
        if (data?.team === 'B') setVotesB((v) => v + 1);
        else setVotesA((v) => v + 1);
      },
      onPresence: (count) => {
        setWatching(Math.max(1, Number(count) || 1));
      },
    });
    return () => {
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [matchId, role, navigation, spawnReactionBurst]);

  // Auto-expire center banter bubbles so the camera stays readable
  useEffect(() => {
    if (!banter.length) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setBanter((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (b) => now - Number(b?.at || 0) < LIVE_BANTER_TTL_MS
        )
      );
    }, 700);
    return () => clearInterval(timer);
  }, [banter.length]);

  const bumpScore = useCallback(
    async (side, delta) => {
      if (!canScore || !hasScoreboard || !matchId || cricketMode) return;
      const nextA = side === 'A' ? Math.max(0, scoreA + delta) : scoreA;
      const nextB = side === 'B' ? Math.max(0, scoreB + delta) : scoreB;
      setMatch((prev) => ({
        ...(prev || {}),
        score_a: nextA,
        score_b: nextB,
      }));
      await updateMatchScore(
        matchId,
        { score_a: nextA, score_b: nextB },
        scoreActor
      );
    },
    [
      canScore,
      hasScoreboard,
      matchId,
      scoreA,
      scoreB,
      cricketMode,
      scoreActor,
    ]
  );

  const pushCricketUndo = useCallback((snap) => {
    cricketUndoRef.current = [...cricketUndoRef.current, snap].slice(-24);
    setCricketUndoDepth(cricketUndoRef.current.length);
  }, []);

  const commitCricket = useCallback(
    async (nextSnap, { pushUndo = true } = {}) => {
      if (!canScore || !hasScoreboard || !matchId || !cricketMode) return;
      if (pushUndo) pushCricketUndo(snapshotCricket(match));
      const patch = {
        ...nextSnap,
        score_a: nextSnap.cricket_runs_a,
        score_b: nextSnap.cricket_runs_b,
      };
      setMatch((prev) => ({ ...(prev || {}), ...patch }));
      await updateMatchCricket(matchId, patch, scoreActor);
    },
    [
      canScore,
      hasScoreboard,
      matchId,
      cricketMode,
      match,
      pushCricketUndo,
      scoreActor,
    ]
  );

  const applyCricketBall = useCallback(
    async ({ runs = 0, wicket = false } = {}) => {
      if (!canScore || !hasScoreboard || !matchId || !cricketMode) return;
      const bat = battingTeam === 'B' ? 'B' : 'A';
      const snap = snapshotCricket(match);
      if (bat === 'A') {
        snap.cricket_runs_a += Math.max(0, Number(runs) || 0);
        if (wicket) {
          snap.cricket_wickets_a = Math.min(10, snap.cricket_wickets_a + 1);
        }
        snap.cricket_balls_a += 1;
      } else {
        snap.cricket_runs_b += Math.max(0, Number(runs) || 0);
        if (wicket) {
          snap.cricket_wickets_b = Math.min(10, snap.cricket_wickets_b + 1);
        }
        snap.cricket_balls_b += 1;
      }
      await commitCricket(snap);
    },
    [
      canScore,
      hasScoreboard,
      matchId,
      cricketMode,
      battingTeam,
      match,
      commitCricket,
    ]
  );

  const swapBatting = useCallback(async () => {
    if (!canScore || !hasScoreboard || !matchId || !cricketMode) return;
    const snap = snapshotCricket(match);
    snap.batting_team = snap.batting_team === 'B' ? 'A' : 'B';
    await commitCricket(snap);
  }, [canScore, hasScoreboard, matchId, cricketMode, match, commitCricket]);

  const undoCricket = useCallback(async () => {
    if (!canScore || !hasScoreboard || !matchId || !cricketMode) return;
    const prev = cricketUndoRef.current.pop();
    setCricketUndoDepth(cricketUndoRef.current.length);
    if (!prev) return;
    setMatch((m) => ({ ...(m || {}), ...prev }));
    await updateMatchCricket(matchId, prev, scoreActor);
  }, [canScore, hasScoreboard, matchId, cricketMode, scoreActor]);

  const handleEnd = useCallback(async () => {
    setEndConfirm(false);
    if (matchId) await endLiveMatch(matchId);
    navigation?.goBack?.();
  }, [matchId, navigation]);

  const sendBanter = useCallback(async () => {
    const text = banterDraft.trim();
    if (!text || !matchId) return;
    setBanterDraft('');
    await broadcastBanter(matchId, { handle, message: text });
  }, [banterDraft, matchId, handle]);

  const fireFlamingSkull = useCallback(
    async (skull) => {
      if (!matchId || !skull?.emojiKey || reactionBusyRef.current) return;
      reactionBusyRef.current = true;
      setSkullTrayOpen(false);
      try {
        await broadcastReaction(matchId, {
          emojiKey: skull.emojiKey,
          handle,
          label: skull.label || skull.id,
        });
      } finally {
        setTimeout(() => {
          reactionBusyRef.current = false;
        }, 350);
      }
    },
    [matchId, handle]
  );

  const vote = useCallback(
    async (team) => {
      if (!matchId) return;
      await broadcastVotePulse(matchId, { team, handle });
    },
    [matchId, handle]
  );

  const latestBanter = useMemo(
    () => banter.slice(-LIVE_BANTER_VISIBLE_CAP),
    [banter]
  );

  if (!matchId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.errText}>Match not found</Text>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.leaveLink}>Leave</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.stage}>
        {role === 'host' ? (
          <HostCameraStage facing={facing} />
        ) : (
          <ViewerVideoStage sport={match?.sport} title={match?.title} />
        )}

        <LiveReactionBurstLayer
          particles={burstParticles}
          onParticleDone={(id) => {
            setBurstParticles((prev) => prev.filter((p) => p.id !== id));
          }}
        />

        {/* Top HUD */}
        <View
          style={[styles.topHud, { paddingTop: Math.max(insets.top, 10) + 4 }]}
          pointerEvents="box-none"
        >
          <View style={styles.topLeft}>
            <PulsingLiveChip />
            <View style={styles.watchChip}>
              <Ionicons name="eye-outline" size={14} color={WHITE} />
              <Text style={styles.watchCount}>{watching}</Text>
            </View>
          </View>
          {hasScoreboard ? (
            <View style={styles.scoreboardHud}>
              {cricketMode ? (
                <CricketScorePill
                  teamA={teamA}
                  teamB={teamB}
                  battingTeam={battingTeam}
                  runsA={cricketRunsA}
                  wicketsA={cricketWicketsA}
                  ballsA={cricketBallsA}
                  runsB={cricketRunsB}
                  wicketsB={cricketWicketsB}
                  ballsB={cricketBallsB}
                  canSwap={canScore}
                  onSwapBatting={swapBatting}
                />
              ) : (
                <CompactScorePill
                  teamA={teamA}
                  teamB={teamB}
                  scoreA={scoreA}
                  scoreB={scoreB}
                />
              )}
              {adminLabel ? (
                <Text style={styles.adminChip} numberOfLines={1}>
                  ADMIN @{adminLabel}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.telecastHud}>
              <Text style={styles.telecastHudSport} numberOfLines={1}>
                {String(match?.sport || 'LIVE').toUpperCase()}
              </Text>
              {match?.title ? (
                <Text style={styles.telecastHudTitle} numberOfLines={1}>
                  {match.title}
                </Text>
              ) : (
                <Text style={styles.telecastHudTitle} numberOfLines={1}>
                  LIVE TELECAST
                </Text>
              )}
            </View>
          )}
          <View style={styles.topRight}>
            {role === 'host' ? (
              <>
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={() => setInviteOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Invite friends"
                >
                  <Text style={styles.inviteBtnText}>INVITE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() =>
                    setFacing((f) => (f === 'back' ? 'front' : 'back'))
                  }
                  accessibilityLabel="Flip camera"
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={20}
                    color={WHITE}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.endBtn}
                  onPress={() => setEndConfirm(true)}
                  accessibilityLabel="End match"
                >
                  <Text style={styles.endBtnText}>END</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation?.goBack?.()}
                accessibilityLabel="Leave match"
              >
                <Ionicons name="close" size={22} color={WHITE} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Center banter stream */}
        <View style={styles.banterTicker} pointerEvents="none">
          <View style={styles.banterCenterCol}>
            {latestBanter.map((b, i) => (
              <Text
                key={`${b.reactionId || b.at || i}-${b.message}`}
                style={styles.banterLine}
                numberOfLines={2}
              >
                <Text style={styles.banterHandle}>@{b.handle || 'fan'}</Text>
                {'  '}
                {b.message}
              </Text>
            ))}
          </View>
        </View>

        {/* Bottom controls */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.bottomHud,
            { paddingBottom: Math.max(insets.bottom, 10) + 8 },
          ]}
        >
          {canScore && hasScoreboard && cricketMode ? (
            <CricketScorerPad
              onRuns={(n) => applyCricketBall({ runs: n })}
              onDot={() => applyCricketBall({ runs: 0 })}
              onWicket={() => applyCricketBall({ runs: 0, wicket: true })}
              onUndo={undoCricket}
              canUndo={cricketUndoDepth > 0}
            />
          ) : null}
          {canScore && hasScoreboard && !cricketMode ? (
            <View style={styles.hostScoreRow}>
              <View style={styles.hostScoreCol}>
                <HornedSkullScoreButton
                  side="A"
                  teamName={teamA}
                  onPress={() => bumpScore('A', 1)}
                />
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => bumpScore('A', -1)}
                  accessibilityLabel="Undo Team A point"
                >
                  <Text style={styles.undoText}>−1</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.hostScoreSpacer} />
              <View style={styles.hostScoreCol}>
                <HornedSkullScoreButton
                  side="B"
                  teamName={teamB}
                  onPress={() => bumpScore('B', 1)}
                />
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => bumpScore('B', -1)}
                  accessibilityLabel="Undo Team B point"
                >
                  <Text style={styles.undoText}>−1</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {!canScore && hasScoreboard ? (
            <VoteTugBar
              votesA={votesA}
              votesB={votesB}
              teamA={teamA}
              teamB={teamB}
              onVoteA={() => vote('A')}
              onVoteB={() => vote('B')}
            />
          ) : null}

          {/* Slim banter strip + single skull tray trigger */}
          <View style={styles.banterRow}>
            <View style={styles.skullTriggerWrap}>
              {skullTrayOpen ? (
                <View style={styles.skullPopupTray}>
                  {LIVE_MATCH_FLAMING_SKULLS.map((skull) => (
                    <TouchableOpacity
                      key={skull.id}
                      style={styles.skullPopupBtn}
                      onPress={() => fireFlamingSkull(skull)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`${skull.label} skull reaction`}
                    >
                      <Image
                        source={skull.source}
                        style={styles.skullPopupIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.skullPopupLabel}>{skull.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.skullTriggerBtn,
                  skullTrayOpen && styles.skullTriggerBtnOpen,
                ]}
                onPress={() => setSkullTrayOpen((v) => !v)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityState={{ expanded: skullTrayOpen }}
                accessibilityLabel="Open skull reactions"
              >
                <Image
                  source={SKULL_FIRE}
                  style={styles.skullTriggerIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.banterBar}>
              <TextInput
                style={styles.banterInput}
                value={banterDraft}
                onChangeText={setBanterDraft}
                placeholder="Banter…"
                placeholderTextColor={MUTED}
                maxLength={160}
                returnKeyType="send"
                onSubmitEditing={sendBanter}
                onFocus={() => setSkullTrayOpen(false)}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={sendBanter}
                accessibilityLabel="Send banter"
              >
                <Ionicons name="send" size={14} color={WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      <LiveMatchInviteModal
        visible={inviteOpen && role === 'host'}
        match={match}
        onClose={() => setInviteOpen(false)}
      />

      <Modal visible={endConfirm} transparent animationType="fade">
        <View style={styles.confirmScrim}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>END MATCH?</Text>
            <Text style={styles.confirmBody}>
              This stops the live telecast for all viewers.
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setEndConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmEnd} onPress={handleEnd}>
                <Text style={styles.confirmEndText}>END MATCH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  stage: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    padding: 24,
  },
  cameraFallbackText: {
    color: MUTED,
    textAlign: 'center',
    marginBottom: 14,
  },
  permBtn: {
    backgroundColor: CRIMSON,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  permBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
  },
  viewerStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  liveVideoStreamSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.18)',
  },
  hostIsLive: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 14,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  signalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CRIMSON,
  },
  signalText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  stageSport: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  stageTitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  phase2Hint: {
    color: 'rgba(148,163,184,0.55)',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    zIndex: 20,
  },
  topLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    minWidth: 72,
  },
  topRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 72,
  },
  scoreboardHud: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    maxWidth: 320,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(8,18,15,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
  },
  scorePillName: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    maxWidth: 88,
  },
  scorePillNums: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cricketScoreWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 5,
  },
  cricketVsMuted: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
  },
  swapBattingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,90,31,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.45)',
  },
  swapBattingText: {
    color: ORANGE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cricketPad: {
    gap: 8,
    marginBottom: 2,
  },
  cricketRunRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cricketRunBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,18,15,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.55)',
  },
  cricketRunBtnText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
  },
  cricketActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cricketActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  cricketDotBtn: {
    backgroundColor: 'rgba(8,18,15,0.88)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  cricketWicketBtn: {
    backgroundColor: 'rgba(229,57,53,0.35)',
    borderColor: CRIMSON,
  },
  cricketUndoBtn: {
    backgroundColor: 'rgba(8,18,15,0.88)',
    borderColor: 'rgba(148,163,184,0.45)',
  },
  cricketBtnDisabled: {
    opacity: 0.4,
  },
  cricketActionText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  adminChip: {
    marginTop: 4,
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  telecastHud: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    maxWidth: 220,
  },
  telecastHudSport: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  telecastHudTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CRIMSON,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  liveChipText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
  },
  watchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PANEL,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  watchCount: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  endBtn: {
    backgroundColor: CRIMSON,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  endBtnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
  },
  inviteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,90,31,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.55)',
  },
  inviteBtnText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  banterTicker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 72,
    zIndex: 15,
  },
  banterCenterCol: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 6,
  },
  banterLine: {
    color: WHITE,
    fontSize: 13,
    backgroundColor: PANEL,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    textAlign: 'center',
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  banterHandle: {
    color: ORANGE,
    fontWeight: '900',
  },
  bottomHud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    gap: 10,
    zIndex: 25,
  },
  hostScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  hostScoreCol: {
    width: 96,
    alignItems: 'center',
    gap: 6,
  },
  hostScoreSpacer: {
    flex: 1,
  },
  skullBtnHit: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  skullBtnGlow: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  skullBtnImage: {
    width: 92,
    height: 92,
  },
  skullBtnFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  skullBtnFallbackText: {
    fontSize: 22,
    fontWeight: '900',
  },
  undoBtn: {
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
  },
  undoText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },
  voteBlock: {
    gap: 8,
  },
  voteBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnA: {
    backgroundColor: 'rgba(255,42,42,0.22)',
    borderWidth: 1,
    borderColor: TEAM_A_GLOW,
  },
  voteBtnB: {
    backgroundColor: 'rgba(42,123,255,0.22)',
    borderWidth: 1,
    borderColor: TEAM_B_GLOW,
  },
  voteSkull: {
    width: 48,
    height: 48,
  },
  voteBtnText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tugTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tugA: {
    backgroundColor: TEAM_A_GLOW,
  },
  tugB: {
    backgroundColor: TEAM_B_GLOW,
  },
  tugLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tugPct: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  banterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skullTriggerWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  skullTriggerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,18,15,0.72)',
  },
  skullTriggerBtnOpen: {
    backgroundColor: 'rgba(255,90,31,0.22)',
  },
  skullTriggerIcon: {
    width: 28,
    height: 28,
  },
  skullPopupTray: {
    position: 'absolute',
    left: 0,
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,15,0.55)',
  },
  skullPopupBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  skullPopupIcon: {
    width: 36,
    height: 36,
  },
  skullPopupLabel: {
    color: MUTED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  banterBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PANEL,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingLeft: 12,
    paddingRight: 3,
    minHeight: 36,
    maxHeight: 36,
  },
  banterInput: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    paddingVertical: 0,
    height: 34,
    outlineStyle: 'none',
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CRIMSON,
  },
  confirmScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: BG,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
  },
  confirmTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  confirmBody: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  confirmCancelText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 12,
  },
  confirmEnd: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: CRIMSON,
  },
  confirmEndText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 12,
  },
  errText: {
    color: WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  leaveLink: {
    color: ORANGE,
    textAlign: 'center',
    fontWeight: '800',
  },
});

export default memo(LiveMatchRoomScreen);
