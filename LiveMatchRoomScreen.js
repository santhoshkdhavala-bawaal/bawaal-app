/**
 * BAWAAL Live Match Telecast — Phase 1 room (Host + Viewer).
 * Option A: Host = real CameraView preview; Viewer = HOST IS LIVE stage
 * with // PHASE 2: LIVE_VIDEO_STREAM_SLOT for LiveKit/Agora later.
 *
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
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Animated,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BawaalEmoji } from './components/BawaalEmoji';
import {
  FloatingEmojiBurstLayer,
  appendBurstParticles,
  createCenteredEmojiBurst,
} from './src/components/FloatingEmojiBurst';
import {
  fetchLiveMatch,
  joinLiveMatchRoom,
  updateMatchScore,
  endLiveMatch,
  broadcastBanter,
  broadcastReaction,
  broadcastVotePulse,
  pushBanterCapped,
} from './src/services/liveMatchService';
import { getActiveUser } from './src/services/activeUserProfile';

const BG = '#08120F';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const PANEL = 'rgba(8,18,15,0.72)';

const REACTION_KEYS = Object.freeze(['skull_fire', 'skull_burning']);

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

function Scoreboard({ teamA, teamB, scoreA, scoreB, compact }) {
  return (
    <View style={[styles.scoreboard, compact && styles.scoreboardCompact]}>
      <Text style={styles.scoreTeam} numberOfLines={1}>
        {teamA}
      </Text>
      <Text style={styles.scoreNums}>
        {scoreA} — {scoreB}
      </Text>
      <Text style={styles.scoreTeam} numberOfLines={1}>
        {teamB}
      </Text>
    </View>
  );
}

function VoteTugBar({ votesA, votesB, teamA, teamB, onVoteA, onVoteB }) {
  const total = Math.max(1, votesA + votesB);
  const pctA = Math.round((votesA / total) * 100);
  const pctB = 100 - pctA;
  return (
    <View style={styles.voteBlock}>
      <View style={styles.voteBtns}>
        <TouchableOpacity
          style={[styles.voteBtn, styles.voteBtnA]}
          onPress={onVoteA}
          activeOpacity={0.88}
        >
          <Text style={styles.voteBtnText}>VOTE {teamA}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteBtn, styles.voteBtnB]}
          onPress={onVoteB}
          activeOpacity={0.88}
        >
          <Text style={styles.voteBtnText}>VOTE {teamB}</Text>
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
        <Animated.View
          style={[styles.signalRow, { opacity: signalOpacity }]}
        >
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

function HostCameraStage({ facing, onReady }) {
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
    <CameraView
      style={StyleSheet.absoluteFill}
      facing={facing}
      mute
      onCameraReady={onReady}
    />
  );
}

function LiveMatchRoomScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const role = route?.params?.role === 'host' ? 'host' : 'viewer';
  const initialMatch = route?.params?.match || null;
  const matchId = String(
    route?.params?.matchId || initialMatch?.id || ''
  ).trim();

  const user = getActiveUser();
  const handle = String(user?.handle || user?.username || 'fan').replace(
    /^@/,
    ''
  );

  const [match, setMatch] = useState(initialMatch);
  const [watching, setWatching] = useState(1);
  const [facing, setFacing] = useState('back');
  const [endConfirm, setEndConfirm] = useState(false);
  const [banter, setBanter] = useState([]);
  const [banterDraft, setBanterDraft] = useState('');
  const [burstParticles, setBurstParticles] = useState([]);
  const [votesA, setVotesA] = useState(Number(initialMatch?.votes_a) || 0);
  const [votesB, setVotesB] = useState(Number(initialMatch?.votes_b) || 0);
  const stageSizeRef = useRef({ width: 0, height: 0 });

  const teamA = match?.team_a_name || 'TEAM A';
  const teamB = match?.team_b_name || 'TEAM B';
  const scoreA = match?.score_a ?? 0;
  const scoreB = match?.score_b ?? 0;

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
        setBanter((prev) => pushBanterCapped(prev, data));
      },
      onReaction: (data) => {
        const key = data?.emojiKey || 'skull_fire';
        setBurstParticles((prev) =>
          appendBurstParticles(
            prev,
            createCenteredEmojiBurst(key, stageSizeRef.current, { count: 5 })
          )
        );
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
  }, [matchId, role, navigation]);

  const bumpScore = useCallback(
    async (side, delta) => {
      if (role !== 'host' || !matchId) return;
      const nextA =
        side === 'A' ? Math.max(0, scoreA + delta) : scoreA;
      const nextB =
        side === 'B' ? Math.max(0, scoreB + delta) : scoreB;
      setMatch((prev) => ({
        ...(prev || {}),
        score_a: nextA,
        score_b: nextB,
      }));
      await updateMatchScore(matchId, { score_a: nextA, score_b: nextB });
    },
    [role, matchId, scoreA, scoreB]
  );

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

  const sendReaction = useCallback(
    async (emojiKey) => {
      if (!matchId) return;
      // Burst comes via room onReaction (sendBroadcast emits locally once)
      await broadcastReaction(matchId, { emojiKey, handle });
    },
    [matchId, handle]
  );

  const vote = useCallback(
    async (team) => {
      if (!matchId) return;
      // Count comes via room onVotePulse (sendBroadcast emits locally once)
      await broadcastVotePulse(matchId, { team, handle });
    },
    [matchId, handle]
  );

  const latestBanter = useMemo(() => banter.slice(-3).reverse(), [banter]);

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
      <View
        style={styles.stage}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          stageSizeRef.current = { width, height };
        }}
      >
        {role === 'host' ? (
          <HostCameraStage facing={facing} />
        ) : (
          <ViewerVideoStage sport={match?.sport} title={match?.title} />
        )}

        <FloatingEmojiBurstLayer
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
          <Scoreboard
            teamA={teamA}
            teamB={teamB}
            scoreA={scoreA}
            scoreB={scoreB}
            compact
          />
          <View style={styles.topRight}>
            {role === 'host' ? (
              <>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() =>
                    setFacing((f) => (f === 'back' ? 'front' : 'back'))
                  }
                  accessibilityLabel="Flip camera"
                >
                  <Ionicons name="camera-reverse-outline" size={20} color={WHITE} />
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

        {/* Banter ticker (non-blocking) */}
        <View style={styles.banterTicker} pointerEvents="none">
          {latestBanter.map((b, i) => (
            <Text key={`${b.at || i}-${b.message}`} style={styles.banterLine} numberOfLines={1}>
              <Text style={styles.banterHandle}>@{b.handle || 'fan'}</Text>
              {'  '}
              {b.message}
            </Text>
          ))}
        </View>

        {/* Bottom controls */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.bottomHud,
            { paddingBottom: Math.max(insets.bottom, 10) + 8 },
          ]}
        >
          {role === 'host' ? (
            <View style={styles.hostScoreRow}>
              <View style={styles.hostScoreCol}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={() => bumpScore('A', 1)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.plusBtnText}>+1 {teamA}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => bumpScore('A', -1)}
                >
                  <Text style={styles.undoText}>−1</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.hostScoreCol}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={() => bumpScore('B', 1)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.plusBtnText}>+1 {teamB}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => bumpScore('B', -1)}
                >
                  <Text style={styles.undoText}>−1</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <VoteTugBar
              votesA={votesA}
              votesB={votesB}
              teamA={teamA}
              teamB={teamB}
              onVoteA={() => vote('A')}
              onVoteB={() => vote('B')}
            />
          )}

          <View style={styles.reactRow}>
            {REACTION_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.reactBtn}
                onPress={() => sendReaction(key)}
                activeOpacity={0.85}
              >
                <BawaalEmoji name={key} size={36} />
              </TouchableOpacity>
            ))}
            <View style={styles.banterInputWrap}>
              <TextInput
                style={styles.banterInput}
                value={banterDraft}
                onChangeText={setBanterDraft}
                placeholder="Banter…"
                placeholderTextColor={MUTED}
                maxLength={160}
                returnKeyType="send"
                onSubmitEditing={sendBanter}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={sendBanter}
                accessibilityLabel="Send banter"
              >
                <Ionicons name="send" size={16} color={WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

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
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 20,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    justifyContent: 'flex-end',
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
  scoreboard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PANEL,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
  },
  scoreboardCompact: {
    maxWidth: 220,
  },
  scoreTeam: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 56,
  },
  scoreNums: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
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
  banterTicker: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 168,
    gap: 4,
    zIndex: 15,
  },
  banterLine: {
    color: WHITE,
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: '92%',
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
    gap: 10,
  },
  hostScoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  plusBtn: {
    width: '100%',
    backgroundColor: CRIMSON,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  plusBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  undoText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  voteBtnA: {
    backgroundColor: 'rgba(255,90,31,0.85)',
  },
  voteBtnB: {
    backgroundColor: 'rgba(229,57,53,0.9)',
  },
  voteBtnText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
  tugTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tugA: {
    backgroundColor: ORANGE,
  },
  tugB: {
    backgroundColor: CRIMSON,
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
  reactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.3)',
  },
  banterInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PANEL,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingLeft: 14,
    paddingRight: 4,
  },
  banterInput: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    paddingVertical: Platform.OS === 'web' ? 10 : 9,
    outlineStyle: 'none',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
