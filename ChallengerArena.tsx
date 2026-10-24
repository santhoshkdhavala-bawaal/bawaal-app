/**
 * ChallengerArena — 50/50 Host / Rival arena.
 * Spectator vs Athlete HUDs are mutually exclusive; action handlers wired.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let AgoraSdk: {
  RtcSurfaceView?: React.ComponentType<{
    canvas: { uid: number };
    style?: object;
    zOrderMediaOverlay?: boolean;
  }>;
  createAgoraRtcEngine?: () => {
    initialize: (c: { appId: string }) => void;
    enableVideo: () => void;
    enableLocalVideo: (on: boolean) => void;
    startPreview: () => void;
    stopPreview: () => void;
    leaveChannel: () => void;
    switchCamera?: () => void;
    muteLocalAudioStream?: (mute: boolean) => void;
    release?: () => void;
  };
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AgoraSdk = require('react-native-agora');
} catch {
  console.warn('[ChallengerArena] Agora SDK not loaded');
}

const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const createAgoraRtcEngine = AgoraSdk?.createAgoraRtcEngine || null;

const AGORA_APP_ID = '256476d4e1db410e9f72b9196287fd29';

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

type UserRole = 'HOST' | 'RIVAL' | 'SPECTATOR';

function resolveUserRole(params: Record<string, unknown> = {}): UserRole {
  const mode = String(params.mode || '').toLowerCase().trim();
  const role = String(params.role || '').toLowerCase().trim();
  if (
    mode === 'spectator' ||
    role === 'spectator' ||
    role === 'watch' ||
    mode === 'watch'
  ) {
    return 'SPECTATOR';
  }
  if (role === 'host' || mode === 'host') return 'HOST';
  if (
    role === 'challenger' ||
    role === 'rival' ||
    mode === 'athlete' ||
    role === 'athlete'
  ) {
    return 'RIVAL';
  }
  return 'HOST';
}

async function ensureAndroidMediaPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    const camOk =
      result[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const micOk =
      result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
      PermissionsAndroid.RESULTS.GRANTED;
    return camOk && micOk;
  } catch (err) {
    console.error('[ChallengerArena] Permission request error:', err);
    return false;
  }
}

type Props = {
  route?: { params?: Record<string, unknown> };
  navigation?: {
    canGoBack?: () => boolean;
    goBack?: () => void;
    navigate?: (name: string, params?: Record<string, unknown>) => void;
  };
};

export default function ChallengerArena({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const params = useMemo(() => route?.params || {}, [route?.params]);

  const [userRole] = useState<UserRole>(() => resolveUserRole(params));
  const [isCamOn, setIsCamOn] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hostVotes, setHostVotes] = useState(1200);
  const [rivalVotes, setRivalVotes] = useState(1100);
  const [challengersCount] = useState(9);
  const [isEngineReady, setIsEngineReady] = useState(false);

  const agoraEngineRef = useRef<ReturnType<
    NonNullable<typeof createAgoraRtcEngine>
  > | null>(null);
  const mountedRef = useRef(true);

  const isAthlete = userRole === 'HOST' || userRole === 'RIVAL';
  const isSpectator = !isAthlete;
  const totalVotes = Math.max(hostVotes + rivalVotes, 1);
  const hostPercent = Math.round((hostVotes / totalVotes) * 100);
  const rivalPercent = 100 - hostPercent;

  /** Keep rival badges clear of the floating athlete HUD */
  const rivalBadgeBottom = isAthlete ? 120 : 80;

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const initEngine = async () => {
      try {
        const permitted = await ensureAndroidMediaPermissions();
        if (cancelled || !mountedRef.current) return;

        if (!permitted || !createAgoraRtcEngine || !AGORA_APP_ID) {
          if (mountedRef.current) setIsEngineReady(true);
          return;
        }

        const engine = createAgoraRtcEngine();
        if (cancelled || !mountedRef.current) {
          try {
            engine.release?.();
          } catch {
            /* ignore */
          }
          return;
        }

        agoraEngineRef.current = engine;
        engine.initialize({ appId: AGORA_APP_ID });
        engine.enableVideo();

        if (mountedRef.current && !cancelled) {
          setIsEngineReady(true);
        }
      } catch (err) {
        console.error('[ChallengerArena] Agora init error:', err);
        if (mountedRef.current && !cancelled) {
          setIsEngineReady(true);
        }
      }
    };

    void initEngine();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      try {
        agoraEngineRef.current?.stopPreview?.();
        agoraEngineRef.current?.leaveChannel?.();
        agoraEngineRef.current?.release?.();
      } catch {
        /* ignore */
      }
      agoraEngineRef.current = null;
    };
  }, []);

  const handleToggleCam = useCallback(async () => {
    const engine = agoraEngineRef.current;
    if (!engine || !isEngineReady) {
      setIsCamOn((prev) => !prev);
      setIsPreviewActive(false);
      return;
    }

    try {
      if (!isCamOn) {
        const permitted = await ensureAndroidMediaPermissions();
        if (!mountedRef.current) return;
        if (!permitted) return;

        engine.enableLocalVideo(true);
        engine.startPreview();
        if (!mountedRef.current) return;
        setIsPreviewActive(true);
        setIsCamOn(true);
      } else {
        engine.stopPreview();
        engine.enableLocalVideo(false);
        if (!mountedRef.current) return;
        setIsPreviewActive(false);
        setIsCamOn(false);
      }
    } catch (e) {
      console.error('[ChallengerArena] Cam toggle error:', e);
      if (mountedRef.current) setIsPreviewActive(false);
    }
  }, [isCamOn, isEngineReady]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    const engine = agoraEngineRef.current;
    if (engine) {
      try {
        engine.muteLocalAudioStream?.(next);
      } catch {
        /* ignore */
      }
    }
    setIsMuted(next);
  }, [isMuted]);

  const handleFlipCamera = useCallback(() => {
    try {
      agoraEngineRef.current?.switchCamera?.();
    } catch {
      /* ignore */
    }
  }, []);

  const handleVoteHost = useCallback(() => {
    setHostVotes((prev) => prev + 1);
  }, []);

  const handleVoteRival = useCallback(() => {
    setRivalVotes((prev) => prev + 1);
  }, []);

  const handleChallengersPress = useCallback(() => {
    Alert.alert('Challengers Queue', `${challengersCount} waiting in line`);
  }, [challengersCount]);

  const handleBanterPress = useCallback(() => {
    Alert.alert('Banter Box', 'Open chat overlay');
  }, []);

  const showLocalPreview = Boolean(
    isCamOn && isPreviewActive && isEngineReady && RtcSurfaceView && isAthlete
  );

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* TOP HALF: HOST ARENA */}
      <View style={styles.arenaHalf}>
        {showLocalPreview && userRole === 'HOST' && RtcSurfaceView ? (
          <RtcSurfaceView
            canvas={{ uid: 0 }}
            style={styles.fullScreenStream}
            zOrderMediaOverlay
          />
        ) : (
          <View style={styles.standbyContainer}>
            <Text style={styles.flagEmoji}>🇮🇳</Text>
            <Text style={styles.handleText}>@MUMBAI_STRIKER</Text>
            <Text style={styles.standbyText}>STANDBY</Text>
          </View>
        )}

        <View style={styles.topLeftGroup}>
          <View style={styles.hostBadge}>
            <Text style={styles.badgeText}>🇮🇳 @MUMBAI_STRIKER</Text>
            <Text style={styles.roleText}>[HOST]</Text>
          </View>
          {isSpectator && (
            <TouchableOpacity
              style={styles.challengersBtn}
              onPress={handleChallengersPress}
              activeOpacity={0.85}
            >
              <Text style={styles.challengersText}>
                CHALLENGERS ({challengersCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.topRightGroup}>
          <View style={styles.repsBox}>
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsValue}>43</Text>
          </View>
        </View>
      </View>

      {/* CENTER VS CIRCLE */}
      <View style={styles.vsContainer} pointerEvents="none">
        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>

      {/* BOTTOM HALF: RIVAL ARENA */}
      <View style={styles.arenaHalf}>
        {showLocalPreview && userRole === 'RIVAL' && RtcSurfaceView ? (
          <RtcSurfaceView
            canvas={{ uid: 0 }}
            style={styles.fullScreenStream}
            zOrderMediaOverlay
          />
        ) : (
          <View style={styles.standbyContainer}>
            <Text style={styles.flagEmoji}>🇮🇳</Text>
            <Text style={styles.handleText}>@SANTHOSH</Text>
            <Text style={styles.standbyText}>STANDBY</Text>
          </View>
        )}

        <View style={[styles.bottomLeftGroup, { bottom: rivalBadgeBottom }]}>
          <View style={styles.rivalBadge}>
            <Text style={styles.badgeText}>🇮🇳 @SANTHOSH</Text>
            <Text style={[styles.roleText, styles.roleTextRival]}>[RIVAL]</Text>
          </View>
        </View>

        <View style={[styles.bottomRightGroup, { bottom: rivalBadgeBottom }]}>
          <View style={[styles.repsBox, styles.repsBoxRival]}>
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsValue}>0</Text>
          </View>
        </View>
      </View>

      {/* FLOATING HUD — spectator XOR athlete (never both) */}
      <View
        style={[styles.floatingHudContainer, { bottom: insets.bottom + 12 }]}
      >
        {isSpectator && (
          <View>
            <View style={styles.voteBarWrapper}>
              <Text style={styles.voteTextLeft}>
                {(hostVotes / 1000).toFixed(1)}K · {hostPercent}%
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, { width: `${hostPercent}%` }]}
                />
              </View>
              <Text style={styles.voteTextRight}>
                {rivalPercent}% · {(rivalVotes / 1000).toFixed(1)}K
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleVoteHost}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>🥊 VOTE HOST</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.banterBtn}
                onPress={handleBanterPress}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>💬 BANTER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleVoteRival}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>🥊 VOTE RIVAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isAthlete && (
          <View>
            <TouchableOpacity
              style={styles.backChip}
              activeOpacity={0.85}
              onPress={() => {
                if (navigation?.canGoBack?.()) navigation.goBack?.();
                else navigation?.navigate?.('Main', { tab: 'Battles' });
              }}
            >
              <Text style={styles.btnText}>← BAWAAL</Text>
            </TouchableOpacity>
            <View style={styles.athleteControlRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleFlipCamera}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>🔄 Flip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.controlBtn,
                  isMuted && styles.activeControlBtn,
                ]}
                onPress={handleToggleMute}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.controlBtn,
                  isCamOn && styles.activeControlBtn,
                ]}
                onPress={handleToggleCam}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  {isCamOn ? '📹 Cam Off' : '📹 Cam On'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#0A0E1A' },
  arenaHalf: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#1F293D',
  },
  fullScreenStream: { ...ABSOLUTE_FILL, zIndex: 1 },
  standbyContainer: {
    ...ABSOLUTE_FILL,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E1A',
    zIndex: 1,
  },
  flagEmoji: { fontSize: 28, marginBottom: 4, textAlign: 'center' },
  handleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  standbyText: {
    color: '#8A99AD',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 1,
    textAlign: 'center',
  },
  topLeftGroup: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    gap: 6,
  },
  topRightGroup: { position: 'absolute', top: 12, right: 16, zIndex: 10 },
  bottomLeftGroup: { position: 'absolute', left: 16, zIndex: 10 },
  bottomRightGroup: { position: 'absolute', right: 16, zIndex: 10 },
  hostBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#FF5722',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rivalBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#00BCD4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  roleText: { color: '#FF5722', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  roleTextRival: { color: '#00BCD4' },
  repsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#FF5722',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  repsBoxRival: { borderColor: '#00BCD4' },
  repsLabel: { color: '#8A99AD', fontSize: 9, fontWeight: 'bold' },
  repsValue: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  vsContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    zIndex: 50,
  },
  vsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A0E1A',
    borderWidth: 2,
    borderColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: { color: '#FF5722', fontWeight: 'bold', fontSize: 14 },
  challengersBtn: {
    backgroundColor: '#00BCD4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  challengersText: { color: '#000000', fontSize: 11, fontWeight: 'bold' },
  floatingHudContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  voteBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#00BCD4',
    marginHorizontal: 8,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#FF5722' },
  voteTextLeft: { color: '#FF5722', fontSize: 11, fontWeight: 'bold' },
  voteTextRight: { color: '#00BCD4', fontSize: 11, fontWeight: 'bold' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1F293D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  banterBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  athleteControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  backChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  controlBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1F293D',
  },
  activeControlBtn: { backgroundColor: '#FF5722' },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
});

export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export {
  enableLocalCamera,
  initAgoraEngine,
  ensureLocalPreview,
  setLocalCameraEnabled,
  startBroadcasterPreview,
} from './src/services/agoraService';
