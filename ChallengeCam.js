import React, { useState, useEffect, useRef, Component, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

const ORANGE = '#FF6B00';
const CANVAS = '#050505';
const SURFACE = '#0A0A0C';
const CARD_BORDER = 'rgba(255, 255, 255, 0.12)';
const RECORD_SECONDS = 60;

/** Catches native CameraView render crashes (common on Android emulator). */
class CameraErrorBoundary extends Component {
  state = { hasError: false, message: null };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Camera view failed to render',
    };
  }

  componentDidCatch(error) {
    console.warn('CameraView crash caught:', error?.message || error);
    this.props.onError?.(error?.message || 'Camera view failed to render');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

/**
 * Decaying orange progress ring (Views only — no SVG).
 * progress: 1 = full ring, 0 = empty. Uses tick segments so decay is visible each second.
 */
function OrangeCountdownRing({ progress, size = 54, children }) {
  const p = Math.max(0, Math.min(1, progress));
  const ticks = 24;
  const lit = Math.round(p * ticks);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const deg = (i / ticks) * 360;
        const active = i < lit;
        return (
          <View
            key={`tick-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              justifyContent: 'flex-start',
              alignItems: 'center',
              transform: [{ rotate: `${deg}deg` }],
            }}
          >
            <View
              style={{
                width: 3,
                height: 6,
                borderRadius: 1.5,
                marginTop: 1,
                backgroundColor: active ? ORANGE : 'rgba(255, 107, 0, 0.18)',
              }}
            />
          </View>
        );
      })}
      {children}
    </View>
  );
}

function CameraFallbackSurface({ message, isRecording, onRetry }) {
  return (
    <View style={styles.fallbackSurface}>
      <Text style={styles.overlayText}>LENS UNAVAILABLE</Text>
      <Text style={styles.overlaySub}>
        {message ||
          'Android emulator has no reliable camera hardware. Recording will use a safe fallback.'}
      </Text>
      {isRecording && <Text style={styles.fallbackLive}>● SIMULATED RECORDING</Text>}
      {!!onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>RETRY CAMERA</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ChallengeCam({
  route,
  navigation,
  targetUser,
  challengeTarget: challengeTargetProp,
  onClose,
  onVideoCaptured,
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const recordWatchdog = useRef(null);
  const stoppingRef = useRef(false);
  const secondsLeftRef = useRef(RECORD_SECONDS);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [timeUp, setTimeUp] = useState(false);
  const [facing, setFacing] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isMockClip, setIsMockClip] = useState(false);
  const [mountError, setMountError] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const [frozen, setFrozen] = useState(false);

  const challengeTarget =
    challengeTargetProp ||
    route?.params?.target ||
    route?.params?.reel?.statSticker ||
    '140 KG x 3 Reps';

  const opponentHandle =
    targetUser ||
    route?.params?.handle ||
    route?.params?.reel?.creator ||
    'Yuki_Lift';
  const displayHandle = opponentHandle.startsWith('@')
    ? opponentHandle
    : `@${opponentHandle}`;

  const cameraUnavailable = useFallback || !!mountError;
  const progress = secondsLeft / RECORD_SECONDS;
  const canPost = !!recordedUri || timeUp || frozen;

  const formatClock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopRecordingNative = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      cameraRef.current?.stopRecording?.();
    } catch (_) {
      /* ignore */
    }
  }, []);

  const lockResponse = useCallback((uri, { mock = false, fromTimer = false } = {}) => {
    if (recordWatchdog.current) {
      clearTimeout(recordWatchdog.current);
      recordWatchdog.current = null;
    }
    setIsRecording(false);
    setFrozen(true);
    if (fromTimer) {
      setTimeUp(true);
      setSecondsLeft(0);
    }
    setIsMockClip(mock);
    setRecordedUri(uri || `emulator-mock://${Date.now()}.mp4`);
    stoppingRef.current = false;
  }, []);

  // Countdown while recording
  useEffect(() => {
    if (!isRecording) return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        secondsLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Auto-stop at 00
  useEffect(() => {
    if (!isRecording || secondsLeft > 0) return;
    (async () => {
      await stopRecordingNative();
      if (cameraUnavailable) {
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true, fromTimer: true });
      } else {
        // recordAsync will resolve when stopRecording is called; lock with timer flag
        setTimeUp(true);
        setFrozen(true);
        setIsRecording(false);
        setSecondsLeft(0);
      }
    })();
  }, [secondsLeft, isRecording, cameraUnavailable, stopRecordingNative, lockResponse]);

  useEffect(() => {
    return () => {
      if (recordWatchdog.current) clearTimeout(recordWatchdog.current);
      try {
        cameraRef.current?.stopRecording?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  const handleClose = () => {
    if (isRecording) {
      try {
        cameraRef.current?.stopRecording?.();
      } catch (_) {
        /* ignore */
      }
      setIsRecording(false);
    }
    if (onClose) {
      onClose();
      return;
    }
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const toggleFacing = () => {
    if (isRecording || cameraUnavailable || frozen) return;
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setCameraReady(false);
  };

  const activateFallback = (reason) => {
    console.warn('Camera fallback:', reason);
    setMountError(reason || 'Camera hardware unavailable');
    setUseFallback(true);
    setCameraReady(false);
    setIsRecording(false);
  };

  const retryCamera = () => {
    if (frozen || isRecording) return;
    setMountError(null);
    setUseFallback(false);
    setCameraReady(false);
    setCameraKey((k) => k + 1);
  };

  const handleRecordPress = async () => {
    if (frozen || recordedUri) return;

    if (cameraUnavailable) {
      if (isRecording) {
        if (recordWatchdog.current) clearTimeout(recordWatchdog.current);
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true });
        return;
      }
      setTimeUp(false);
      secondsLeftRef.current = RECORD_SECONDS;
      setSecondsLeft(RECORD_SECONDS);
      setIsRecording(true);
      recordWatchdog.current = setTimeout(() => {
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true, fromTimer: true });
      }, RECORD_SECONDS * 1000);
      return;
    }

    if (!cameraRef.current || !cameraReady) return;

    if (isRecording) {
      try {
        cameraRef.current.stopRecording();
      } catch (error) {
        activateFallback(error?.message || 'Stop recording failed');
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true });
      }
      return;
    }

    try {
      setTimeUp(false);
      secondsLeftRef.current = RECORD_SECONDS;
      setSecondsLeft(RECORD_SECONDS);
      setIsRecording(true);
      stoppingRef.current = false;
      const video = await cameraRef.current.recordAsync({ maxDuration: RECORD_SECONDS });
      const hitZero = secondsLeftRef.current <= 0;
      setIsRecording(false);
      setFrozen(true);
      if (hitZero) {
        setTimeUp(true);
        setSecondsLeft(0);
        secondsLeftRef.current = 0;
      }
      if (video?.uri) {
        setIsMockClip(false);
        setRecordedUri(video.uri);
      } else {
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true, fromTimer: hitZero });
      }
    } catch (error) {
      setIsRecording(false);
      const msg = error?.message || String(error);
      console.warn('Recording failed:', msg);
      activateFallback(msg);
      lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true });
    }
  };

  const handleRetake = () => {
    setRecordedUri(null);
    setIsMockClip(false);
    setIsRecording(false);
    setFrozen(false);
    setTimeUp(false);
    secondsLeftRef.current = RECORD_SECONDS;
    setSecondsLeft(RECORD_SECONDS);
    stoppingRef.current = false;
    if (!cameraUnavailable) {
      setCameraReady(false);
      setCameraKey((k) => k + 1);
    }
  };

  const handlePostBattle = () => {
    if (!canPost && !recordedUri) return;
    const uri = recordedUri || `emulator-mock://${Date.now()}.mp4`;
    try {
      if (onVideoCaptured) {
        onVideoCaptured(uri, { isMock: isMockClip || uri.startsWith('emulator-mock://') });
        return;
      }
      if (navigation?.navigate) {
        navigation.navigate('Arena', { recordedUri: uri });
        return;
      }
      handleClose();
    } catch (error) {
      console.warn('Post battle failed:', error?.message || error);
      handleClose();
    }
  };

  const permissionsLoading = !permission || !micPermission;
  const permissionsGranted = permission?.granted && micPermission?.granted;

  const requestAllPermissions = async () => {
    try {
      if (!permission?.granted) await requestPermission();
      if (!micPermission?.granted) await requestMicPermission();
    } catch (error) {
      console.warn('Permission request failed:', error?.message || error);
    }
  };

  const timerLabel = timeUp
    ? 'TIME UP • 00s'
    : isRecording
      ? `• ${formatClock(secondsLeft)}`
      : formatClock(RECORD_SECONDS);

  const responseStatus = timeUp
    ? 'TIME UP • 00s'
    : isRecording
      ? `• ${formatClock(secondsLeft)}`
      : frozen
        ? 'LOCKED'
        : cameraUnavailable
          ? 'FALLBACK'
          : 'READY';

  if (permissionsLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={CANVAS} />
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={styles.permissionHint}>Checking lens access…</Text>
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <StatusBar barStyle="light-content" backgroundColor={CANVAS} />
        <Text style={styles.permissionEyebrow}>BAWAAL ARENA</Text>
        <Text style={styles.permissionTitle}>Camera access required</Text>
        <Text style={styles.permissionHint}>
          Allow camera and microphone to record your side-by-side battle response.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={requestAllPermissions}
          activeOpacity={0.85}
        >
          <Text style={styles.permissionBtnText}>GRANT ACCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.ghostBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={CANVAS} />

      {/* Top Header: [X CANCEL] | BAWAAL | [FLIP] */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleClose} activeOpacity={0.75}>
          <Text style={styles.headerBtnText}>✕ CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.brandTitle}>BAWAAL</Text>
        <TouchableOpacity
          style={[
            styles.headerBtn,
            styles.headerBtnRight,
            (isRecording || cameraUnavailable || frozen) && styles.headerBtnDisabled,
          ]}
          onPress={toggleFacing}
          disabled={isRecording || cameraUnavailable || frozen}
          activeOpacity={0.75}
        >
          <Text style={styles.headerBtnText}>FLIP</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.splitContainer}>
        {/* ORIGINAL POST */}
        <View style={styles.cardHalf}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.metaLabel}>ORIGINAL POST</Text>
              <Text style={styles.metaHandle}>{displayHandle}</Text>
            </View>
            <View style={styles.timerBadge}>
              <OrangeCountdownRing
                progress={isRecording || timeUp ? progress : 1}
                size={54}
                stroke={3}
              >
                <Text
                  style={[
                    styles.timerBadgeText,
                    (isRecording || timeUp) && styles.timerBadgeTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {timerLabel}
                </Text>
              </OrangeCountdownRing>
            </View>
          </View>

          <View style={styles.mediaPlaceholder}>
            <Text style={styles.placeholderText}>Original reel</Text>
          </View>

          <View style={styles.targetBadgeWrap} pointerEvents="none">
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>TARGET: {challengeTarget}</Text>
            </View>
          </View>
        </View>

        {/* VS */}
        <View style={styles.vsBadgeContainer}>
          <View style={styles.vsBadge}>
            <Text style={styles.vsBadgeText}>VS</Text>
          </View>
        </View>

        {/* YOUR RESPONSE */}
        <View style={styles.cardHalf}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.metaLabel}>YOUR RESPONSE</Text>
            <Text
              style={[
                styles.metaStatus,
                (isRecording || timeUp) && styles.metaStatusLive,
              ]}
            >
              {responseStatus}
            </Text>
          </View>

          <View
            style={[
              styles.cameraViewport,
              isRecording && styles.viewportRecording,
              (frozen || timeUp) && styles.viewportFrozen,
            ]}
          >
            {cameraUnavailable ? (
              <CameraFallbackSurface
                message={mountError}
                isRecording={isRecording}
                onRetry={frozen ? undefined : retryCamera}
              />
            ) : (
              <CameraErrorBoundary
                onError={activateFallback}
                fallback={
                  <CameraFallbackSurface
                    message={mountError}
                    isRecording={isRecording}
                    onRetry={frozen ? undefined : retryCamera}
                  />
                }
              >
                <CameraView
                  key={cameraKey}
                  ref={cameraRef}
                  style={styles.camera}
                  facing={facing}
                  mode="video"
                  mute={false}
                  mirror={facing === 'front'}
                  onCameraReady={() => {
                    setCameraReady(true);
                    setMountError(null);
                    setUseFallback(false);
                  }}
                  onMountError={(event) => {
                    const msg =
                      event?.message ||
                      (Platform.OS === 'android'
                        ? 'Emulator camera surface failed to bind'
                        : 'Camera failed to start');
                    activateFallback(msg);
                  }}
                />
              </CameraErrorBoundary>
            )}

            {!cameraUnavailable && !cameraReady && !mountError && !frozen && (
              <View style={styles.cameraOverlay} pointerEvents="none">
                <ActivityIndicator color={ORANGE} />
                <Text style={styles.overlayText}>STARTING LENS</Text>
              </View>
            )}

            {(frozen || timeUp) && (
              <View style={styles.freezeOverlay} pointerEvents="none">
                <Text style={styles.freezeTitle}>
                  {timeUp ? 'TIME UP • 00s' : 'RESPONSE LOCKED'}
                </Text>
                <Text style={styles.freezeSub}>
                  {isMockClip ? 'Fallback clip ready' : 'Tap POST BATTLE to send'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Bottom: record ring + POST BATTLE */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[
            styles.recordRing,
            isRecording && styles.recordRingLive,
            ((!cameraUnavailable && !cameraReady) || frozen) && styles.recordDisabled,
          ]}
          onPress={handleRecordPress}
          disabled={(!cameraUnavailable && !cameraReady) || frozen}
          activeOpacity={0.85}
        >
          <View style={[styles.recordInner, isRecording && styles.recordInnerStop]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.postBattleBtn, !canPost && styles.postBattleBtnDisabled]}
          onPress={handlePostBattle}
          disabled={!canPost}
          activeOpacity={0.85}
        >
          <Text style={styles.postBattleText}>POST BATTLE ⚡</Text>
        </TouchableOpacity>

        {frozen && (
          <TouchableOpacity style={styles.retakeLink} onPress={handleRetake} activeOpacity={0.7}>
            <Text style={styles.retakeLinkText}>RETAKE</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CANVAS,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  permissionEyebrow: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 28,
  },
  permissionBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  permissionBtnText: {
    color: CANVAS,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ghostBtnText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 84,
  },
  headerBtnRight: {
    alignItems: 'flex-end',
  },
  headerBtnDisabled: {
    opacity: 0.35,
  },
  headerBtnText: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  splitContainer: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  cardHalf: {
    flex: 0.48,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 54,
  },
  cardHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  metaHandle: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  metaStatus: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metaStatusLive: {
    color: ORANGE,
  },
  timerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadgeText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    maxWidth: 44,
  },
  timerBadgeTextActive: {
    color: ORANGE,
  },
  mediaPlaceholder: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraViewport: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  viewportRecording: {
    borderColor: '#FF0000',
    borderWidth: 1.5,
  },
  viewportFrozen: {
    borderColor: 'rgba(255,107,0,0.55)',
    borderWidth: 1.5,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,5,0.55)',
    paddingHorizontal: 16,
  },
  freezeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,5,0.72)',
    paddingHorizontal: 16,
  },
  freezeTitle: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  freezeSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  fallbackSurface: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#080808',
  },
  overlayText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 10,
    textAlign: 'center',
  },
  overlaySub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  fallbackLive: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.8,
  },
  retryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  targetBadgeWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  targetBadge: {
    alignSelf: 'center',
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  targetBadgeText: {
    color: CANVAS,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  vsBadgeContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginVertical: -12,
  },
  vsBadge: {
    backgroundColor: ORANGE,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: CANVAS,
  },
  vsBadgeText: {
    color: CANVAS,
    fontWeight: '900',
    fontSize: 11,
  },
  bottomControls: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  recordRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  recordRingLive: {
    borderColor: '#FF0000',
  },
  recordDisabled: {
    opacity: 0.35,
  },
  recordInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ORANGE,
  },
  recordInnerStop: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  postBattleBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  postBattleBtnDisabled: {
    opacity: 0.35,
  },
  postBattleText: {
    color: CANVAS,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  retakeLink: {
    marginTop: 12,
    paddingVertical: 6,
  },
  retakeLinkText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
