/**
 * ChallengeCam live viewfinder — LOCKED.
 * Top: Close + title only · Bottom: flip + spinning dotted shutter.
 * Speed / slow-mo live exclusively on PreviewScreen (post-record).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Audio } from 'expo-av';
import BackLink from './src/components/BackLink';
import {
  persistLocalVideoUri,
  sanitizePlayableFeedUri,
} from './src/services/uploadService';
import PreviewScreen from './PreviewScreen';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const REC_RED = '#FF0033';
const MAX_DURATION_SEC = 60;
const VIDEO_QUALITY = '720p';
const DOT_COUNT = 28;

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Animated spinning dotted ring around solid red shutter — matches UniversalCamera. */
function DottedProgressRing({ progress, recording }) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [recording, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * DOT_COUNT);

  return (
    <Animated.View
      style={[ringStyles.ring, recording && { transform: [{ rotate }] }]}
      pointerEvents="none"
    >
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
        const r = 44;
        const x = 48 + Math.cos(angle) * r - 3;
        const y = 48 + Math.sin(angle) * r - 3;
        const active = recording ? i <= lit : false;
        return (
          <View
            key={`dot-${i}`}
            style={[
              ringStyles.dot,
              {
                left: x,
                top: y,
                backgroundColor: active ? '#FF0000' : 'rgba(255,0,0,0.35)',
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const ringStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

/**
 * @param {object} props
 * @param {() => void} [props.onClose]
 * @param {(uri: string, meta?: object) => void} [props.onContinue]
 * @param {number} [props.maxDurationSec]
 * @param {string} [props.challengeLabel]
 */
export default function ChallengeCamRecorder({
  onClose,
  onContinue,
  maxDurationSec = MAX_DURATION_SEC,
  challengeLabel = 'BATTLE RESPONSE',
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const recordingLockRef = useRef(false);
  const stoppingRef = useRef(false);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const maxSec = Math.max(5, Math.min(120, Number(maxDurationSec) || MAX_DURATION_SEC));

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState('back');
  const [speedRate, setSpeedRate] = useState(1);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [phase, setPhase] = useState('camera'); // camera | preview
  const [recordedUri, setRecordedUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopNativeRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      cameraRef.current?.stopRecording?.();
    } catch {
      /* ignore */
    }
  }, []);

  const cleanupSession = useCallback(async () => {
    clearTimer();
    recordingLockRef.current = false;
    stoppingRef.current = false;
    setIsRecording(false);
    setElapsedSec(0);
    if (isRecording) {
      await stopNativeRecording();
    }
  }, [clearTimer, isRecording, stopNativeRecording]);

  useEffect(() => {
    const camera = cameraRef.current;
    return () => {
      clearTimer();
      try {
        camera?.stopRecording?.();
      } catch {
        /* ignore */
      }
    };
  }, [clearTimer]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: true,
    }).catch(() => {});
  }, []);

  const handleClose = useCallback(async () => {
    await cleanupSession();
    setRecordedUri(null);
    setPhase('camera');
    setSpeedRate(1);
    onClose?.();
  }, [cleanupSession, onClose]);

  const flipCamera = useCallback(() => {
    if (isRecording || phase !== 'camera') return;
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setCameraReady(false);
  }, [isRecording, phase]);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(elapsed);
      if (elapsed >= maxSec) {
        void stopNativeRecording();
      }
    }, 250);
  }, [clearTimer, maxSec, stopNativeRecording]);

  const beginRecording = useCallback(async () => {
    if (
      phase !== 'camera' ||
      isRecording ||
      recordingLockRef.current ||
      !cameraReady ||
      !cameraRef.current?.recordAsync
    ) {
      return;
    }
    recordingLockRef.current = true;
    setError(null);
    setIsRecording(true);
    startTimer();
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: maxSec,
        mute: false,
      });
      clearTimer();
      setIsRecording(false);
      recordingLockRef.current = false;
      stoppingRef.current = false;
      const uri = result?.uri;
      if (!uri) {
        setError('Recording failed — no video URI.');
        return;
      }
      let stable = uri;
      try {
        stable = (await persistLocalVideoUri(uri)) || uri;
      } catch {
        stable = uri;
      }
      setRecordedUri(stable);
      setSpeedRate(1);
      setPhase('preview');
    } catch (err) {
      clearTimer();
      setIsRecording(false);
      recordingLockRef.current = false;
      stoppingRef.current = false;
      if (!String(err?.message || '').toLowerCase().includes('stop')) {
        setError(err?.message || 'Recording failed');
      }
    }
  }, [
    cameraReady,
    clearTimer,
    isRecording,
    maxSec,
    phase,
    startTimer,
  ]);

  const toggleRecord = useCallback(() => {
    if (phase !== 'camera' || busy) return;
    if (isRecording) {
      void stopNativeRecording();
      return;
    }
    void beginRecording();
  }, [beginRecording, busy, isRecording, phase, stopNativeRecording]);

  const handleRetake = useCallback(async () => {
    setBusy(true);
    setRecordedUri(null);
    setElapsedSec(0);
    setError(null);
    setSpeedRate(1);
    setPhase('camera');
    setBusy(false);
  }, []);

  const handleContinue = useCallback(
    async (payload) => {
      const handoffUri = sanitizePlayableFeedUri(
        payload?.videoUri || payload?.localVideoUri || payload?.uri || recordedUri
      );
      if (!handoffUri || busy) {
        if (!handoffUri) setError('Invalid clip URI — retake the recording');
        return;
      }
      setBusy(true);
      setUploadPct(0);
      setError(null);
      const elapsed = Math.max(
        1,
        elapsedSec || Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      const meta = {
        durationSec: Math.min(maxSec, elapsed),
        facing,
        flash: 'off',
        speedRate,
        videoQuality: VIDEO_QUALITY,
        mimeType: 'video/mp4',
        timestamp: Date.now(),
        localVideoUri: handoffUri,
        videoUri: handoffUri,
        onUploadProgress: (pct) => setUploadPct(pct),
      };
      try {
        await Promise.resolve(onContinue?.(handoffUri, meta));
      } catch (err) {
        setError(err?.message || 'Continue / upload failed');
      } finally {
        setBusy(false);
        setUploadPct(0);
      }
    },
    [
      busy,
      elapsedSec,
      facing,
      maxSec,
      onContinue,
      recordedUri,
      speedRate,
    ]
  );

  const requestPerms = useCallback(() => {
    void requestCamPerm();
    void requestMicPerm();
  }, [requestCamPerm, requestMicPerm]);

  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;
  const progress =
    isRecording && maxSec > 0 ? Math.min(1, elapsedSec / maxSec) : 0;

  if (!camPerm?.granted || !micPerm?.granted) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Text style={styles.permTitle}>Camera & mic needed</Text>
        <Text style={styles.hint}>
          Grant lens + microphone to record your battle response.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPerms}>
          <Text style={styles.primaryBtnText}>GRANT ACCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
          <Text style={styles.hint}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'preview' && recordedUri) {
    return (
      <PreviewScreen
        uri={recordedUri}
        speedRate={speedRate}
        onSpeedChange={setSpeedRate}
        onRetake={handleRetake}
        onContinue={handleContinue}
        busy={busy}
        uploadPct={uploadPct}
        error={error}
        title="PREVIEW"
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        flash="off"
        enableTorch={false}
        mute={false}
        mirror={facing === 'front'}
        videoQuality={VIDEO_QUALITY}
        onCameraReady={() => {
          setCameraReady(true);
          setError(null);
        }}
        onMountError={(e) => {
          setError(
            e?.message ||
              (Platform.OS === 'android'
                ? 'Camera surface failed to bind'
                : 'Camera failed to start')
          );
          setCameraReady(false);
        }}
      />

      {/* LOCKED top chrome — Close + title only */}
      <View style={[styles.topBar, { paddingTop: topPad }]} pointerEvents="box-none">
        <BackLink label="Close" onPress={busy ? () => {} : handleClose} />
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>CHALLENGE CAM</Text>
          <Text style={styles.topSub} numberOfLines={1}>
            {challengeLabel}
          </Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      {isRecording ? (
        <View style={styles.timerPill} pointerEvents="none">
          <View style={styles.recDot} />
          <Text style={styles.recLiveLabel}>REC</Text>
          <Text style={styles.timerText}>{formatTimer(elapsedSec)}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* LOCKED bottom — Flip + dotted spinning shutter */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {!cameraReady && !error ? (
          <Text style={styles.hint}>Starting lens…</Text>
        ) : null}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={flipCamera}
            disabled={isRecording}
            activeOpacity={0.8}
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.flipBtnText}>FLIP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterWrap}
            onPress={toggleRecord}
            disabled={!cameraReady && !isRecording}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <DottedProgressRing progress={progress} recording={isRecording} />
            <View
              style={[styles.shutterCore, isRecording && styles.shutterCoreLive]}
            />
          </TouchableOpacity>

          <View style={styles.flipBtnPlaceholder} />
        </View>
        <Text style={styles.shutterHint}>
          {isRecording ? 'TAP TO STOP' : `TAP TO RECORD · MAX ${maxSec}s`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  topSub: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    maxWidth: 180,
  },
  topSpacer: {
    minWidth: 72,
  },
  timerPill: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 15,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: REC_RED,
  },
  recLiveLabel: {
    color: REC_RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  timerText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  bottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  flipBtn: {
    minWidth: 64,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  flipBtnPlaceholder: {
    minWidth: 64,
  },
  flipBtnText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  shutterWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: REC_RED,
  },
  shutterCoreLive: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  shutterHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: WHITE,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  permTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  hint: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 28,
    marginTop: 12,
  },
  errorBanner: {
    position: 'absolute',
    top: '28%',
    left: 20,
    right: 20,
    zIndex: 16,
  },
  errorText: {
    color: REC_RED,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
});
