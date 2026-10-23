/**
 * ChallengerArena — clean 50/50 Host / Rival layout with strict role isolation.
 * Agora init is guarded: empty / YOUR_AGORA_APP_ID never calls native initialize().
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AGORA_APP_ID, hasAgoraAppId } from './src/config/agora';
import {
  destroyAgoraEngine,
  enableLocalCamera,
  getAgoraSdk,
  getEngine,
  initAgoraEngine,
  setLocalCameraEnabled,
} from './src/services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const ClientRoleType = AgoraSdk?.ClientRoleType;

/** True when env has a real App ID (not empty / YOUR_AGORA_APP_ID). */
const AGORA_CONFIGURED = Boolean(hasAgoraAppId() && AGORA_APP_ID);

/** RN types prefer absoluteFill; keep explicit full-bleed for the camera canvas. */
const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
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
  return 'SPECTATOR';
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

  const initialRole = useMemo(() => resolveUserRole(params), [params]);
  const [userRole] = useState<UserRole>(initialRole);
  const [isCamOn, setIsCamOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const agoraEngineRef = useRef<ReturnType<typeof getEngine>>(null);

  const hostHandle =
    (params.match as { host?: { handle?: string; flag?: string; reps?: number } })
      ?.host?.handle || '@MUMBAI_STRIKER';
  const hostFlag =
    (params.match as { host?: { flag?: string } })?.host?.flag || '🇮🇳';
  const hostReps =
    (params.match as { host?: { reps?: number } })?.host?.reps ?? 43;

  const rivalFromMatch = (params.match as {
    challenger?: { handle?: string; flag?: string; reps?: number };
    challengers?: { handle?: string; flag?: string; reps?: number }[];
  })?.challenger ||
    (params.match as { challengers?: { handle?: string; flag?: string; reps?: number }[] })
      ?.challengers?.[0];

  const rivalHandle = rivalFromMatch?.handle || '@SANTHOSH';
  const rivalFlag = rivalFromMatch?.flag || '🇮🇳';
  const rivalReps = rivalFromMatch?.reps ?? 0;
  const challengersCount = Array.isArray(
    (params.match as { challengers?: unknown[] })?.challengers
  )
    ? ((params.match as { challengers: unknown[] }).challengers.length)
    : 9;

  // Role isolation — never render spectator + athlete HUDs together
  const isAthlete = userRole === 'HOST' || userRole === 'RIVAL';
  const isSpectator = !isAthlete;

  const showHostCam = Boolean(
    isCamOn && isEngineReady && userRole === 'HOST' && RtcSurfaceView
  );
  const showRivalCam = Boolean(
    isCamOn && isEngineReady && userRole === 'RIVAL' && RtcSurfaceView
  );

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        return (
          granted['android.permission.CAMERA'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.RECORD_AUDIO'] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('[ChallengerArena] permissions', err);
        return false;
      }
    }
    return true;
  };

  // Safe Agora boot — never initialize with empty / YOUR_AGORA_APP_ID (black-screen crash).
  useEffect(() => {
    let isMounted = true;

    const initAgora = async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        }

        if (!AGORA_CONFIGURED) {
          console.warn(
            '[ChallengerArena] Agora App ID not configured — UI mounts without RTC'
          );
          if (isMounted) setIsEngineReady(true);
          return;
        }

        const init = await initAgoraEngine(AGORA_APP_ID);
        if (!init.ok) {
          console.warn('[ChallengerArena] Agora init skipped:', init.reason);
          if (isMounted) setIsEngineReady(true);
          return;
        }

        agoraEngineRef.current = getEngine();
        const engine = agoraEngineRef.current;
        if (engine && isAthlete) {
          try {
            engine.enableVideo();
            engine.startPreview();
          } catch (e) {
            console.warn('[ChallengerArena] preview warm-up', e);
          }
        }

        if (isMounted) setIsEngineReady(true);
      } catch (e) {
        console.error('[ChallengerArena] Agora init error:', e);
        if (isMounted) setIsEngineReady(true);
      }
    };

    void initAgora();

    return () => {
      isMounted = false;
      try {
        const engine = agoraEngineRef.current || getEngine();
        engine?.stopPreview?.();
        engine?.leaveChannel?.();
      } catch {
        /* ignore */
      }
      agoraEngineRef.current = null;
      void destroyAgoraEngine();
    };
    // Mount-once boot; role used only for optional preview warm-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!isAthlete) return;

    if (!isCamOn) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      if (AGORA_CONFIGURED) {
        const result = await enableLocalCamera();
        if (!result?.ok && result?.reason !== 'missing-app-id') {
          console.warn('[ChallengerArena] enableLocalCamera', result);
        }
        const engine = getEngine() || agoraEngineRef.current;
        if (engine) {
          try {
            engine.enableLocalVideo(true);
            engine.enableVideo();
            engine.startPreview();
            // Optional channel join when configured (token may be empty in cert-off projects).
            engine.joinChannel?.('', 'bawaal_arena', 0, {
              clientRoleType:
                ClientRoleType?.ClientRoleBroadcaster ??
                ClientRoleType?.clientRoleBroadcaster ??
                1,
            });
          } catch (e) {
            console.error('[ChallengerArena] Camera toggle error:', e);
          }
        }
      }
      // Always flip UI — STANDBY ↔ surface; never crash on missing App ID.
      setIsCamOn(true);
      return;
    }

    if (AGORA_CONFIGURED) {
      const engine = getEngine() || agoraEngineRef.current;
      try {
        engine?.enableLocalVideo?.(false);
        engine?.stopPreview?.();
        engine?.leaveChannel?.();
      } catch {
        /* ignore */
      }
      await setLocalCameraEnabled(false);
    }
    setIsCamOn(false);
  }, [isAthlete, isCamOn]);

  const toggleMic = useCallback(() => {
    if (!isAthlete) return;
    setMicMuted((prev) => {
      const next = !prev;
      const engine = getEngine();
      try {
        engine?.muteLocalAudioStream(next);
        engine?.enableLocalAudio(!next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [isAthlete]);

  const flipCamera = useCallback(() => {
    if (!isAthlete) return;
    try {
      getEngine()?.switchCamera?.();
    } catch {
      /* ignore */
    }
  }, [isAthlete]);

  const Surface = RtcSurfaceView as React.ComponentType<{
    canvas: { uid: number };
    style?: object;
    zOrderMediaOverlay?: boolean;
  }> | null;

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* ================= TOP HALF: HOST BOX ================= */}
      <View style={styles.arenaHalf}>
        {showHostCam && Surface ? (
          <Surface
            canvas={{ uid: 0 }}
            style={styles.fullScreenStream}
            zOrderMediaOverlay
          />
        ) : (
          <View style={styles.standbyContainer}>
            <Text style={styles.flagEmoji}>{hostFlag}</Text>
            <Text style={styles.handleText}>{hostHandle}</Text>
            <Text style={styles.standbyText}>STANDBY</Text>
          </View>
        )}

        <View style={styles.topLeftGroup}>
          <View style={styles.hostBadge}>
            <Text style={styles.badgeText}>
              {hostFlag} {hostHandle}
            </Text>
            <Text style={[styles.roleText, styles.roleTextHost]}>[HOST]</Text>
          </View>
          {isSpectator && (
            <TouchableOpacity style={styles.challengersBtn} activeOpacity={0.85}>
              <Text style={styles.challengersText}>
                CHALLENGERS ({challengersCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isSpectator && (
          <View style={styles.topRightGroup}>
            <View style={styles.repsBox}>
              <Text style={styles.repsLabel}>REPS</Text>
              <Text style={styles.repsValue}>{hostReps}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ================= CENTER VS BADGE ================= */}
      <View style={styles.vsContainer} pointerEvents="none">
        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>

      {/* ================= BOTTOM HALF: RIVAL BOX ================= */}
      <View style={styles.arenaHalf}>
        {showRivalCam && Surface ? (
          <Surface
            canvas={{ uid: 0 }}
            style={styles.fullScreenStream}
            zOrderMediaOverlay
          />
        ) : (
          <View style={styles.standbyContainer}>
            <Text style={styles.flagEmoji}>{rivalFlag}</Text>
            <Text style={styles.handleText}>{rivalHandle}</Text>
            <Text style={styles.standbyText}>STANDBY</Text>
          </View>
        )}

        <View
          style={[
            styles.bottomLeftGroup,
            { bottom: isAthlete ? 70 : 16 },
          ]}
        >
          <View style={styles.rivalBadge}>
            <Text style={styles.badgeText}>
              {rivalFlag} {rivalHandle}
            </Text>
            <Text style={[styles.roleText, styles.roleTextRival]}>[RIVAL]</Text>
          </View>
        </View>

        {isSpectator && (
          <View
            style={[
              styles.bottomRightGroup,
              { bottom: isAthlete ? 70 : 16 },
            ]}
          >
            <View style={[styles.repsBox, styles.repsBoxRival]}>
              <Text style={styles.repsLabel}>REPS</Text>
              <Text style={styles.repsValue}>{rivalReps}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ================= ROLE-BASED CONDITIONAL HUDS ================= */}

      {/* 1. SPECTATOR HUD — vanishes completely for athletes */}
      {isSpectator && (
        <View
          style={[
            styles.floatingHudContainer,
            { bottom: insets.bottom + 10 },
          ]}
        >
          <View style={styles.voteBarWrapper}>
            <Text style={styles.voteTextLeft}>1.2K · 54%</Text>
            <View style={styles.progressBarBg}>
              <View style={styles.progressBarFill} />
            </View>
            <Text style={styles.voteTextRight}>46% · 1.1K</Text>
          </View>
          <View style={styles.spectatorActionRow}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.85}>
              <Text style={styles.btnText}>🥊 VOTE HOST</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.banterBtn} activeOpacity={0.85}>
              <Text style={styles.btnText}>💬 BANTER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.85}>
              <Text style={styles.btnText}>🥊 VOTE RIVAL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. ATHLETE CONTROLS — Host / Rival only */}
      {isAthlete && (
        <View
          style={[
            styles.floatingHudContainer,
            { bottom: insets.bottom + 10 },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack?.();
              } else {
                navigation?.navigate?.('Main', { tab: 'Battles' });
              }
            }}
            style={styles.backChip}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>← BAWAAL</Text>
          </TouchableOpacity>
          <View style={styles.athleteControlRow}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={flipCamera}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>🔄 Flip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={toggleMic}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {micMuted ? '🔇 Unmute' : '🎤 Mute'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={toggleCamera}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {isCamOn ? '📹 Cam Off' : '📷 Cam On'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  arenaHalf: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#1F293D',
  },
  fullScreenStream: {
    ...ABSOLUTE_FILL,
    zIndex: 1,
  },
  standbyContainer: {
    ...ABSOLUTE_FILL,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E1A',
    zIndex: 1,
  },
  flagEmoji: {
    fontSize: 28,
    marginBottom: 4,
    textAlign: 'center',
  },
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
    maxWidth: '62%',
  },
  topRightGroup: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
  },
  bottomLeftGroup: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    maxWidth: '62%',
  },
  bottomRightGroup: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
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
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roleText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  roleTextHost: {
    color: '#FF5722',
  },
  roleTextRival: {
    color: '#00BCD4',
  },
  repsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#FF5722',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  repsBoxRival: {
    borderColor: '#00BCD4',
  },
  repsLabel: {
    color: '#8A99AD',
    fontSize: 9,
    fontWeight: 'bold',
  },
  repsValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
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
  vsText: {
    color: '#FF5722',
    fontWeight: 'bold',
    fontSize: 14,
  },
  challengersBtn: {
    backgroundColor: '#00BCD4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  challengersText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
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
  progressBarFill: {
    width: '54%',
    height: '100%',
    backgroundColor: '#FF5722',
  },
  voteTextLeft: { color: '#FF5722', fontSize: 11, fontWeight: 'bold' },
  voteTextRight: { color: '#00BCD4', fontSize: 11, fontWeight: 'bold' },
  spectatorActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  athleteControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 10,
    borderRadius: 12,
  },
  backChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1F293D',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  banterBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
