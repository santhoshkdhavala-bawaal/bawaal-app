/**
 * UniversalCamera — BAWAAL Universal Creation Engine.
 * Time pill above red shutter · neon-orange mode strip · slow-mo film-strip preview.
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
  Pressable,
  Modal,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  type GestureResponderEvent,
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
const PILL_HIDE_MS = 5000;
const MIN_TRIM_SPAN = 0.4;

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
          { transform: [{ rotate }], opacity: progress > 0 ? 1 : 0 },
        ]}
      />
    </View>
  );
}

const ringStyles = StyleSheet.create({
  track: {
    ...ABSOLUTE_FILL,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  arc: {
    ...ABSOLUTE_FILL,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: NEON_ORANGE,
    borderRightColor: NEON_ORANGE,
  },
});

/** Film-strip trimmer with start/end handles + playhead. */
function FilmStripTrimmer({
  duration,
  startSec,
  endSec,
  playheadSec,
  onChangeRange,
}: {
  duration: number;
  startSec: number;
  endSec: number;
  playheadSec: number;
  onChangeRange: (start: number, end: number) => void;
}) {
  const dragKind = useRef<'start' | 'end' | null>(null);
  const widthRef = useRef(1);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = Math.max(1, e.nativeEvent.layout.width);
  };

  const xToSec = (evt: GestureResponderEvent) => {
    const w = Math.max(1, widthRef.current);
    const maxDur = Math.max(MIN_TRIM_SPAN, duration || 1);
    return Math.max(
      0,
      Math.min(maxDur, (evt.nativeEvent.locationX / w) * maxDur)
    );
  };

  const onGrant = (evt: GestureResponderEvent) => {
    const sec = xToSec(evt);
    const mid = (startSec + endSec) / 2;
    dragKind.current = sec < mid ? 'start' : 'end';
  };

  const onMove = (evt: GestureResponderEvent) => {
    const sec = xToSec(evt);
    const maxDur = Math.max(MIN_TRIM_SPAN, duration || 1);
    if (dragKind.current === 'start') {
      onChangeRange(Math.max(0, Math.min(sec, endSec - MIN_TRIM_SPAN)), endSec);
    } else if (dragKind.current === 'end') {
      onChangeRange(
        startSec,
        Math.min(maxDur, Math.max(sec, startSec + MIN_TRIM_SPAN))
      );
    }
  };

  const dur = Math.max(MIN_TRIM_SPAN, duration || 1);
  const leftPct = (startSec / dur) * 100;
  const rightPct = (endSec / dur) * 100;
  const playPct = Math.max(0, Math.min(100, (playheadSec / dur) * 100));
  const frames = 12;

  return (
    <View
      style={trimStyles.wrap}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={() => {
        dragKind.current = null;
      }}
    >
      <View style={trimStyles.film}>
        {Array.from({ length: frames }).map((_, i) => (
          <View
            key={`f-${i}`}
            style={[
              trimStyles.frame,
              i % 2 === 0 ? trimStyles.frameA : trimStyles.frameB,
            ]}
          />
        ))}
        <View
          style={[
            trimStyles.selection,
            { left: `${leftPct}%`, width: `${Math.max(2, rightPct - leftPct)}%` },
          ]}
        />
        <View style={[trimStyles.handle, { left: `${leftPct}%` }]}>
          <View style={trimStyles.handleBar} />
        </View>
        <View style={[trimStyles.handle, { left: `${rightPct}%` }]}>
          <View style={trimStyles.handleBar} />
        </View>
        <View style={[trimStyles.playhead, { left: `${playPct}%` }]} />
      </View>
      <View style={trimStyles.labels}>
        <Text style={trimStyles.label}>{formatClock(startSec)}</Text>
        <Text style={trimStyles.label}>TRIM</Text>
        <Text style={trimStyles.label}>{formatClock(endSec)}</Text>
      </View>
    </View>
  );
}

const trimStyles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 10 },
  film: {
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#0A0E1A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  frame: { flex: 1, borderRightWidth: 1, borderRightColor: '#1F293D' },
  frameA: { backgroundColor: '#1A2336' },
  frameB: { backgroundColor: '#121A2A' },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,87,34,0.28)',
    borderColor: NEON_ORANGE,
    borderWidth: 1.5,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 18,
    marginLeft: -9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    width: 4,
    height: '70%',
    borderRadius: 2,
    backgroundColor: NEON_ORANGE,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#FFFFFF',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: { color: '#8A99AD', fontSize: 10, fontWeight: '700' },
});

function ClipPreviewModal({
  visible,
  uri,
  fallbackDuration,
  onRetake,
  onNext,
}: {
  visible: boolean;
  uri: string | null;
  fallbackDuration: number;
  onRetake: () => void;
  onNext: (opts: {
    slowMoEnabled: boolean;
    slowMoRate: number;
    slowMoStartSec: number;
    slowMoEndSec: number;
  }) => void;
}) {
  const bootDur = Math.max(1, fallbackDuration || 15);
  const [playing, setPlaying] = useState(true);
  const [slowMoRate, setSlowMoRate] = useState(0.5);
  const [duration, setDuration] = useState(bootDur);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(bootDur);
  const [playheadSec, setPlayheadSec] = useState(0);
  const startSecRef = useRef(0);
  const endSecRef = useRef(bootDur);

  useEffect(() => {
    startSecRef.current = startSec;
    endSecRef.current = endSec;
  }, [startSec, endSec]);

  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = false;
    p.muted = false;
    try {
      p.timeUpdateEventInterval = 0.05;
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    if (!player || !visible) return;
    try {
      // eslint-disable-next-line react-hooks/immutability -- VideoPlayer API
      player.playbackRate = slowMoRate;
      if (playing) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [player, slowMoRate, playing, visible]);

  useEffect(() => {
    if (!player || !visible) return;
    let sub: { remove?: () => void } | null = null;
    let statusSub: { remove?: () => void } | null = null;
    let durTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const syncDuration = () => {
        const nativeDur = Number(player.duration);
        if (Number.isFinite(nativeDur) && nativeDur > 0.2) {
          setDuration(nativeDur);
          setEndSec((e) => Math.min(Math.max(e, MIN_TRIM_SPAN), nativeDur));
        }
      };
      durTimer = setTimeout(syncDuration, 120);
      statusSub = player.addListener?.('statusChange', syncDuration);
      sub = player.addListener?.('timeUpdate', (payload: { currentTime?: number }) => {
        const t =
          typeof payload?.currentTime === 'number'
            ? payload.currentTime
            : Number(player.currentTime) || 0;
        setPlayheadSec(t);
        const s = startSecRef.current;
        const e = endSecRef.current;
        if (t >= e - 0.05 || t < s - 0.05) {
          try {
            player.currentTime = s;
          } catch {
            /* ignore */
          }
        }
      });
    } catch {
      /* ignore */
    }
    return () => {
      if (durTimer) clearTimeout(durTimer);
      try {
        sub?.remove?.();
        statusSub?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, [player, visible]);

  const togglePlay = () => {
    setPlaying((p) => !p);
  };

  if (!visible || !uri) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onRetake}>
      <View style={previewStyles.root}>
        <StatusBar barStyle="light-content" />
        <Text style={previewStyles.title}>Slow-Mo Preview</Text>

        <View style={previewStyles.videoWrap}>
          <VideoView
            style={previewStyles.video}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
          <TouchableOpacity
            style={previewStyles.playFab}
            onPress={togglePlay}
            activeOpacity={0.85}
          >
            <Text style={previewStyles.playFabText}>
              {playing ? '⏸' : '▶️'}
            </Text>
          </TouchableOpacity>
        </View>

        <FilmStripTrimmer
          duration={duration}
          startSec={startSec}
          endSec={endSec}
          playheadSec={playheadSec}
          onChangeRange={(s, e) => {
            setStartSec(s);
            setEndSec(e);
            try {
              if (player) {
                // eslint-disable-next-line react-hooks/immutability -- VideoPlayer seek API
                player.currentTime = s;
              }
            } catch {
              /* ignore */
            }
          }}
        />

        <Text style={previewStyles.rateLabel}>Playback speed</Text>
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
            onPress={() =>
              onNext({
                slowMoEnabled: slowMoRate < 1,
                slowMoRate,
                slowMoStartSec: startSec,
                slowMoEndSec: endSec,
              })
            }
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
  playFab: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    left: '42%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFabText: { fontSize: 18 },
  rateLabel: {
    color: '#8A99AD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
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
  const [showTimePill, setShowTimePill] = useState(true);
  const [timePillOpacity] = useState(() => new Animated.Value(1));

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [joshUnlocked3m, setJoshUnlocked3m] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraError, setCameraError] = useState('');

  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [slowMoEnabled, setSlowMoEnabled] = useState(false);
  const [slowMoRate, setSlowMoRate] = useState(0.5);
  const [slowMoStartSec, setSlowMoStartSec] = useState(0);
  const [slowMoEndSec, setSlowMoEndSec] = useState(15);

  const cameraRef = useRef<CameraView>(null);
  const recordingLockRef = useRef(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidePillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);

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

  const fadeTimePill = useCallback(
    (hide: boolean) => {
      if (!hide) {
        setShowTimePill(true);
        Animated.timing(timePillOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        return;
      }
      Animated.timing(timePillOpacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowTimePill(false);
      });
    },
    [timePillOpacity]
  );

  const scheduleHidePill = useCallback(() => {
    if (hidePillTimerRef.current) clearTimeout(hidePillTimerRef.current);
    hidePillTimerRef.current = setTimeout(() => {
      fadeTimePill(true);
    }, PILL_HIDE_MS);
  }, [fadeTimePill]);

  const revealTimePill = useCallback(() => {
    if (mode === 'BATTLE_BAWAAL' || isRecording) return;
    fadeTimePill(false);
    scheduleHidePill();
  }, [mode, isRecording, fadeTimePill, scheduleHidePill]);

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      void requestCameraPermission();
    }
    if (micPermission && !micPermission.granted) {
      void requestMicPermission();
    }
  }, [
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  useEffect(() => {
    // Auto-schedule first hide after boot
    if (bootMode !== 'BATTLE_BAWAAL') scheduleHidePill();
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (hidePillTimerRef.current) clearTimeout(hidePillTimerRef.current);
    };
    // Intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const safeNavigateHome = useCallback(
    (params: Record<string, unknown>) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setShowPreview(false);
      setShowPostSheet(false);
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            navigation?.navigate?.('Main', params);
          } catch (err) {
            console.warn('[UniversalCamera] navigate failed:', err);
            try {
              if (navigation?.canGoBack?.()) navigation.goBack?.();
            } catch {
              /* ignore */
            }
          } finally {
            navigatingRef.current = false;
          }
        }, 60);
      });
    },
    [navigation]
  );

  const handleClose = useCallback(() => {
    if (isRecording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        /* ignore */
      }
    }
    setShowPreview(false);
    setShowPostSheet(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (navigation?.canGoBack?.()) navigation.goBack?.();
        else navigation?.navigate?.('Main', { tab: 'Arena' });
      }, 40);
    });
  }, [isRecording, navigation]);

  const handleModeChange = useCallback(
    (next: CreationMode) => {
      if (isRecording || recordingLockRef.current) return;
      setMode(next);
      if (next === 'BATTLE_BAWAAL') {
        setShowTimePill(false);
        if (hidePillTimerRef.current) clearTimeout(hidePillTimerRef.current);
        return;
      }
      const nextDur = Math.min(
        defaultDuration(next),
        modeCeiling(next, joshUnlocked3m)
      );
      setSelectedDuration(nextDur);
      fadeTimePill(false);
      scheduleHidePill();
    },
    [isRecording, joshUnlocked3m, fadeTimePill, scheduleHidePill]
  );

  const handleTimeSelect = useCallback(
    (sec: number) => {
      if (isRecording) return;
      setSelectedDuration(sec);
      fadeTimePill(false);
      scheduleHidePill();
    },
    [isRecording, fadeTimePill, scheduleHidePill]
  );

  const handleToggle3mExtension = useCallback(() => {
    if (isRecording || mode !== 'JOSH') return;
    if (joshUnlocked3m) {
      setJoshUnlocked3m(false);
      setSelectedDuration((d) => Math.min(d, 60));
      return;
    }
    setJoshUnlocked3m(true);
    setSelectedDuration(180);
    fadeTimePill(false);
    scheduleHidePill();
  }, [isRecording, mode, joshUnlocked3m, fadeTimePill, scheduleHidePill]);

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
    setShowPreview(false);
    setShowPostSheet(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        navigation?.navigate?.('ChallengerArena', {
          mode: 'athlete',
          role: 'host',
          battleId: card?.id || `live-${Date.now()}`,
          match: card?.liveMatch || null,
        });
      }, 40);
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
    fadeTimePill(true);
    startElapsedTimer();

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: recordLimit,
      });
      const uri =
        typeof video?.uri === 'string' && video.uri.length > 0
          ? video.uri
          : null;
      clearElapsedTimer();
      setIsRecording(false);
      recordingLockRef.current = false;

      if (!uri) {
        setCameraError('Recording finished without a clip. Try again.');
        return;
      }

      setRecordedVideoUri(uri);
      setSlowMoEndSec(recordLimit);

      if (mode === 'SPARKS' || mode === 'JOSH') {
        setShowPreview(true);
      } else {
        setShowPostSheet(true);
      }
    } catch (e) {
      console.error('[UniversalCamera] Recording error:', e);
      clearElapsedTimer();
      setIsRecording(false);
      recordingLockRef.current = false;
      setCameraError('Could not save this clip. Try again.');
    }
  }, [
    mode,
    isCameraReady,
    isRecording,
    recordLimit,
    fadeTimePill,
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
          setCameraError(err?.message || 'Could not start camera.');
        }}
      />

      {/* Tap viewfinder to restore time pill */}
      <Pressable
        style={styles.viewfinderTap}
        onPress={revealTimePill}
        disabled={isRecording || mode === 'BATTLE_BAWAAL'}
      />

      <View
        pointerEvents="box-none"
        style={[styles.absoluteFill, styles.overlayRoot]}
      >
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

        {!!cameraError && (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={() => setCameraError('')}
          >
            <Text style={styles.errorBannerText}>{cameraError}</Text>
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          {/* Dark rounded duration pill (button1 style) */}
          {mode !== 'BATTLE_BAWAAL' && showTimePill && (
            <Animated.View
              style={[styles.timePill, { opacity: timePillOpacity }]}
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

          {/* Red shutter in circular track */}
          <TouchableOpacity
            style={styles.shutterWrap}
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

          {/* Neon-orange mode strip on dark glass */}
          <View style={styles.modeStrip}>
            {MODE_STRIP.map((item) => {
              const active = mode === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => handleModeChange(item.id)}
                  disabled={isRecording}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.modeText,
                      active && styles.modeTextActive,
                      isRecording && !active && styles.modeTextDim,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {item.label}
                  </Text>
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
        fallbackDuration={recordLimit}
        onRetake={() => {
          setShowPreview(false);
          setRecordedVideoUri(null);
          setSlowMoEnabled(false);
          setSlowMoRate(0.5);
          revealTimePill();
        }}
        onNext={({
          slowMoEnabled: sm,
          slowMoRate: rate,
          slowMoStartSec: s,
          slowMoEndSec: e,
        }) => {
          setSlowMoEnabled(sm);
          setSlowMoRate(rate);
          setSlowMoStartSec(s);
          setSlowMoEndSec(e);
          setShowPreview(false);
          requestAnimationFrame(() => setShowPostSheet(true));
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
          slowMoStartSec={slowMoStartSec}
          slowMoEndSec={slowMoEndSec}
          durationSec={recordLimit}
          onClose={() => setShowPostSheet(false)}
          onSuccess={(payload) => {
            if (payload) onPublished?.(payload);
            const tab =
              payload?.feedTarget === 'BATTLES' ? 'Battles' : 'Arena';
            const safePost = payload?.newPost || {
              id: `fallback-${Date.now()}`,
              mode,
              videoUri: recordedVideoUri,
              title: 'BAWAAL Drop',
              timestamp: Date.now(),
              feedTarget: tab === 'Battles' ? 'BATTLES' : 'ARENA',
            };
            safeNavigateHome({
              tab,
              ...(tab === 'Arena' ? { newArenaPost: safePost } : {}),
              ...(tab === 'Battles' ? { newBattlePost: safePost } : {}),
            });
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
  viewfinderTap: {
    ...ABSOLUTE_FILL,
    top: 90,
    bottom: 220,
  },
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
  errorBanner: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,59,48,0.2)',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '88%',
  },
  errorBannerText: { color: '#FF8A80', fontSize: 12, fontWeight: '700' },
  bottomControls: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 18, 28, 0.92)',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  timeChipActive: {
    backgroundColor: NEON_ORANGE,
  },
  timeChipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
  },
  timeChipTextActive: { color: '#FFFFFF' },
  shutterWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: SHUTTER_RED,
  },
  shutterSquare: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: SHUTTER_RED,
  },
  shutterInnerLive: {
    backgroundColor: SHUTTER_RED,
    borderWidth: 3,
    borderColor: NEON_ORANGE,
  },
  modeStrip: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(10, 14, 26, 0.82)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,87,34,0.35)',
    gap: 2,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,87,34,0.18)',
  },
  modeText: {
    color: NEON_ORANGE,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  modeTextActive: {
    color: NEON_ORANGE,
    textShadowColor: 'rgba(255,87,34,0.55)',
    textShadowRadius: 6,
  },
  modeTextDim: { opacity: 0.45 },
});
