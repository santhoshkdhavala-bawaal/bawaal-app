import React, { useState, useEffect, useRef, Component, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS, RADIUS } from './theme';
import { setLatestBattleClip } from './battleClipStore';
import { pushArenaPost } from './arenaFeedStore';
import { postBattleResponseToSupabase } from './src/services/battleResponseService';
import { persistLocalVideoUri } from './src/services/uploadService';

const DURATION_OPTIONS = [5, 15, 30, 60];
const DEFAULT_DURATION = 30;

function snapChallengeDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DURATION;
  let best = DURATION_OPTIONS[0];
  let bestDiff = Math.abs(best - n);
  for (let i = 1; i < DURATION_OPTIONS.length; i += 1) {
    const opt = DURATION_OPTIONS[i];
    const diff = Math.abs(opt - n);
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best;
}
const ACTIVE_REC = '#FF0033';
const PLATINUM = '#E5E5E5';
const OBSIDIAN = '#000000';
/** Balanced hardware encode — avoids oversized files / upload lag */
const VIDEO_QUALITY = '720p';
const TARGET_FPS = 30;

/** Bundled opponent fallback when Arena does not pass a target URI. */
const OPPONENT_FALLBACK_ASSET = require('./assets/sample_challenge.mp4');
const OPPONENT_FALLBACK_REMOTE =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

/**
 * Reports CameraView render errors without unmounting children.
 * Replacing CameraView on error detaches Android viewState and crashes record/review.
 */
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
    // Always keep children mounted — overlay fallback is handled by parent.
    return this.props.children;
  }
}

/**
 * Circular progress ring around the shutter — fills as recording approaches the
 * selected time limit (Views only, no SVG dependency).
 */
function ShutterProgressRing({ progress, size = 92, recording = false, children }) {
  const p = Math.max(0, Math.min(1, progress));
  const ticks = 48;
  const lit = Math.round(p * ticks);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const deg = (i / ticks) * 360;
        const active = recording && i < lit;
        return (
          <View
            key={`shutter-tick-${i}`}
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
                height: active ? 9 : 6,
                borderRadius: 2,
                marginTop: 1,
                backgroundColor: active
                  ? ACTIVE_REC
                  : recording
                    ? 'rgba(229,228,226,0.18)'
                    : 'rgba(229,228,226,0.28)',
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

const SLOW_MO_RATES = [0.25, 0.5, 0.75];
const MIN_SLOW_MO_SPAN = 0.25;

function isPlayableReviewUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  if (uri.startsWith('emulator-mock://')) return false;
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('/')
  );
}

function resolveOpponentSource(uri) {
  if (isPlayableReviewUri(uri)) return { uri };
  if (OPPONENT_FALLBACK_ASSET != null) return OPPONENT_FALLBACK_ASSET;
  return { uri: OPPONENT_FALLBACK_REMOTE };
}

/** TARGET: [Exercise] • [Reps/Sets] • [Duration] */
function buildTargetMetricsLabel(rawTarget, durationSec, extras = {}) {
  const dur = `${snapChallengeDuration(durationSec)}s`;
  const exerciseExtra = extras.exercise || extras.lift || null;
  const repsExtra = extras.reps || extras.sets || extras.repLabel || null;

  let raw = String(rawTarget || '').trim().replace(/^TARGET:\s*/i, '');
  if (!raw) raw = 'Challenge';

  let exercise = exerciseExtra;
  let reps = repsExtra;

  if (raw.includes('•')) {
    const parts = raw.split('•').map((p) => p.trim()).filter(Boolean);
    const withoutDur = parts.filter((p) => !/^\d+\s*s$/i.test(p));
    if (!exercise && withoutDur[0]) exercise = withoutDur[0];
    if (!reps && withoutDur[1]) reps = withoutDur[1];
  } else {
    const xMatch = raw.match(/^(.+?)\s*[x×]\s*(.+)$/i);
    if (xMatch) {
      if (!exercise) exercise = xMatch[1].trim();
      if (!reps) reps = xMatch[2].trim();
    } else if (!exercise) {
      exercise = raw;
    }
  }

  const segments = [exercise || raw, reps || null, dur].filter(Boolean);
  return `TARGET: ${segments.join(' • ')}`;
}

/**
 * Review player — loads file:// URI immediately after a take.
 * Slow-mo ON: loops strictly inside [start, end] at 0.25x / 0.5x / 0.75x.
 * Slow-mo OFF: full-clip loop at 1x so athletes always see their take.
 */
function ReviewSlowMoPlayer({
  uri,
  active = true,
  slowMoEnabled,
  slowMoStartSec,
  slowMoEndSec,
  slowMoRate,
  playheadRef,
  videoRef,
}) {
  const playable = isPlayableReviewUri(uri);
  const source = playable ? { uri } : null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = false;
    p.preservesPitch = true;
    p.timeUpdateEventInterval = 0.04;
  });
  const loadedUriRef = useRef(null);
  const seekingRef = useRef(false);
  const slowMoCfgRef = useRef({
    enabled: slowMoEnabled,
    start: slowMoStartSec,
    end: slowMoEndSec,
    rate: slowMoRate,
  });

  useEffect(() => {
    slowMoCfgRef.current = {
      enabled: !!slowMoEnabled,
      start: Math.max(0, Number(slowMoStartSec) || 0),
      end: Math.max(
        (Number(slowMoStartSec) || 0) + MIN_SLOW_MO_SPAN,
        Number(slowMoEndSec) || MIN_SLOW_MO_SPAN
      ),
      rate: Number(slowMoRate) || 0.5,
    };
  }, [slowMoEnabled, slowMoStartSec, slowMoEndSec, slowMoRate]);

  useEffect(() => {
    if (videoRef) videoRef.current = player;
    return () => {
      if (videoRef && videoRef.current === player) {
        videoRef.current = null;
      }
    };
  }, [player, videoRef]);

  const seekTo = useCallback(
    (sec) => {
      try {
        seekingRef.current = true;
        const t = Math.max(0, sec);
        if (typeof player.seekBy === 'function') {
          // seekBy is relative — prefer currentTime assignment
        }
        player.currentTime = t;
        if (playheadRef) playheadRef.current = t;
      } catch (_) {
        /* ignore */
      } finally {
        setTimeout(() => {
          seekingRef.current = false;
        }, 80);
      }
    },
    [player, playheadRef]
  );

  const applyPlaybackForConfig = useCallback(() => {
    const cfg = slowMoCfgRef.current;
    try {
      player.preservesPitch = true;
      if (cfg.enabled) {
        player.loop = false;
        player.playbackRate = cfg.rate;
        seekTo(cfg.start);
      } else {
        player.loop = true;
        player.playbackRate = 1;
      }
      if (active) {
        player.play();
      } else {
        player.pause();
      }
    } catch (_) {
      /* ignore */
    }
  }, [player, active, seekTo]);

  // Load / reload local file URI into the player as soon as a take lands
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!playable || !uri) {
        loadedUriRef.current = null;
        try {
          player.pause();
        } catch (_) {
          /* ignore */
        }
        return;
      }
      try {
        if (loadedUriRef.current !== uri) {
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync({ uri });
          } else if (typeof player.replace === 'function') {
            player.replace({ uri });
          }
          if (cancelled) return;
          loadedUriRef.current = uri;
        }
        if (active) {
          // Small delay so replace settles before play/seek
          requestAnimationFrame(() => {
            if (!cancelled) applyPlaybackForConfig();
          });
        } else {
          player.pause();
        }
      } catch (err) {
        console.warn('[review] load failed:', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, uri, playable, active, applyPlaybackForConfig]);

  // Slider / speed → live windowed loop
  useEffect(() => {
    if (!active || !playable) return;
    applyPlaybackForConfig();
  }, [
    slowMoEnabled,
    slowMoStartSec,
    slowMoEndSec,
    slowMoRate,
    active,
    playable,
    applyPlaybackForConfig,
  ]);

  useEffect(() => {
    const sub = player.addListener?.('timeUpdate', (payload) => {
      if (seekingRef.current) return;
      const currentSec =
        typeof payload?.currentTime === 'number' ? payload.currentTime : player.currentTime || 0;
      if (playheadRef) playheadRef.current = currentSec;
      const cfg = slowMoCfgRef.current;
      if (!cfg.enabled || !active) return;
      try {
        if (currentSec < cfg.start - 0.05) {
          seekTo(cfg.start);
          player.playbackRate = cfg.rate;
          player.play();
          return;
        }
        if (currentSec >= cfg.end - 0.05) {
          seekTo(cfg.start);
          player.playbackRate = cfg.rate;
          player.play();
        } else if (Math.abs((player.playbackRate || 1) - cfg.rate) > 0.01) {
          player.preservesPitch = true;
          player.playbackRate = cfg.rate;
        }
      } catch (_) {
        /* ignore */
      }
    });
    // Also listen for playToEnd when loop is false
    const endSub = player.addListener?.('playToEnd', () => {
      const cfg = slowMoCfgRef.current;
      if (!cfg.enabled || !active) return;
      try {
        seekTo(cfg.start);
        player.playbackRate = cfg.rate;
        player.play();
      } catch (_) {
        /* ignore */
      }
    });
    return () => {
      try {
        sub?.remove?.();
      } catch (_) {
        /* ignore */
      }
      try {
        endSub?.remove?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [player, playheadRef, seekTo, active]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (_) {
        /* ignore */
      }
    };
  }, [player]);

  if (!playable) {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: OBSIDIAN }]} />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject} collapsable={false}>
      <VideoView
        key={`review-vv-${uri}`}
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

/** Permanently-mounted opponent clip — stable player, replaceAsync only. */
function OpponentTargetPlayer({ uri, active = true }) {
  const player = useVideoPlayer(OPPONENT_FALLBACK_ASSET, (p) => {
    p.loop = true;
    p.muted = true;
    try {
      p.play();
    } catch (_) {
      /* ignore */
    }
  });
  const loadedKeyRef = useRef('asset');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = resolveOpponentSource(uri);
      const key =
        typeof next === 'number'
          ? `asset:${next}`
          : next?.uri
            ? `uri:${next.uri}`
            : 'asset';
      try {
        if (loadedKeyRef.current !== key) {
          await player.replaceAsync(next);
          if (cancelled) return;
          loadedKeyRef.current = key;
        }
        player.loop = true;
        player.muted = true;
        if (active) {
          player.play();
        } else {
          player.pause();
        }
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, uri, active]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (_) {
        /* ignore */
      }
      try {
        if (typeof player.replace === 'function') {
          player.replace(null);
        }
      } catch (_) {
        /* ignore */
      }
    };
  }, [player]);

  return (
    <VideoView
      style={styles.targetVideo}
      player={player}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

/**
 * Dual-marker timeline — range handles (start/end) are React state;
 * playhead cursor reads playheadRef via rAF so playback ticks never re-render the parent.
 */
function SlowMoRangeSlider({
  duration,
  startSec,
  endSec,
  playheadRef,
  onChangeStart,
  onChangeEnd,
}) {
  const trackRef = useRef(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const startRef = useRef(startSec);
  const endRef = useRef(endSec);
  const durationRef = useRef(duration);
  const activeThumb = useRef(null);
  const onChangeStartRef = useRef(onChangeStart);
  const onChangeEndRef = useRef(onChangeEnd);
  const [playPct, setPlayPct] = useState(0);

  useEffect(() => {
    startRef.current = startSec;
    endRef.current = endSec;
    durationRef.current = duration;
  }, [startSec, endSec, duration]);

  useEffect(() => {
    onChangeStartRef.current = onChangeStart;
    onChangeEndRef.current = onChangeEnd;
  }, [onChangeStart, onChangeEnd]);

  // Smooth playhead — independent of range-handle state updates
  useEffect(() => {
    let raf = 0;
    let lastPct = -1;
    const tick = () => {
      const dur = Math.max(0.001, durationRef.current || 1);
      const sec = Math.max(0, Math.min(dur, playheadRef?.current ?? 0));
      const nextPct = (sec / dur) * 100;
      if (Math.abs(nextPct - lastPct) >= 0.08) {
        lastPct = nextPct;
        setPlayPct(nextPct);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playheadRef]);

  const secFromPageX = useCallback((pageX, trackPageX) => {
    const w = trackWidthRef.current || 1;
    const ratio = Math.max(0, Math.min(1, (pageX - trackPageX) / w));
    return ratio * (durationRef.current || 1);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          trackRef.current?.measureInWindow?.((x, _y, w) => {
            trackPageXRef.current = x;
            if (w) trackWidthRef.current = w;
          });
          const sec = secFromPageX(evt.nativeEvent.pageX, trackPageXRef.current);
          const mid = (startRef.current + endRef.current) / 2;
          activeThumb.current = sec < mid ? 'start' : 'end';
          if (activeThumb.current === 'start') {
            onChangeStartRef.current(
              Math.min(sec, endRef.current - MIN_SLOW_MO_SPAN)
            );
          } else {
            onChangeEndRef.current(
              Math.max(sec, startRef.current + MIN_SLOW_MO_SPAN)
            );
          }
        },
        onPanResponderMove: (evt) => {
          const sec = secFromPageX(evt.nativeEvent.pageX, trackPageXRef.current);
          if (activeThumb.current === 'start') {
            onChangeStartRef.current(
              Math.max(0, Math.min(sec, endRef.current - MIN_SLOW_MO_SPAN))
            );
          } else {
            onChangeEndRef.current(
              Math.min(
                durationRef.current,
                Math.max(sec, startRef.current + MIN_SLOW_MO_SPAN)
              )
            );
          }
        },
        onPanResponderRelease: () => {
          activeThumb.current = null;
        },
      }),
    [secFromPageX]
  );

  const dur = Math.max(0.001, duration);
  const startPct = (startSec / dur) * 100;
  const endPct = (endSec / dur) * 100;
  const spanPct = Math.max(0, endPct - startPct);

  return (
    <View
      ref={trackRef}
      style={styles.slowMoTrackHit}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        trackRef.current?.measureInWindow?.((x, _y, w) => {
          trackPageXRef.current = x;
          if (w) trackWidthRef.current = w;
        });
      }}
      {...pan.panHandlers}
    >
      <View style={styles.slowMoTrack}>
        <View
          style={[
            styles.slowMoHighlight,
            { left: `${startPct}%`, width: `${spanPct}%` },
          ]}
        />
        <View style={[styles.slowMoPlayhead, { left: `${playPct}%` }]} />
        <View style={[styles.slowMoThumb, { left: `${startPct}%` }]} />
        <View style={[styles.slowMoThumb, { left: `${endPct}%` }]} />
      </View>
    </View>
  );
}

export default function ChallengeCam({
  route,
  navigation,
  targetUser,
  challengeTarget: challengeTargetProp,
  challengeMaxDuration: challengeMaxDurationProp,
  onClose,
  onVideoCaptured,
  resetToken = 0,
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const recordWatchdog = useRef(null);
  const stoppingRef = useRef(false);
  const recordingLockRef = useRef(false);

  const initialDuration = snapChallengeDuration(
    challengeMaxDurationProp ??
      route?.params?.challengeMaxDuration ??
      route?.params?.reel?.challengeMaxDuration ??
      route?.params?.reel?.durationSec ??
      DEFAULT_DURATION
  );

  const maxDurationRef = useRef(initialDuration);
  const secondsLeftRef = useRef(initialDuration);

  const cameraMode =
    route?.params?.mode || route?.params?.cameraMode || 'SPLIT';
  const isFullScreenCreate = cameraMode === 'FULL_SCREEN';

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [maxDurationSec, setMaxDurationSec] = useState(initialDuration);
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialDuration);
  const [timeUp, setTimeUp] = useState(false);
  const [facing, setFacing] = useState('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isMockClip, setIsMockClip] = useState(false);
  const [mountError, setMountError] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [speedRate, setSpeedRate] = useState(1);
  const [clipDurationSec, setClipDurationSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [takeCount, setTakeCount] = useState(0);
  const [slowMoEnabled, setSlowMoEnabled] = useState(false);
  const [slowMoStartSec, setSlowMoStartSec] = useState(0);
  const [slowMoEndSec, setSlowMoEndSec] = useState(initialDuration);
  const [slowMoRate, setSlowMoRate] = useState(0.5);
  const [isPosting, setIsPosting] = useState(false);
  /** Live playhead seconds — ref only (avoids re-render thrash on every tick). */
  const reviewPlayheadRef = useRef(0);
  /** expo-video player instance for review clip (pause/unload on unmount). */
  const videoRef = useRef(null);
  const recordStartedAtRef = useRef(0);
  const didAskPermsRef = useRef(false);
  const didSyncDurationRef = useRef(false);

  const isReviewMode = showPreview;
  const videoDuration = Math.max(0.5, clipDurationSec || maxDurationSec || DEFAULT_DURATION);

  const challengeTarget =
    challengeTargetProp ||
    route?.params?.target ||
    route?.params?.reel?.statSticker ||
    '140 KG x 3 Reps';

  const targetMetricsLabel = buildTargetMetricsLabel(challengeTarget, maxDurationSec, {
    exercise: route?.params?.exercise || route?.params?.reel?.exercise,
    reps: route?.params?.reps || route?.params?.reel?.reps,
    sets: route?.params?.sets || route?.params?.reel?.sets,
    repLabel: route?.params?.repLabel || route?.params?.reel?.repLabel,
  });

  const targetVideoUri =
    route?.params?.targetVideoUri ||
    route?.params?.challengerUri ||
    route?.params?.reel?.videoUri ||
    route?.params?.reel?.recordedVideoUri ||
    route?.params?.reel?.uri ||
    null;

  const opponentHandle =
    targetUser ||
    route?.params?.handle ||
    route?.params?.reel?.creator ||
    'Yuki_Lift';
  const displayHandle = opponentHandle.startsWith('@')
    ? opponentHandle
    : `@${opponentHandle}`;

  const cameraUnavailable = useFallback || !!mountError;
  const canPost = !!recordedUri || timeUp || frozen;

  const selectDuration = (sec) => {
    if (isRecording || frozen || showPreview) return;
    const snapped = snapChallengeDuration(sec);
    maxDurationRef.current = snapped;
    setMaxDurationSec(snapped);
    secondsLeftRef.current = snapped;
    setSecondsLeft(snapped);
  };

  // Lock duration pills to challenger target duration (default 30s)
  useEffect(() => {
    const incoming = snapChallengeDuration(
      challengeMaxDurationProp ??
        route?.params?.challengeMaxDuration ??
        route?.params?.reel?.challengeMaxDuration ??
        route?.params?.reel?.durationSec ??
        initialDuration ??
        DEFAULT_DURATION
    );
    if (isRecording || showPreview || frozen) return;
    if (didSyncDurationRef.current && incoming === maxDurationRef.current) return;
    didSyncDurationRef.current = true;
    maxDurationRef.current = incoming;
    setMaxDurationSec(incoming);
    secondsLeftRef.current = incoming;
    setSecondsLeft(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    challengeMaxDurationProp,
    route?.params?.challengeMaxDuration,
    route?.params?.reel?.challengeMaxDuration,
    route?.params?.reel?.durationSec,
  ]);

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
    const limit = maxDurationRef.current || DEFAULT_DURATION;
    const elapsed = recordStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000))
      : Math.max(1, limit - (secondsLeftRef.current ?? 0));
    const lockedDur = fromTimer ? limit : Math.min(limit, elapsed);
    setClipDurationSec(lockedDur);
    setSlowMoStartSec(0);
    setSlowMoEndSec(lockedDur);
    setSlowMoEnabled(false);
    setSlowMoRate(0.5);
    reviewPlayheadRef.current = 0;
    setIsRecording(false);
    setFrozen(true);
    // URI first so review Video can mount before preview chrome toggles on
    setIsMockClip(mock);
    const fallbackUri = uri || `emulator-mock://${Date.now()}.mp4`;
    setRecordedUri(fallbackUri);
    setShowPreview(true);
    if (fromTimer) {
      setTimeUp(true);
      setSecondsLeft(0);
      secondsLeftRef.current = 0;
    }
    stoppingRef.current = false;
    recordingLockRef.current = false;

    // Persist camera temp file into documentDirectory so later POST does not 404
    if (uri && !mock && !String(uri).startsWith('emulator-mock://')) {
      persistLocalVideoUri(uri)
        .then((stable) => {
          if (stable && stable !== uri) {
            setRecordedUri(stable);
          }
        })
        .catch((err) => {
          console.warn('Could not persist recorded clip:', err?.message || err);
        });
    }
  }, []);

  // Floating elapsed duration (smooth) + 1s countdown while recording
  useEffect(() => {
    if (!isRecording) return undefined;

    const limit = maxDurationRef.current || DEFAULT_DURATION;
    const elapsedTick = setInterval(() => {
      if (!recordStartedAtRef.current) return;
      setElapsedSec(
        Math.min(
          limit,
          Math.max(0, Math.floor((Date.now() - recordStartedAtRef.current) / 1000))
        )
      );
    }, 250);

    const countdownTick = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        secondsLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(elapsedTick);
      clearInterval(countdownTick);
    };
  }, [isRecording]);

  // Auto-stop at 00 — stopRecording resolves the pending recordAsync promise
  useEffect(() => {
    if (!isRecording || secondsLeft > 0) return;
    (async () => {
      if (cameraUnavailable) {
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true, fromTimer: true });
        return;
      }
      setTimeUp(true);
      await stopRecordingNative();
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

  // Seamless camera + mic permission prompt on first mount
  useEffect(() => {
    if (didAskPermsRef.current) return;
    if (!permission || !micPermission) return;
    didAskPermsRef.current = true;
    if (permission.granted && micPermission.granted) return;
    (async () => {
      try {
        if (!permission.granted) await requestPermission();
        if (!micPermission.granted) await requestMicPermission();
      } catch (error) {
        console.warn('Permission request failed:', error?.message || error);
      }
    })();
  }, [permission, micPermission, requestPermission, requestMicPermission]);

  // Pause video + stop camera listeners before screen unmounts (viewState safety)
  useEffect(() => {
    return () => {
      if (recordWatchdog.current) {
        clearTimeout(recordWatchdog.current);
        recordWatchdog.current = null;
      }
      try {
        cameraRef.current?.stopRecording?.();
      } catch (_) {
        /* ignore */
      }
      const player = videoRef.current;
      if (player) {
        try {
          player.pause?.();
        } catch (_) {
          /* ignore */
        }
        try {
          // expo-video equivalent of expo-av unloadAsync()
          if (typeof player.replace === 'function') {
            player.replace(null);
          } else if (typeof player.replaceAsync === 'function') {
            player.replaceAsync(null);
          } else if (typeof player.unloadAsync === 'function') {
            player.unloadAsync();
          }
        } catch (_) {
          /* ignore */
        }
      }
      videoRef.current = null;
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
    if (isRecording || cameraUnavailable || frozen || showPreview) return;
    setIsCameraReady(false);
    // Facing prop update only — do not remount CameraView (avoids feed dropout).
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const activateFallback = (reason) => {
    console.warn('Camera fallback:', reason);
    setMountError(reason || 'Camera hardware unavailable');
    setUseFallback(true);
    setIsCameraReady(false);
    setIsRecording(false);
    recordingLockRef.current = false;
  };

  const retryCamera = () => {
    if (frozen || isRecording) return;
    setMountError(null);
    setUseFallback(false);
    setIsCameraReady(false);
    setCameraKey((k) => k + 1);
  };

  const handleRecordPress = async () => {
    if (frozen || recordedUri || showPreview) return;

    // Stop current take — resolves pending recordAsync()
    if (isRecording) {
      if (cameraUnavailable) {
        if (recordWatchdog.current) clearTimeout(recordWatchdog.current);
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true });
        return;
      }
      try {
        cameraRef.current?.stopRecording?.();
      } catch (error) {
        console.warn('Stop recording failed:', error?.message || error);
      }
      return;
    }

    const limit = maxDurationRef.current || DEFAULT_DURATION;

    if (cameraUnavailable) {
      setTimeUp(false);
      setShowPreview(false);
      setElapsedSec(0);
      secondsLeftRef.current = limit;
      setSecondsLeft(limit);
      recordStartedAtRef.current = Date.now();
      setTakeCount((n) => n + 1);
      setIsRecording(true);
      recordWatchdog.current = setTimeout(() => {
        lockResponse(`emulator-mock://${Date.now()}.mp4`, { mock: true, fromTimer: true });
      }, limit * 1000);
      return;
    }

    // Shutter gated on onCameraReady — never remount during record
    if (!isCameraReady || !cameraRef.current || recordingLockRef.current) return;

    recordingLockRef.current = true;
    setTimeUp(false);
    setShowPreview(false);
    setElapsedSec(0);
    secondsLeftRef.current = limit;
    setSecondsLeft(limit);
    recordStartedAtRef.current = Date.now();
    setTakeCount((n) => n + 1);
    setIsRecording(true);
    stoppingRef.current = false;

    try {
      // mute:false on CameraView + record options keeps mic track without AGC spikes
      const video = await cameraRef.current.recordAsync({
        mute: false,
        maxDuration: limit,
      });
      const hitZero = secondsLeftRef.current <= 0;
      const fileUri = video?.uri;
      if (fileUri) {
        lockResponse(fileUri, { mock: false, fromTimer: hitZero });
      } else {
        console.warn('recordAsync resolved without a file URI');
        setIsRecording(false);
        recordingLockRef.current = false;
      }
    } catch (error) {
      // Log only — do not invent a fallback clip on transient record errors
      console.warn('Recording failed:', error?.message || error);
      setIsRecording(false);
      recordingLockRef.current = false;
      stoppingRef.current = false;
    }
  };

  const resetRecordingSession = useCallback(() => {
    if (recordWatchdog.current) {
      clearTimeout(recordWatchdog.current);
      recordWatchdog.current = null;
    }
    try {
      cameraRef.current?.stopRecording?.();
    } catch (_) {
      /* ignore */
    }
    const limit = maxDurationRef.current || DEFAULT_DURATION;
    setRecordedUri(null);
    setIsMockClip(false);
    setIsRecording(false);
    setFrozen(false);
    setShowPreview(false);
    setTimeUp(false);
    setClipDurationSec(0);
    setElapsedSec(0);
    setSlowMoEnabled(false);
    setSlowMoStartSec(0);
    setSlowMoEndSec(limit);
    setSlowMoRate(0.5);
    reviewPlayheadRef.current = 0;
    recordStartedAtRef.current = 0;
    secondsLeftRef.current = limit;
    setSecondsLeft(limit);
    stoppingRef.current = false;
    recordingLockRef.current = false;
    setSpeedRate(1);
    // Keep CameraView mounted — do not bump cameraKey on retake
  }, []);

  // Parent bumps resetToken after a successful Arena post so the next session is clean.
  useEffect(() => {
    if (!resetToken) return;
    resetRecordingSession();
  }, [resetToken, resetRecordingSession]);

  const handleRetake = () => {
    resetRecordingSession();
  };

  const buildCapturePayload = useCallback(
    (uri) => {
      const timestamp = Date.now();
      const limit = maxDurationRef.current || DEFAULT_DURATION;
      const durationSec =
        clipDurationSec ||
        Math.max(1, limit - (secondsLeftRef.current ?? 0));
      return {
        uri,
        videoUri: uri,
        recordedVideoUri: uri,
        durationSec,
        durationMs: durationSec * 1000,
        speedRate,
        target: challengeTarget,
        timestamp,
        opponent: displayHandle,
        facing,
        videoQuality: VIDEO_QUALITY,
        fps: TARGET_FPS,
        mimeType: 'video/mp4',
        takeCount,
        slowMoEnabled,
        slowMoStartSec,
        slowMoEndSec,
        slowMoRate,
        isMock: isMockClip || uri.startsWith('emulator-mock://'),
      };
    },
    [
      clipDurationSec,
      speedRate,
      challengeTarget,
      displayHandle,
      facing,
      isMockClip,
      takeCount,
      slowMoEnabled,
      slowMoStartSec,
      slowMoEndSec,
      slowMoRate,
    ]
  );

  /**
   * Upload local clip → Supabase Storage + insert `battle_responses`, then hand off to Arena.
   */
  const handlePostToArena = useCallback(
    async (localVideoUri, challengeDetails = {}) => {
      const uri = localVideoUri || recordedUri;
      if (!uri) return null;

      setIsPosting(true);
      try {
        let stableUri = uri;
        if (!String(uri).startsWith('emulator-mock://')) {
          try {
            stableUri = await persistLocalVideoUri(uri);
            if (stableUri && stableUri !== recordedUri) {
              setRecordedUri(stableUri);
            }
          } catch (verifyErr) {
            console.warn(
              'Local video verify failed before upload — Arena local preview only:',
              verifyErr?.message || verifyErr
            );
            return {
              publicCloudUrl: null,
              data: null,
              skipped: true,
              reason: 'missing-local-file',
              localUri: uri,
            };
          }
        }

        const cloud = await postBattleResponseToSupabase(stableUri, {
          battleId:
            challengeDetails.battleId ||
            route?.params?.battleId ||
            route?.params?.reel?.battleId ||
            route?.params?.reel?.id,
          responderId: challengeDetails.responderId,
          slowMoStartSec:
            challengeDetails.slowMoStartSec ??
            (slowMoEnabled ? slowMoStartSec : 0),
          slowMoEndSec:
            challengeDetails.slowMoEndSec ??
            (slowMoEnabled ? slowMoEndSec : clipDurationSec || maxDurationSec),
          slowMoRate:
            challengeDetails.slowMoRate ??
            (slowMoEnabled ? slowMoRate : 1),
          ...challengeDetails,
        });

        return cloud;
      } catch (err) {
        // Soft-fail: never block KEEP & REVIEW — silent local preview
        const msg = String(err?.message || err || '');
        return {
          publicCloudUrl: null,
          data: null,
          skipped: true,
          reason: 'cloud-error',
          localUri: uri,
          error: msg,
        };
      } finally {
        setIsPosting(false);
      }
    },
    [
      recordedUri,
      route?.params?.battleId,
      route?.params?.reel?.battleId,
      route?.params?.reel?.id,
      slowMoEnabled,
      slowMoStartSec,
      slowMoEndSec,
      slowMoRate,
      clipDurationSec,
      maxDurationSec,
    ]
  );

  /** KEEP & REVIEW / POST BATTLE — local Arena first, cloud in background */
  const handleKeepReview = async () => {
    if (isPosting) return;
    if (!recordedUri && !frozen) return;
    const uri = recordedUri || `emulator-mock://${Date.now()}.mp4`;
    const payload = buildCapturePayload(uri);

    // ChallengeScreen owns the confirm modal — defer Supabase upload until "POST TO ARENA"
    if (onVideoCaptured) {
      onVideoCaptured(uri, {
        ...payload,
        videoUri: uri,
        recordedVideoUri: uri,
        localVideoUri: uri,
        cloudUploaded: false,
      });
      return;
    }

    const isFullScreenCreate =
      route?.params?.mode === 'FULL_SCREEN' || route?.params?.cameraMode === 'FULL_SCREEN';
    const challengeId = isFullScreenCreate
      ? undefined
      : route?.params?.battleId ||
        route?.params?.reel?.battleId ||
        route?.params?.reel?.id;
    // Instant local handoff — never block on Storage / JWS
    const cloudUrl = uri;
    // Fire-and-forget cloud; Arena already has file://
    handlePostToArena(uri, {
      slowMoStartSec: payload.slowMoStartSec,
      slowMoEndSec: payload.slowMoEndSec,
      slowMoRate: payload.slowMoEnabled ? payload.slowMoRate : 1,
    }).catch(() => {});

    const newArenaPost = {
      ...payload,
      id: `local-${payload.timestamp}`,
      creator: 'You',
      author: '@you',
      type: isFullScreenCreate ? 'reel' : 'battle_thread',
      caption: payload.target || route?.params?.target || 'Arena drop',
      ...(challengeId ? { challengeId, battleId: challengeId } : { isBattle: false }),
      category: route?.params?.reel?.category || 'GYM',
      challengeOf: isFullScreenCreate
        ? undefined
        : route?.params?.reel?.creator || 'Yuki_Lift',
      uri: cloudUrl,
      videoUri: cloudUrl,
      recordedVideoUri: cloudUrl,
      localVideoUri: uri,
      cloudUploaded: false,
    };
    pushArenaPost(newArenaPost);
    setLatestBattleClip(newArenaPost);
    try {
      if (navigation?.navigate) {
        navigation.navigate('Main', {
          tab: 'Arena',
          newArenaPost,
          videoUri: cloudUrl,
          recordedVideoUri: cloudUrl,
        });
        resetRecordingSession();
        return;
      }
      handleClose();
    } catch (error) {
      console.warn('Keep & review dispatch failed:', error?.message || error);
      handleClose();
    }
  };

  const handlePostBattle = () => {
    if (isPosting) return;
    if (!canPost && !recordedUri) return;
    handleKeepReview();
  };

  const requestAllPermissions = async () => {
    try {
      if (!permission?.granted) await requestPermission();
      if (!micPermission?.granted) await requestMicPermission();
    } catch (error) {
      console.warn('Permission request failed:', error?.message || error);
    }
  };

  // Never mount CameraView until camera + mic permission objects resolve and are granted.
  if (!permission || !micPermission) {
    return (
      <View style={styles.permissionRoot}>
        <StatusBar barStyle="light-content" backgroundColor={OBSIDIAN} />
        <ActivityIndicator color="#E5E4E2" size="large" />
        <Text style={[styles.permissionHint, { color: '#E5E4E2' }]}>
          Checking camera & microphone…
        </Text>
      </View>
    );
  }

  if (!permission.granted || !micPermission.granted) {
    const needsCam = !permission.granted;
    const needsMic = !micPermission.granted;
    return (
      <View style={[styles.permissionRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={OBSIDIAN} />
        <Text style={styles.permissionEyebrow}>BAWAAL ARENA</Text>
        <Text style={styles.permissionTitle}>
          {needsCam && needsMic
            ? 'Camera & microphone access required'
            : needsCam
              ? 'Camera access is required for BAWAAL ChallengeCam'
              : 'Microphone access is required for battle audio'}
        </Text>
        <Text style={styles.permissionHint}>
          Grant lens + mic to record a synced side-by-side battle response.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={requestAllPermissions}
          activeOpacity={0.85}
        >
          <Text style={styles.permissionBtnText}>
            {needsCam ? 'GRANT CAMERA PERMISSION' : 'GRANT MICROPHONE PERMISSION'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.ghostBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shutterDisabled =
    frozen ||
    showPreview ||
    (!cameraUnavailable && !isCameraReady);

  const recordProgress = isRecording
    ? Math.min(1, elapsedSec / Math.max(1, maxDurationSec))
    : 0;

  const lensStarting =
    !cameraUnavailable && !isCameraReady && !mountError && !frozen && !isReviewMode;

  const renderTopBar = () => (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      {lensStarting && (
        <View style={styles.lensStatusRow} pointerEvents="none">
          <ActivityIndicator color={COLORS.PLATINUM_BASE} size="small" />
          <Text style={styles.lensStatusText}>STARTING LENS</Text>
        </View>
      )}
      <View style={styles.topBarRow}>
        <View style={styles.topBarSide}>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.75} hitSlop={8}>
            <Text style={styles.headerBtnText}>✕ CANCEL</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.topBarCenter}>
          <Text style={styles.brandTitle}>BAWAAL</Text>
        </View>
        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          <TouchableOpacity
            style={[
              styles.flipBtn,
              (isRecording || cameraUnavailable || frozen || showPreview) &&
                styles.headerBtnDisabled,
            ]}
            onPress={toggleFacing}
            disabled={isRecording || cameraUnavailable || frozen || showPreview}
            activeOpacity={0.75}
          >
            <Text style={styles.flipBtnIcon}>⟳</Text>
            <Text style={styles.flipBtnText}>FLIP</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderDurationPills = () => (
    <View style={styles.durationBar}>
      {DURATION_OPTIONS.map((sec) => {
        const active = maxDurationSec === sec;
        return (
          <TouchableOpacity
            key={`dur-${sec}`}
            style={[styles.durationPill, active && styles.durationPillActive]}
            onPress={() => selectDuration(sec)}
            disabled={isRecording || frozen || showPreview}
            activeOpacity={0.8}
          >
            <Text style={[styles.durationPillText, active && styles.durationPillTextActive]}>
              {sec}s
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderShutter = () => (
    <ShutterProgressRing progress={recordProgress} size={96} recording={isRecording}>
      <TouchableOpacity
        style={[
          styles.recordRing,
          isRecording && styles.recordRingLive,
          shutterDisabled && styles.recordDisabled,
        ]}
        onPress={handleRecordPress}
        disabled={shutterDisabled && !isRecording}
        activeOpacity={0.85}
      >
        <View style={[styles.recordInner, isRecording && styles.recordInnerLive]} />
      </TouchableOpacity>
    </ShutterProgressRing>
  );

  const recordedVideoUri = recordedUri;
  const hasReviewClip = isPlayableReviewUri(recordedVideoUri);
  const showReviewVideo = isReviewMode && hasReviewClip;
  const showPostBattle = !isRecording && (frozen || canPost);

  return (
    <View style={styles.rootFill} collapsable={false}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={OBSIDIAN}
        hidden={isRecording || isReviewMode}
      />

      {/* Review playback — always mounted; raised above battle column in review */}
      <View
        style={[
          styles.reviewVideoLayer,
          {
            zIndex: showReviewVideo ? 10 : -1,
            elevation: showReviewVideo ? 10 : -1,
          },
        ]}
        pointerEvents="none"
        collapsable={false}
      >
        <ReviewSlowMoPlayer
          key={`review-player-${recordedVideoUri || 'empty'}`}
          uri={recordedVideoUri}
          active={!!isReviewMode && hasReviewClip}
          slowMoEnabled={slowMoEnabled}
          slowMoStartSec={slowMoStartSec}
          slowMoEndSec={slowMoEndSec}
          slowMoRate={slowMoRate}
          playheadRef={reviewPlayheadRef}
          videoRef={videoRef}
        />
      </View>

      {/*
        Battle column: top opponent + lower CameraView (flex:1).
        CameraView + review Video stay mounted — visibility via zIndex only.
      */}
      <View
        style={[
          styles.battleColumn,
          isRecording && styles.battleColumnRecording,
          {
            paddingTop:
              isFullScreenCreate || isRecording || isReviewMode ? 0 : insets.top + 52,
            zIndex: showReviewVideo ? -1 : 5,
            elevation: showReviewVideo ? -1 : 5,
          },
        ]}
        pointerEvents={showReviewVideo ? 'none' : 'auto'}
        collapsable={false}
      >
        {/* Top split — collapsed for FULL_SCREEN creation and while recording */}
        <View
          style={[
            styles.topSplit,
            (isFullScreenCreate || isRecording) && styles.topSplitCollapsed,
          ]}
          pointerEvents={
            isFullScreenCreate || isRecording || isReviewMode ? 'none' : 'auto'
          }
          collapsable={false}
        >
          {!isFullScreenCreate ? (
            <>
              <OpponentTargetPlayer
                uri={targetVideoUri}
                active={!isRecording && !isReviewMode}
              />
              <View
                style={[
                  styles.targetBadgeWrap,
                  (isRecording || isReviewMode) && styles.chromeHidden,
                ]}
                pointerEvents="none"
                collapsable={false}
              >
                <View style={styles.targetBadge}>
                  <Text style={styles.targetBadgeText} numberOfLines={2}>
                    {targetMetricsLabel}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* VS — hidden during full-screen creation */}
        <View
          style={[
            styles.vsDivider,
            (isFullScreenCreate || isRecording || isReviewMode) && styles.chromeHidden,
          ]}
          pointerEvents="none"
          collapsable={false}
        >
          <View style={styles.vsBadge}>
            <Text style={styles.vsBadgeText}>VS</Text>
          </View>
        </View>

        {/* Lower camera viewport — CameraView always mounted */}
        <View style={styles.lowerCameraHost} collapsable={false}>
          <CameraErrorBoundary onError={activateFallback}>
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={styles.cameraFill}
              facing={facing}
              mode="video"
              mute={false}
              mirror={facing === 'front'}
              videoQuality={VIDEO_QUALITY}
              videoBitrate={5_000_000}
              onCameraReady={() => {
                setIsCameraReady(true);
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

          <View
            style={[
              StyleSheet.absoluteFillObject,
              !cameraUnavailable && styles.chromeHidden,
            ]}
            pointerEvents={cameraUnavailable ? 'box-none' : 'none'}
            collapsable={false}
          >
            <CameraFallbackSurface
              message={mountError}
              isRecording={isRecording}
              onRetry={frozen || isReviewMode ? undefined : retryCamera}
            />
          </View>
        </View>
      </View>

      {/* Top status — hidden in review */}
      {!isReviewMode && renderTopBar()}

      {/* Record controls — hidden in review so they cannot overlap the card */}
      {!isReviewMode && (
        <View
          style={[
            styles.controlsOverlay,
            { paddingBottom: Math.max(insets.bottom, isRecording ? 20 : 12) },
            isRecording ? styles.controlsOverlayRecording : styles.controlsOverlayIdle,
          ]}
          pointerEvents="box-none"
        >
          {renderDurationPills()}
          {renderShutter()}
          {showPostBattle && (
            <TouchableOpacity
              style={[styles.postBattleBtn, (!canPost || isPosting) && styles.postBattleBtnDisabled]}
              onPress={handlePostBattle}
              disabled={!canPost || isPosting}
              activeOpacity={0.85}
            >
              {isPosting ? (
                <ActivityIndicator color={OBSIDIAN} />
              ) : (
                <Text style={styles.postBattleText}>POST BATTLE ⚡</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Review card — always in tree; visibility toggled (no native media unmount) */}
      <View
        style={[
          styles.previewChrome,
          {
            opacity: isReviewMode ? 1 : 0,
            zIndex: isReviewMode ? 50 : -1,
            elevation: isReviewMode ? 50 : -1,
          },
        ]}
        pointerEvents={isReviewMode ? 'box-none' : 'none'}
        collapsable={false}
      >
        <View style={styles.previewCard}>
          <Text style={styles.freezeTitle}>
            {timeUp ? 'TIME UP · CLIP LOCKED' : 'CLIP READY'}
          </Text>
          <Text style={styles.freezeSub}>
            {!hasReviewClip
              ? 'Waiting for clip…'
              : isMockClip
                ? `Take ${takeCount || 1} · fallback · review or retake`
                : `Take ${takeCount || 1} · ${formatClock(clipDurationSec)} · ${VIDEO_QUALITY}`}
          </Text>

          <TouchableOpacity
            style={[styles.slowMoToggle, slowMoEnabled && styles.slowMoToggleOn]}
            onPress={() => setSlowMoEnabled((v) => !v)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.slowMoToggleText, slowMoEnabled && styles.slowMoToggleTextOn]}
            >
              ⚡ ADD SLOW-MO
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.slowMoPanel,
              !slowMoEnabled && styles.chromeHidden,
            ]}
            pointerEvents={slowMoEnabled ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={styles.slowMoTimeRow}>
              <Text style={styles.slowMoTimeLabel}>
                START {formatClock(slowMoStartSec)}
              </Text>
              <Text style={styles.slowMoTimeLabel}>
                END {formatClock(slowMoEndSec)}
              </Text>
            </View>

            <SlowMoRangeSlider
              duration={videoDuration}
              startSec={slowMoStartSec}
              endSec={slowMoEndSec}
              playheadRef={reviewPlayheadRef}
              onChangeStart={setSlowMoStartSec}
              onChangeEnd={setSlowMoEndSec}
            />

            <View style={styles.slowMoRateRow}>
              {SLOW_MO_RATES.map((rate) => {
                const active = slowMoRate === rate;
                return (
                  <TouchableOpacity
                    key={`sm-${rate}`}
                    style={[styles.slowMoRatePill, active && styles.slowMoRatePillActive]}
                    onPress={() => {
                      setSlowMoEnabled(true);
                      setSlowMoRate(rate);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.slowMoRateText,
                        active && styles.slowMoRateTextActive,
                      ]}
                    >
                      {rate}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleRetake}
                disabled={isPosting}
                activeOpacity={0.8}
              >
                <Text style={styles.retakeBtnText}>RETAKE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keepBtn, isPosting && styles.postBattleBtnDisabled]}
                onPress={handleKeepReview}
                disabled={isPosting}
                activeOpacity={0.85}
              >
                {isPosting ? (
                  <ActivityIndicator color={OBSIDIAN} />
                ) : (
                  <Text style={styles.keepBtnText}>KEEP & REVIEW</Text>
                )}
              </TouchableOpacity>
            </View>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OBSIDIAN,
  },
  rootFill: {
    flex: 1,
    backgroundColor: OBSIDIAN,
  },
  battleColumn: {
    flex: 1,
    width: '100%',
    backgroundColor: OBSIDIAN,
  },
  battleColumnRecording: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    elevation: 15,
  },
  topSplit: {
    height: 220,
    width: '100%',
    backgroundColor: OBSIDIAN,
    overflow: 'hidden',
    position: 'relative',
  },
  topSplitCollapsed: {
    height: 0,
  },
  lowerCameraHost: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: OBSIDIAN,
    minHeight: 160,
  },
  cameraFill: {
    flex: 1,
    width: '100%',
  },
  targetVideo: {
    width: '100%',
    height: 220,
  },
  opponentPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0D12',
  },
  chromeHidden: {
    opacity: 0,
    zIndex: -1,
  },
  vsDivider: {
    height: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    elevation: 25,
  },
  controlsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 12,
  },
  controlsOverlayIdle: {
    backgroundColor: 'rgba(5, 7, 10, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 228, 226, 0.08)',
  },
  controlsOverlayRecording: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  reviewVideoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OBSIDIAN,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    elevation: 60,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  lensStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  lensStatusText: {
    color: 'rgba(229, 228, 226, 0.75)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSide: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarSideRight: {
    alignItems: 'flex-end',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewChrome: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'transparent',
  },
  durationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 10, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(229, 228, 226, 0.22)',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  durationPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  durationPillActive: {
    backgroundColor: PLATINUM,
  },
  durationPillText: {
    color: 'rgba(229, 228, 226, 0.65)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  durationPillTextActive: {
    color: OBSIDIAN,
  },
  permissionRoot: {
    flex: 1,
    backgroundColor: OBSIDIAN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  permissionEyebrow: {
    color: '#E5E4E2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  permissionTitle: {
    color: '#E5E4E2',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  permissionHint: {
    color: 'rgba(229,228,226,0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  permissionBtn: {
    backgroundColor: '#E5E4E2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 240,
    alignItems: 'center',
    marginBottom: 14,
  },
  permissionBtnText: {
    color: '#05070A',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ghostBtnText: {
    color: 'rgba(229,228,226,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'flex-start',
  },
  headerBtnDisabled: {
    opacity: 0.35,
  },
  headerBtnText: {
    color: COLORS.TEXT_DIM,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 84,
    justifyContent: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  flipBtnIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  flipBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  brandTitle: {
    color: PLATINUM,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  splitContainer: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  cardHalf: {
    flex: 0.48,
    backgroundColor: COLORS.CARD_BOTTOM,
    borderRadius: RADIUS.card,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: COLORS.TEXT_DIM,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  metaHandle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  metaStatus: {
    color: COLORS.TEXT_DIM,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metaStatusLive: {
    color: ACTIVE_REC,
  },
  timerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadgeText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    maxWidth: 44,
  },
  timerBadgeTextActive: {
    color: ACTIVE_REC,
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
    minHeight: 160,
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  viewportRecording: {
    borderColor: ACTIVE_REC,
    borderWidth: 2,
  },
  viewportFrozen: {
    borderColor: COLORS.GLASS_BORDER,
    borderWidth: 1.5,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,5,0.55)',
    paddingHorizontal: 16,
  },
  recOverlay: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 45,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: ACTIVE_REC,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  recLabel: {
    color: ACTIVE_REC,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  recTimer: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },
  recRemain: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  previewCard: {
    width: '100%',
    backgroundColor: 'rgba(5, 7, 10, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(229, 228, 226, 0.22)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  freezeTitle: {
    color: '#E5E4E2',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  freezeSub: {
    color: 'rgba(229,228,226,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  slowMoToggle: {
    borderWidth: 1.5,
    borderColor: PLATINUM,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  slowMoToggleOn: {
    backgroundColor: PLATINUM,
    borderColor: PLATINUM,
  },
  slowMoToggleText: {
    color: PLATINUM,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  slowMoToggleTextOn: {
    color: OBSIDIAN,
  },
  slowMoPanel: {
    width: '100%',
    marginBottom: 14,
  },
  slowMoTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slowMoTimeLabel: {
    color: PLATINUM,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  slowMoTrackHit: {
    width: '100%',
    height: 36,
    justifyContent: 'center',
    marginBottom: 12,
  },
  slowMoTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(229, 228, 226, 0.18)',
    overflow: 'visible',
    position: 'relative',
  },
  slowMoHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: ACTIVE_REC,
    borderRadius: 4,
    opacity: 0.9,
  },
  slowMoPlayhead: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 16,
    marginLeft: -1,
    backgroundColor: PLATINUM,
  },
  slowMoThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: PLATINUM,
    borderWidth: 2,
    borderColor: ACTIVE_REC,
  },
  slowMoRateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  slowMoRatePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 228, 226, 0.28)',
  },
  slowMoRatePillActive: {
    backgroundColor: PLATINUM,
    borderColor: PLATINUM,
  },
  slowMoRateText: {
    color: 'rgba(229, 228, 226, 0.7)',
    fontSize: 12,
    fontWeight: '800',
  },
  slowMoRateTextActive: {
    color: OBSIDIAN,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PLATINUM,
    borderRadius: RADIUS.cta,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  retakeBtnText: {
    color: PLATINUM,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  keepBtn: {
    flex: 1.2,
    backgroundColor: PLATINUM,
    borderRadius: RADIUS.cta,
    paddingVertical: 12,
    alignItems: 'center',
  },
  keepBtnText: {
    color: OBSIDIAN,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fallbackSurface: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#080808',
  },
  overlayText: {
    color: COLORS.PLATINUM_BASE,
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
    color: ACTIVE_REC,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.8,
  },
  retryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  targetBadgeWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 4,
    zIndex: 6,
  },
  targetBadge: {
    alignSelf: 'center',
    maxWidth: '100%',
    backgroundColor: 'rgba(5, 7, 10, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(229, 228, 226, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  targetBadgeText: {
    color: COLORS.TEXT_PRIMARY || COLORS.OFF_WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  vsBadge: {
    backgroundColor: ACTIVE_REC,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: OBSIDIAN,
    marginTop: -20,
  },
  vsBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  bottomControls: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  speedLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginRight: 4,
  },
  speedChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  speedChipActive: {
    borderColor: COLORS.OFF_WHITE,
    backgroundColor: COLORS.CARD_CHARCOAL,
  },
  speedChipText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  speedChipTextActive: {
    color: COLORS.OFF_WHITE,
  },
  recordRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordRingLive: {
    backgroundColor: 'transparent',
  },
  recordDisabled: {
    opacity: 0.35,
  },
  recordInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: ACTIVE_REC,
  },
  recordInnerLive: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: ACTIVE_REC,
  },
  postBattleBtn: {
    width: '100%',
    backgroundColor: COLORS.PLATINUM_BASE,
    borderRadius: RADIUS.cta,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  postBattleBtnDisabled: {
    opacity: 0.35,
  },
  postBattleText: {
    color: COLORS.INK,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.2,
  },
});
