/**
 * ChallengerArena — 50/50 Host / Rival arena with safe Agora boot.
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

// Load Agora SDK dynamically (dev client / Expo Go safe)
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
    joinChannel: (...args: unknown[]) => void;
    leaveChannel: () => void;
    switchCamera?: () => void;
    muteLocalAudioStream?: (mute: boolean) => void;
    release?: () => void;
  };
  ClientRoleType?: {
    clientRoleBroadcaster?: number;
    ClientRoleBroadcaster?: number;
  };
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AgoraSdk = require('react-native-agora');
} catch {
  console.warn('[ChallengerArena] Agora SDK not installed or loaded');
}

const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const createAgoraRtcEngine = AgoraSdk?.createAgoraRtcEngine || null;
const ClientRoleType = AgoraSdk?.ClientRoleType;

const AGORA_APP_ID = '256476d4e1db410e9f72b9196287fd29';
const AGORA_CONFIGURED = Boolean(
  AGORA_APP_ID && AGORA_APP_ID.length > 10 && createAgoraRtcEngine
);

/** Full-bleed fill (absoluteFillObject not in RN typed exports). */
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
  // Default HOST for local camera testing when role is unspecified.
  return 'HOST';
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
  const [isEngineReady, setIsEngineReady] = useState(false);
  const agoraEngineRef = useRef<ReturnType<
    NonNullable<typeof createAgoraRtcEngine>
  > | null>(null);

  const challengersCount = 9;
  const isAthlete = userRole === 'HOST' || userRole === 'RIVAL';
  const isSpectator = !isAthlete;

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

        if (!AGORA_CONFIGURED || !createAgoraRtcEngine) {
          if (isMounted) setIsEngineReady(true);
          return;
        }

        const agoraEngine = createAgoraRtcEngine();
        agoraEngineRef.current = agoraEngine;

        agoraEngine.initialize({ appId: AGORA_APP_ID });
        agoraEngine.enableVideo();

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
        agoraEngineRef.current?.stopPreview?.();
        agoraEngineRef.current?.leaveChannel?.();
        agoraEngineRef.current?.release?.();
      } catch {
        /* ignore */
      }
      agoraEngineRef.current = null;
    };
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!isCamOn) {
      if (agoraEngineRef.current && AGORA_CONFIGURED) {
        try {
          agoraEngineRef.current.enableLocalVideo(true);
          agoraEngineRef.current.startPreview();
          if (ClientRoleType) {
            agoraEngineRef.current.joinChannel('', 'bawaal_arena', 0, {
              clientRoleType:
                ClientRoleType.clientRoleBroadcaster ??
                ClientRoleType.ClientRoleBroadcaster ??
                1,
            });
          }
        } catch (e) {
          console.error('[ChallengerArena] Camera toggle error:', e);
        }
      }
      setIsCamOn(true);
      return;
    }

    if (agoraEngineRef.current && AGORA_CONFIGURED) {
      try {
        agoraEngineRef.current.enableLocalVideo(false);
        agoraEngineRef.current.stopPreview();
        agoraEngineRef.current.leaveChannel();
      } catch {
        /* ignore */
      }
    }
    setIsCamOn(false);
  }, [isCamOn]);

  const flipCamera = useCallback(() => {
    try {
      agoraEngineRef.current?.switchCamera?.();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMic = useCallback(() => {
    try {
      agoraEngineRef.current?.muteLocalAudioStream?.(true);
    } catch {
      /* ignore */
    }
  }, []);

  const showLocalPreview = Boolean(
    isCamOn && isEngineReady && RtcSurfaceView && isAthlete
  );

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* TOP HALF: HOST BOX */}
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
            <TouchableOpacity style={styles.challengersBtn} activeOpacity={0.85}>
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

      {/* CENTER VS BADGE */}
      <View style={styles.vsContainer} pointerEvents="none">
        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>

      {/* BOTTOM HALF: RIVAL BOX */}
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

        <View style={[styles.bottomLeftGroup, { bottom: isAthlete ? 70 : 16 }]}>
          <View style={styles.rivalBadge}>
            <Text style={styles.badgeText}>🇮🇳 @SANTHOSH</Text>
            <Text style={[styles.roleText, styles.roleTextRival]}>[RIVAL]</Text>
          </View>
        </View>

        <View style={[styles.bottomRightGroup, { bottom: isAthlete ? 70 : 16 }]}>
          <View style={[styles.repsBox, styles.repsBoxRival]}>
            <Text style={styles.repsLabel}>REPS</Text>
            <Text style={styles.repsValue}>0</Text>
          </View>
        </View>
      </View>

      {/* ROLE-BASED HUDS */}
      {isSpectator && (
        <View
          style={[styles.floatingHudContainer, { bottom: insets.bottom + 10 }]}
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

      {isAthlete && (
        <View
          style={[styles.floatingHudContainer, { bottom: insets.bottom + 10 }]}
        >
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
              <Text style={styles.btnText}>🎤 Mute</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={toggleCamera}
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
  challengersText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
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
  controlBtn: { paddingHorizontal: 16, paddingVertical: 6 },
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
