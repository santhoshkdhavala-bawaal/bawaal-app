/**
 * UniversalCamera — BAWAAL Universal Creation Engine.
 * Modes: ⚡ SPARKS · 🔥 JOSH · 🥊 BATTLE REWIND · ⚔️ BATTLE BAWAAL
 */
import React, {
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
  Modal,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Switch,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreationPostSheet from './PostCreationSheet';
import type {
  CreationMode,
  PostCreationPayload,
} from './PostCreationSheet';
import { pushHotFeatureBattle } from './battlesFeedStore';

export type { CreationMode, PostCreationPayload };

const NEON_ORANGE = '#FF5722';
const SHUTTER_RED = '#FF3B30';
const TIME_OPTIONS = [5, 15, 30, 60] as const;

type NavLike = {
  goBack?: () => void;
  canGoBack?: () => boolean;
  navigate?: (name: string, params?: Record<string, unknown>) => void;
};

export type UniversalCameraProps = {
  navigation?: NavLike;
  route?: { params?: { initialMode?: CreationMode } & Record<string, unknown> };
  initialMode?: CreationMode;
  onPublished?: (payload: PostCreationPayload) => void;
};

type ModeMeta = { id: CreationMode; label: string };

const MODE_STRIP: ModeMeta[] = [
  { id: 'SPARKS', label: '⚡ SPARKS' },
  { id: 'JOSH', label: '🔥 JOSH' },
  { id: 'BATTLE_REWIND', label: '🥊 BATTLE REWIND' },
  { id: 'BATTLE_BAWAAL', label: '⚔️ BATTLE BAWAAL' },
];

function modeCeiling(mode: CreationMode, joshUnlocked3m: boolean): number {
  switch (mode) {
    case 'SPARKS':
      return 30;
    case 'JOSH':
      return joshUnlocked3m ? 180 : 60;
    case 'BATTLE_REWIND':
      return 60;
    case 'BATTLE_BAWAAL':
      return 0;
    default:
      return 30;
  }
}

function defaultDuration(mode: CreationMode): number {
  switch (mode) {
    case 'SPARKS':
      return 15;
    case 'JOSH':
      return 30;
    case 'BATTLE_REWIND':
      return 30;
    default:
      return 15;
  }
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Animated recording progress ring around the shutter (no SVG dependency). */
function ShutterProgressRing({ progress }: { progress: number }) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    spin.setValue(Math.min(1, Math.max(0, progress)));
  }, [progress, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={ringStyles.track} pointerEvents="none">
      <Animated.View
        style={[
          ringStyles.arc,
          {
            transform: [{ rotate }],
            opacity: progress > 0 ? 1 : 0,
          },
        ]}
      />
      <View style={ringStyles.hole} />
    </View>
  );
}

const ringStyles = StyleSheet.create({
  track: {
    ...ABSOLUTE_FILL,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arc: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: NEON_ORANGE,
    borderRightColor: NEON_ORANGE,
  },
  hole: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
});

function ClipPreviewModal({
  visible,
  uri,
  onRetake,
  onNext,
}: {
  visible: boolean;
  uri: string | null;
  onRetake: () => void;
  onNext: (opts: { slowMoEnabled: boolean; slowMoRate: number }) => void;
}) {
  const [slowMoEnabled, setSlowMoEnabled] = useState(false);
  const [slowMoRate, setSlowMoRate] = useState(0.5);
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!player) return;
    try {
      /* expo-video player is a mutable native handle */
      // eslint-disable-next-line react-hooks/immutability -- VideoPlayer API
      player.playbackRate = slowMoEnabled ? slowMoRate : 1;
      if (visible) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [player, slowMoEnabled, slowMoRate, visible]);

  if (!visible || !uri) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onRetake}>
      <View style={previewStyles.root}>
        <StatusBar barStyle="light-content" />
        <Text style={previewStyles.title}>Preview Clip</Text>
        <View style={previewStyles.videoWrap}>
          <VideoView
            style={previewStyles.video}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
        </View>

        <View style={previewStyles.slowMoRow}>
          <View style={previewStyles.slowMoCopy}>
            <Text style={previewStyles.slowMoTitle}>Slow-Mo Effect</Text>
            <Text style={previewStyles.slowMoSub}>
              {slowMoEnabled
                ? `Playback ${slowMoRate.toFixed(1)}x`
                : 'Normal speed'}
            </Text>
          </View>
          <Switch
            value={slowMoEnabled}
            onValueChange={setSlowMoEnabled}
            trackColor={{ false: '#334155', true: NEON_ORANGE }}
            thumbColor="#FFFFFF"
          />
        </View>

        {slowMoEnabled && (
          <View style={previewStyles.rateRow}>
            {[0.25, 0.5, 0.75].map((rate) => {
              const active = slowMoRate === rate;
              return (
                <TouchableOpacity
                  key={rate}
                  style={[
                    previewStyles.rateChip,
                    active && previewStyles.rateChipActive,
                  ]}
                  onPress={() => setSlowMoRate(rate)}
                >
                  <Text
                    style={[
                      previewStyles.rateText,
                      active && previewStyles.rateTextActive,
                    ]}
                  >
                    {rate}x
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={previewStyles.actions}>
          <TouchableOpacity
            style={previewStyles.secondaryBtn}
            onPress={onRetake}
            activeOpacity={0.85}
          >
            <Text style={previewStyles.secondaryText}>RETAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={previewStyles.primaryBtn}
            onPress={() => onNext({ slowMoEnabled, slowMoRate })}
            activeOpacity={0.9}
          >
            <Text style={previewStyles.primaryText}>NEXT TO POST</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  videoWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  video: { flex: 1 },
  slowMoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 10,
  },
  slowMoCopy: { flex: 1, paddingRight: 12 },
  slowMoTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  slowMoSub: { color: '#8A99AD', fontSize: 12, marginTop: 2 },
  rateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  rateChipActive: {
    backgroundColor: NEON_ORANGE,
    borderColor: NEON_ORANGE,
  },
  rateText: { color: '#8A99AD', fontWeight: '800', fontSize: 12 },
  rateTextActive: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 12,
    backgroundColor: NEON_ORANGE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
});

export default function UniversalCamera({
  navigation,
  route,
  initialMode,
  onPublished,
}: UniversalCameraProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const bootMode: CreationMode =
    initialMode ||
    (route?.params?.initialMode as CreationMode | undefined) ||
    'SPARKS';

  const [mode, setMode] = useState<CreationMode>(bootMode);
  const [selectedDuration, setSelectedDuration] = useState(() =>
    defaultDuration(bootMode)
  );
  const [showTimeChips, setShowTimeChips] = useState(true);
  const [timeChipsOpacity] = useState(() => new Animated.Value(1));

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [joshUnlocked3m, setJoshUnlocked3m] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');

  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [slowMoEnabled, setSlowMoEnabled] = useState(false);
  const [slowMoRate, setSlowMoRate] = useState(0.5);

  const cameraRef = useRef<CameraView>(null);
  const recordingLockRef = useRef(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideChipsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ceiling = useMemo(
    () => modeCeiling(mode, joshUnlocked3m),
    [mode, joshUnlocked3m]
  );

  const availableTimes = useMemo((): number[] => {
    if (mode === 'BATTLE_BAWAAL') return [];
    const base: number[] = TIME_OPTIONS.filter((t) => t <= ceiling);
    if (mode === 'JOSH' && joshUnlocked3m && !base.includes(180)) {
      return [...base, 180];
    }
    return base;
  }, [mode, ceiling, joshUnlocked3m]);

  const recordLimit = Math.min(selectedDuration, ceiling || selectedDuration);

  const fadeTimeChips = useCallback(
    (hide: boolean) => {
      Animated.timing(timeChipsOpacity, {
        toValue: hide ? 0 : 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && hide) setShowTimeChips(false);
      });
      if (!hide) setShowTimeChips(true);
    },
    [timeChipsOpacity]
  );

  const scheduleHideChips = useCallback(() => {
    if (hideChipsTimerRef.current) clearTimeout(hideChipsTimerRef.current);
    hideChipsTimerRef.current = setTimeout(() => fadeTimeChips(true), 450);
  }, [fadeTimeChips]);

  useEffect(() => {
    if (!cameraPermission?.granted) void requestCameraPermission();
    if (!micPermission?.granted) void requestMicPermission();
  }, [
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (hideChipsTimerRef.current) clearTimeout(hideChipsTimerRef.current);
    };
  }, []);

  const clearElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    clearElapsedTimer();
    setElapsedSec(0);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, [clearElapsedTimer]);

  const handleClose = useCallback(() => {
    if (isRecording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        /* ignore */
      }
    }
    if (navigation?.canGoBack?.()) navigation.goBack?.();
    else navigation?.navigate?.('Main', { tab: 'Arena' });
  }, [isRecording, navigation]);

  const handleModeChange = useCallback(
    (next: CreationMode) => {
      if (isRecording || recordingLockRef.current) return;
      setMode(next);
      if (next === 'BATTLE_BAWAAL') {
        setShowTimeChips(false);
        return;
      }
      const nextDur = Math.min(defaultDuration(next), modeCeiling(next, joshUnlocked3m));
      setSelectedDuration(nextDur);
      setShowTimeChips(true);
      timeChipsOpacity.setValue(1);
      scheduleHideChips();
    },
    [isRecording, joshUnlocked3m, scheduleHideChips, timeChipsOpacity]
  );

  const handleTimeSelect = useCallback(
    (sec: number) => {
      if (isRecording) return;
      setSelectedDuration(sec);
      scheduleHideChips();
    },
    [isRecording, scheduleHideChips]
  );

  const handleToggle3mExtension = useCallback(() => {
    if (isRecording || mode !== 'JOSH') return;
    if (joshUnlocked3m) {
      setJoshUnlocked3m(false);
      setSelectedDuration((d) => Math.min(d, 60));
      return;
    }
    Alert.alert(
      '🔥 Unlock 3-Minute Josh Reel',
      'Extend your reel limit to 180 seconds for 10 BAWAAL Coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock (10 Coins)',
          onPress: () => {
            setJoshUnlocked3m(true);
            setSelectedDuration(180);
            setShowTimeChips(true);
            timeChipsOpacity.setValue(1);
            scheduleHideChips();
          },
        },
      ]
    );
  }, [
    isRecording,
    mode,
    joshUnlocked3m,
    scheduleHideChips,
    timeChipsOpacity,
  ]);

  const launchBattleBawaal = useCallback(() => {
    const card = pushHotFeatureBattle({
      challengeTitle: 'Open Live 1v1 Challenge',
      host: '@MUMBAI_STRIKER',
      hostFlag: '🇮🇳',
      hostLabel: 'INDIA',
      status: 'LIVE',
      isHotFeature: true,
      source: 'BATTLE_BAWAAL',
    });

    navigation?.navigate?.('ChallengerArena', {
      mode: 'athlete',
      role: 'host',
      battleId: card?.id,
      match: card?.liveMatch,
    });
  }, [navigation]);

  const startRecording = useCallback(async () => {
    if (mode === 'BATTLE_BAWAAL') {
      launchBattleBawaal();
      return;
    }

    if (
      !cameraRef.current ||
      !isCameraReady ||
      isRecording ||
      recordingLockRef.current
    ) {
      return;
    }

    recordingLockRef.current = true;
    setIsRecording(true);
    fadeTimeChips(true);
    startElapsedTimer();

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: recordLimit,
      });
      const uri = video?.uri ?? null;
      clearElapsedTimer();
      setIsRecording(false);
      recordingLockRef.current = false;

      if (!uri) return;

      setRecordedVideoUri(uri);

      if (mode === 'SPARKS' || mode === 'JOSH') {
        setShowPreview(true);
      } else {
        // BATTLE_REWIND → straight to post sheet (Battles dispatch)
        setShowPostSheet(true);
      }
    } catch (e) {
      console.error('[UniversalCamera] Recording error:', e);
      clearElapsedTimer();
      setIsRecording(false);
      recordingLockRef.current = false;
      Alert.alert('Recording failed', 'Could not save this clip. Try again.');
    }
  }, [
    mode,
    isCameraReady,
    isRecording,
    recordLimit,
    fadeTimeChips,
    startElapsedTimer,
    clearElapsedTimer,
    launchBattleBawaal,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    try {
      cameraRef.current?.stopRecording();
    } catch (e) {
      console.warn('[UniversalCamera] stopRecording:', e);
    }
  }, [isRecording]);

  const handleShutter = useCallback(() => {
    if (mode === 'BATTLE_BAWAAL') {
      launchBattleBawaal();
      return;
    }
    if (isRecording) stopRecording();
    else void startRecording();
  }, [mode, isRecording, launchBattleBawaal, stopRecording, startRecording]);

  const flipCamera = useCallback(() => {
    if (isRecording) return;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  const revealTimeChips = useCallback(() => {
    if (mode === 'BATTLE_BAWAAL' || isRecording) return;
    setShowTimeChips(true);
    timeChipsOpacity.setValue(1);
  }, [mode, isRecording, timeChipsOpacity]);

  const progress =
    isRecording && recordLimit > 0
      ? Math.min(1, elapsedSec / recordLimit)
      : 0;

  const permissionsPending =
    cameraPermission == null || micPermission == null;
  const permissionsGranted =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  if (permissionsPending) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color={NEON_ORANGE} size="large" />
        <Text style={styles.permissionText}>Preparing camera…</Text>
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permissionText}>
          Camera and Microphone access needed for BAWAAL creation.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => {
            void requestCameraPermission();
            void requestMicPermission();
          }}
        >
          <Text style={styles.btnText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        mute={false}
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(err) => {
          console.warn('[UniversalCamera] mount error:', err?.message);
          Alert.alert('Camera Error', err?.message || 'Could not start camera.');
        }}
      />

      <View
        pointerEvents="box-none"
        style={[styles.absoluteFill, styles.overlayRoot]}
      >
        {/* Header / live timer */}
        <View
          style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.iconBtn}
            accessibilityLabel="Close camera"
          >
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>
              {mode === 'BATTLE_BAWAAL'
                ? '🔴 BATTLE BAWAAL'
                : isRecording
                  ? `🔴 ${formatClock(elapsedSec)} / ${formatClock(recordLimit)}`
                  : `⏱️ MAX ${recordLimit}s`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={flipCamera}
            style={styles.iconBtn}
            disabled={isRecording}
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.iconText}>🔄</Text>
          </TouchableOpacity>
        </View>

        {mode === 'JOSH' && !isRecording && (
          <TouchableOpacity
            style={styles.paidToggleBtn}
            onPress={handleToggle3mExtension}
          >
            <Text style={styles.paidToggleText}>
              {joshUnlocked3m
                ? '⚡ 3 MIN UNLOCKED (180s)'
                : '🔒 UNLOCK 3 MIN (10 Coins)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bottom: time chips → shutter → mode strip */}
        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {mode !== 'BATTLE_BAWAAL' && showTimeChips && (
            <Animated.View
              style={[styles.timeChipRow, { opacity: timeChipsOpacity }]}
            >
              {availableTimes.map((sec) => {
                const active = selectedDuration === sec;
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    onPress={() => handleTimeSelect(sec)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        active && styles.timeChipTextActive,
                      ]}
                    >
                      {sec}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          {mode !== 'BATTLE_BAWAAL' && !showTimeChips && !isRecording && (
            <TouchableOpacity onPress={revealTimeChips} style={styles.timeHint}>
              <Text style={styles.timeHintText}>
                {recordLimit}s · tap to change
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.shutterWrap,
              mode === 'BATTLE_BAWAAL' && styles.shutterWrapLive,
            ]}
            onPress={handleShutter}
            activeOpacity={0.85}
            accessibilityLabel={
              mode === 'BATTLE_BAWAAL'
                ? 'Go live Battle Bawaal'
                : isRecording
                  ? 'Stop recording'
                  : 'Start recording'
            }
          >
            <ShutterProgressRing progress={progress} />
            <View
              style={[
                styles.shutterInner,
                isRecording && styles.shutterSquare,
                mode === 'BATTLE_BAWAAL' && styles.shutterInnerLive,
              ]}
            />
          </TouchableOpacity>

          <View style={styles.modeStrip}>
            {MODE_STRIP.map((item) => {
              const active = mode === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.modeChip}
                  onPress={() => handleModeChange(item.id)}
                  disabled={isRecording}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.modeText,
                      active && styles.activeModeText,
                      isRecording && !active && styles.modeTextDim,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {item.label}
                  </Text>
                  {active ? <View style={styles.modeUnderline} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <ClipPreviewModal
        key={recordedVideoUri || 'preview'}
        visible={showPreview}
        uri={recordedVideoUri}
        onRetake={() => {
          setShowPreview(false);
          setRecordedVideoUri(null);
          setSlowMoEnabled(false);
          setSlowMoRate(0.5);
          setShowTimeChips(true);
          timeChipsOpacity.setValue(1);
        }}
        onNext={({ slowMoEnabled: sm, slowMoRate: rate }) => {
          setSlowMoEnabled(sm);
          setSlowMoRate(rate);
          setShowPreview(false);
          setShowPostSheet(true);
        }}
      />

      <Modal
        visible={showPostSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPostSheet(false)}
      >
        <CreationPostSheet
          mode={mode}
          videoUri={recordedVideoUri}
          slowMoEnabled={slowMoEnabled}
          slowMoRate={slowMoRate}
          durationSec={recordLimit}
          onClose={() => setShowPostSheet(false)}
          onSuccess={(payload) => {
            setShowPostSheet(false);
            if (payload) onPublished?.(payload);
            const tab =
              payload?.feedTarget === 'BATTLES' ? 'Battles' : 'Arena';
            navigation?.navigate?.('Main', { tab });
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  absoluteFill: { ...ABSOLUTE_FILL },
  camera: { ...ABSOLUTE_FILL },
  overlayRoot: { justifyContent: 'space-between' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: NEON_ORANGE,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 14, 26, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  timerBadge: {
    backgroundColor: 'rgba(10, 14, 26, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.55)',
  },
  timerText: {
    color: NEON_ORANGE,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  paidToggleBtn: {
    alignSelf: 'center',
    backgroundColor: NEON_ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 10,
  },
  paidToggleText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  bottomControls: { alignItems: 'center', paddingHorizontal: 6 },
  timeChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(10,14,26,0.55)',
  },
  timeChipActive: {
    backgroundColor: NEON_ORANGE,
    borderColor: NEON_ORANGE,
  },
  timeChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  timeChipTextActive: { color: '#FFFFFF' },
  timeHint: { marginBottom: 10 },
  timeHintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  shutterWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  shutterWrapLive: {
    borderRadius: 48,
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: SHUTTER_RED,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  shutterSquare: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: SHUTTER_RED,
  },
  shutterInnerLive: {
    backgroundColor: SHUTTER_RED,
    borderColor: NEON_ORANGE,
    borderWidth: 4,
  },
  modeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    gap: 2,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  modeText: {
    color: '#8A99AD',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  activeModeText: {
    color: NEON_ORANGE,
  },
  modeUnderline: {
    marginTop: 4,
    height: 2,
    width: '70%',
    backgroundColor: NEON_ORANGE,
    borderRadius: 1,
  },
  modeTextDim: { opacity: 0.4 },
});
