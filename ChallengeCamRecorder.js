/**
 * ChallengeCam Step 1 — full-screen record → local preview → Re-take / Continue.
 * Uses expo-camera for capture and expo-av for preview playback.
 * (UniversalCamera remains the locked create-FAB surface — do not merge flash chrome there.)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Audio, ResizeMode, Video } from 'expo-av';
import BackLink from './src/components/BackLink';
import { persistLocalVideoUri } from './src/services/uploadService';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#3B82F6';
const REC_RED = '#FF0033';
const CONTINUE = '#FACC15';
const MAX_DURATION_SEC = 60;
const VIDEO_QUALITY = '720p';

const FLASH_CYCLE = ['off', 'on', 'auto'];

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function flashLabel(mode) {
  const m = String(mode || 'off').toUpperCase();
  if (m === 'ON') return 'FLASH ON';
  if (m === 'AUTO') return 'FLASH AUTO';
  return 'FLASH OFF';
}

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
  const videoRef = useRef(null);
  const recordingLockRef = useRef(false);
  const stoppingRef = useRef(false);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const maxSec = Math.max(5, Math.min(120, Number(maxDurationSec) || MAX_DURATION_SEC));

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [phase, setPhase] = useState('camera'); // camera | preview
  const [recordedUri, setRecordedUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const unloadPreview = useCallback(async () => {
    try {
      await videoRef.current?.unloadAsync?.();
    } catch {
      /* ignore */
    }
    videoRef.current = null;
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
    await unloadPreview();
  }, [clearTimer, isRecording, stopNativeRecording, unloadPreview]);

  useEffect(() => {
    const camera = cameraRef.current;
    return () => {
      clearTimer();
      void unloadPreview();
      try {
        camera?.stopRecording?.();
      } catch {
        /* ignore */
      }
    };
  }, [clearTimer, unloadPreview]);

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
    onClose?.();
  }, [cleanupSession, onClose]);

  const cycleFlash = useCallback(() => {
    if (isRecording || phase !== 'camera') return;
    setFlash((prev) => {
      const i = FLASH_CYCLE.indexOf(prev);
      return FLASH_CYCLE[(i + 1) % FLASH_CYCLE.length];
    });
  }, [isRecording, phase]);

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
        clearTimer();
        void stopNativeRecording();
      }
    }, 250);
  }, [clearTimer, maxSec, stopNativeRecording]);

  const beginRecording = useCallback(async () => {
    if (
      recordingLockRef.current ||
      isRecording ||
      phase !== 'camera' ||
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
    await unloadPreview();
    setRecordedUri(null);
    setElapsedSec(0);
    setError(null);
    setPhase('camera');
    setBusy(false);
  }, [unloadPreview]);

  const handleContinue = useCallback(async () => {
    if (!recordedUri || busy) return;
    setBusy(true);
    await unloadPreview();
    const elapsed = Math.max(
      1,
      elapsedSec || Math.round((Date.now() - startedAtRef.current) / 1000)
    );
    onContinue?.(recordedUri, {
      durationSec: Math.min(maxSec, elapsed),
      facing,
      flash,
      videoQuality: VIDEO_QUALITY,
      mimeType: 'video/mp4',
      timestamp: Date.now(),
    });
    setBusy(false);
  }, [
    busy,
    elapsedSec,
    facing,
    flash,
    maxSec,
    onContinue,
    recordedUri,
    unloadPreview,
  ]);

  const requestPerms = async () => {
    try {
      if (!camPerm?.granted) await requestCamPerm();
      if (!micPerm?.granted) await requestMicPerm();
    } catch (err) {
      setError(err?.message || 'Permission request failed');
    }
  };

  if (!camPerm || !micPerm) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <ActivityIndicator color={WHITE} size="large" />
        <Text style={styles.hint}>Checking camera & microphone…</Text>
      </View>
    );
  }

  if (!camPerm.granted || !micPerm.granted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Text style={styles.permTitle}>Camera & mic required</Text>
        <Text style={styles.hint}>
          Grant lens + microphone to record your battle response.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPerms} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>GRANT PERMISSIONS</Text>
        </TouchableOpacity>
        <BackLink label="Back" onPress={handleClose} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const torchOn = flash === 'on' && facing === 'back';
  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;

  if (phase === 'preview' && recordedUri) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Video
          ref={videoRef}
          style={StyleSheet.absoluteFill}
          source={{ uri: recordedUri }}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          useNativeControls={false}
          onError={(e) => {
            console.warn('[ChallengeCamRecorder] preview error', e);
            setError('Preview playback failed');
          }}
        />
        <View style={[styles.topBar, { paddingTop: topPad }]} pointerEvents="box-none">
          <BackLink label="Back" onPress={handleClose} />
          <Text style={styles.topTitle}>PREVIEW</Text>
          <View style={{ width: 72 }} />
        </View>
        <View style={[styles.previewFooter, { paddingBottom: bottomPad }]}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleRetake}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.retakeBtnText}>RE-TAKE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleContinue}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={BG} />
              ) : (
                <Text style={styles.continueBtnText}>CONTINUE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
        flash={flash}
        enableTorch={torchOn}
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

      <View style={[styles.topBar, { paddingTop: topPad }]} pointerEvents="box-none">
        <BackLink label="Close" onPress={handleClose} />
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>CHALLENGE CAM</Text>
          <Text style={styles.topSub} numberOfLines={1}>
            {challengeLabel}
          </Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.chipBtn}
            onPress={cycleFlash}
            disabled={isRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.chipBtnText}>{flashLabel(flash)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chipBtn}
            onPress={flipCamera}
            disabled={isRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.chipBtnText}>FLIP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isRecording ? (
        <View style={styles.timerPill} pointerEvents="none">
          <View style={styles.recDot} />
          <Text style={styles.timerText}>{formatTimer(elapsedSec)}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {!cameraReady && !error ? (
          <Text style={styles.hint}>Starting lens…</Text>
        ) : null}
        <TouchableOpacity
          style={styles.shutterHit}
          onPress={toggleRecord}
          disabled={!cameraReady && !isRecording}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <View style={[styles.shutterRing, isRecording && styles.shutterRingLive]}>
            <View style={[styles.shutterCore, isRecording && styles.shutterCoreLive]} />
          </View>
        </TouchableOpacity>
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
    maxWidth: 160,
  },
  topRight: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 96,
  },
  chipBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipBtnText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  timerPill: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: REC_RED,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 15,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: REC_RED,
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
  shutterHit: {
    padding: 8,
  },
  shutterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: REC_RED,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shutterRingLive: {
    borderColor: WHITE,
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
    backgroundColor: REC_RED,
  },
  shutterHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  previewFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  continueBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: CONTINUE,
    backgroundColor: CONTINUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    color: BG,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: ACCENT,
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
