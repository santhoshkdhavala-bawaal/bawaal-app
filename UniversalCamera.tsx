/**
 * UniversalCamera — uncluttered BAWAAL creation engine.
 * Hub drawer for modes · duration pill · red shutter · region slow-mo preview.
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
  Image,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreationPostSheet from './PostCreationSheet';
import type {
  CreationMode,
  PostCreationPayload,
} from './PostCreationSheet';
import FilmStripTrimmer from './FilmStripTrimmer';
export type { CreationMode, PostCreationPayload };

/** Minimalist Black & White accent — never neon orange */
const ACCENT = '#FFFFFF';
const SHUTTER_RED = '#FF3B30';
const SHEET_BG = 'rgba(10,10,10,0.95)';
const TIME_OPTIONS = [5, 15, 30, 60] as const;
const PILL_HIDE_MS = 5000;
const MIN_TRIM_SPAN = 0.5;
const DOT_COUNT = 28;

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

type HubMode = {
  id: CreationMode;
  title: string;
  subtitle: string;
};

const HUB_MODES: HubMode[] = [
  {
    id: 'SPARKS',
    title: '⚡ SPARKS',
    subtitle: '30s max · Story heat that vanishes in 24h',
  },
  {
    id: 'JOSH',
    title: '🔥 JOSH',
    subtitle: '60s default · Unlock 3 min (180s) with coins',
  },
  {
    id: 'BATTLE_REWIND',
    title: '🥊 BATTLE REWIND',
    subtitle: '60s max · Async recorded challenge',
  },
  {
    id: 'BATTLE_BAWAAL',
    title: '⚔️ BATTLE BAWAAL',
    subtitle: 'Set challenge details · then launch live arena',
  },
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

/** Dashed/dotted animated progress ring around the red shutter. */
function DottedProgressRing({
  progress,
  recording,
}: {
  progress: number;
  recording: boolean;
}) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
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
                backgroundColor: active
                  ? '#FF0000'
                  : 'rgba(255,0,0,0.35)',
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

function BawaalHubDrawer({
  visible,
  onClose,
  onSelect,
  joshUnlocked3m,
  onToggleJosh3m,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: CreationMode) => void;
  joshUnlocked3m: boolean;
  onToggleJosh3m: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={hubStyles.backdrop} onPress={onClose} />
      <View
        style={[
          hubStyles.sheet,
          { paddingBottom: Math.max(insets.bottom, 18) },
        ]}
      >
        <View style={hubStyles.handle} />
        <Image
          source={require('./assets/bawaal-full-logo.png')}
          style={hubStyles.logo}
          resizeMode="contain"
        />
        <Text style={hubStyles.title}>BAWAAL Hub</Text>
        <Text style={hubStyles.sub}>Pick your creation mode</Text>

        {HUB_MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={hubStyles.card}
            activeOpacity={0.88}
            onPress={() => onSelect(m.id)}
          >
            <Text style={hubStyles.cardTitle}>{m.title}</Text>
            <Text style={hubStyles.cardSub}>{m.subtitle}</Text>
            {m.id === 'JOSH' && (
              <TouchableOpacity
                style={hubStyles.joshChip}
                onPress={onToggleJosh3m}
              >
                <Text style={hubStyles.joshChipText}>
                  {joshUnlocked3m
                    ? '⚡ 3 MIN UNLOCKED'
                    : '🔒 Unlock 3 min (10 coins)'}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const hubStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#FFFFFF',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555555',
    marginBottom: 10,
  },
  logo: { width: 130, height: 44, alignSelf: 'center', marginBottom: 4 },
  title: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  sub: {
    color: '#A3A3A3',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '900',
  },
  cardSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  joshChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  joshChipText: { color: ACCENT, fontSize: 11, fontWeight: '800' },
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
  const rateRef = useRef(0.5);
  const lastRateRef = useRef(1);
  const slowMoEnabled = slowMoRate > 0;

  useEffect(() => {
    startSecRef.current = startSec;
    endSecRef.current = endSec;
  }, [startSec, endSec]);

  useEffect(() => {
    // 0 = No Slow-Mo → always play at 1x inside the region too
    rateRef.current = slowMoRate > 0 ? slowMoRate : 1;
  }, [slowMoRate]);

  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = true;
    p.muted = false;
    try {
      p.timeUpdateEventInterval = 0.08;
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    if (!player || !visible) return;
    try {
      if (playing) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [player, playing, visible]);

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
      durTimer = setTimeout(syncDuration, 150);
      statusSub = player.addListener?.('statusChange', syncDuration);

      sub = player.addListener?.(
        'timeUpdate',
        (payload: { currentTime?: number }) => {
          const t =
            typeof payload?.currentTime === 'number'
              ? payload.currentTime
              : Number(player.currentTime) || 0;
          setPlayheadSec(t);

          const s = startSecRef.current;
          const e = endSecRef.current;
          const inSlow = t >= s && t <= e;
          const nextRate = inSlow ? rateRef.current : 1;
          if (Math.abs(nextRate - lastRateRef.current) > 0.01) {
            try {
              player.playbackRate = nextRate;
              lastRateRef.current = nextRate;
            } catch {
              /* ignore */
            }
          }
        }
      );
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
            style={previewStyles.playOverlay}
            onPress={() => setPlaying((p) => !p)}
            activeOpacity={0.85}
          >
            <View style={previewStyles.playCircle}>
              <Text style={previewStyles.playIcon}>
                {playing ? '❚❚' : '▶'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <FilmStripTrimmer
          duration={duration}
          startSec={startSec}
          endSec={endSec}
          playheadSec={playheadSec}
          onChangeRange={(s, e, commit) => {
            if (!commit) return;
            setStartSec(s);
            setEndSec(e);
          }}
          onSeekPlayhead={(sec) => {
            setPlayheadSec(sec);
            try {
              if (player) {
                // eslint-disable-next-line react-hooks/immutability -- VideoPlayer seek API
                player.currentTime = sec;
              }
            } catch {
              /* ignore */
            }
          }}
        />

        <Text style={previewStyles.rateLabel}>
          Slow-mo speed (inside red box only)
        </Text>
        <View style={previewStyles.rateRow}>
          {[0, 0.25, 0.5, 0.75].map((rate) => {
            const active = slowMoRate === rate;
            return (
              <TouchableOpacity
                key={`rate-${rate}`}
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
                  {rate === 0 ? 'No Slow-Mo' : `${rate}x`}
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
                slowMoEnabled,
                slowMoRate: slowMoEnabled ? slowMoRate : 1,
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
    backgroundColor: '#0A0A0A',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    color: ACCENT,
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
    borderColor: '#333333',
  },
  video: { flex: 1 },
  playOverlay: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 26,
    color: ACCENT,
    fontWeight: '700',
  },
  rateLabel: {
    color: '#A3A3A3',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  rateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
  },
  rateChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  rateText: { color: '#A3A3A3', fontWeight: '800', fontSize: 12 },
  rateTextActive: { color: '#000000' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCENT,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 12,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#000000', fontWeight: '900', fontSize: 13 },
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

  const rawBootMode: CreationMode =
    initialMode ||
    (route?.params?.initialMode as CreationMode | undefined) ||
    'SPARKS';
  // Never boot camera into BATTLE_BAWAAL — that route is the challenge form
  const bootMode: CreationMode =
    rawBootMode === 'BATTLE_BAWAAL' ? 'SPARKS' : rawBootMode;

  const [mode, setMode] = useState<CreationMode>(bootMode);
  const [hubOpen, setHubOpen] = useState(false);
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
    hidePillTimerRef.current = setTimeout(() => fadeTimePill(true), PILL_HIDE_MS);
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
    scheduleHidePill();
    if (rawBootMode === 'BATTLE_BAWAAL') {
      const t = setTimeout(() => {
        navigation?.navigate?.('BattleChallengeForm');
      }, 80);
      return () => {
        clearTimeout(t);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        if (hidePillTimerRef.current) clearTimeout(hidePillTimerRef.current);
      };
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (hidePillTimerRef.current) clearTimeout(hidePillTimerRef.current);
    };
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
      setHubOpen(false);
      // 300ms after sheet close — prevents SPARKS/JOSH unmount race crashes
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
      }, 300);
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
    setHubOpen(false);
    setTimeout(() => {
      if (navigation?.canGoBack?.()) navigation.goBack?.();
      else navigation?.navigate?.('Main', { tab: 'Arena' });
    }, 80);
  }, [isRecording, navigation]);

  const openBattleChallengeForm = useCallback(() => {
    setShowPreview(false);
    setShowPostSheet(false);
    setHubOpen(false);
    setTimeout(() => {
      navigation?.navigate?.('BattleChallengeForm');
    }, 80);
  }, [navigation]);

  const handleHubSelect = useCallback(
    (next: CreationMode) => {
      setHubOpen(false);
      // CRITICAL: Battle Bawaal opens challenge setup — never a camera mode
      if (next === 'BATTLE_BAWAAL') {
        openBattleChallengeForm();
        return;
      }
      setMode(next);
      const nextDur = Math.min(
        defaultDuration(next),
        modeCeiling(next, joshUnlocked3m)
      );
      setSelectedDuration(nextDur);
      fadeTimePill(false);
      scheduleHidePill();
    },
    [joshUnlocked3m, fadeTimePill, scheduleHidePill, openBattleChallengeForm]
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

  const startRecording = useCallback(async () => {
    if (mode === 'BATTLE_BAWAAL') {
      openBattleChallengeForm();
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
    openBattleChallengeForm,
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
      openBattleChallengeForm();
      return;
    }
    if (isRecording) stopRecording();
    else void startRecording();
  }, [mode, isRecording, openBattleChallengeForm, stopRecording, startRecording]);

  const flipCamera = useCallback(() => {
    if (isRecording) return;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  /** Gallery → same preview / post sheet path as a fresh recording (then uploadVideoToSupabase). */
  const pickFromGallery = useCallback(async () => {
    if (isRecording || mode === 'BATTLE_BAWAAL') return;

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setCameraError('Gallery access is needed to pick a video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: modeCeiling(mode, joshUnlocked3m) || undefined,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      const assetDurationSec =
        typeof result.assets[0].duration === 'number' &&
        result.assets[0].duration > 0
          ? Math.ceil(result.assets[0].duration / 1000)
          : recordLimit;

      setCameraError('');
      setRecordedVideoUri(uri);
      setSlowMoEnabled(false);
      setSlowMoRate(0.5);
      setSlowMoStartSec(0);
      setSlowMoEndSec(assetDurationSec);
      fadeTimePill(true);

      if (mode === 'SPARKS' || mode === 'JOSH') {
        setShowPreview(true);
      } else {
        setShowPostSheet(true);
      }
    } catch (err) {
      console.error('[UniversalCamera] Gallery pick failed:', err);
      setCameraError('Could not open gallery. Try again.');
    }
  }, [isRecording, mode, joshUnlocked3m, recordLimit, fadeTimePill]);

  const progress =
    isRecording && recordLimit > 0
      ? Math.min(1, elapsedSec / recordLimit)
      : 0;

  const permissionsPending =
    cameraPermission == null || micPermission == null;
  const permissionsGranted =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  const modeLabel =
    HUB_MODES.find((m) => m.id === mode)?.title || '⚡ SPARKS';

  if (permissionsPending) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color={ACCENT} size="large" />
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

      <Pressable
        style={styles.viewfinderTap}
        onPress={revealTimePill}
        disabled={isRecording || mode === 'BATTLE_BAWAAL'}
      />

      <View
        pointerEvents="box-none"
        style={[styles.absoluteFill, styles.overlayRoot]}
      >
        {/* Glassmorphic CANCEL / FLIP */}
        <View
          style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.glassPill}
            accessibilityLabel="Cancel"
          >
            <Text style={styles.glassPillText}>✕ CANCEL</Text>
          </TouchableOpacity>

          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>
              {mode === 'BATTLE_BAWAAL'
                ? '🔴 BATTLE BAWAAL'
                : isRecording
                  ? `🔴 ${formatClock(elapsedSec)} / ${formatClock(recordLimit)}`
                  : modeLabel}
            </Text>
          </View>

          <TouchableOpacity
            onPress={flipCamera}
            style={styles.flipPill}
            disabled={isRecording}
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.flipPillText}>🔄 FLIP</Text>
          </TouchableOpacity>
        </View>

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

          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={[
                styles.galleryBtn,
                (isRecording || mode === 'BATTLE_BAWAAL') &&
                  styles.galleryBtnDisabled,
              ]}
              onPress={() => {
                void pickFromGallery();
              }}
              activeOpacity={0.85}
              disabled={isRecording || mode === 'BATTLE_BAWAAL'}
              accessibilityLabel="Pick video from gallery"
            >
              <View style={styles.galleryIconFrame}>
                <View style={styles.galleryIconPlay} />
              </View>
              <Text style={styles.galleryLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shutterWrap}
              onPress={handleShutter}
              activeOpacity={0.85}
            >
              <DottedProgressRing progress={progress} recording={isRecording} />
              <View
                style={[
                  styles.shutterInner,
                  isRecording && styles.shutterSquare,
                  mode === 'BATTLE_BAWAAL' && styles.shutterInnerLive,
                ]}
              />
            </TouchableOpacity>

            {/* Balance spacer so shutter stays centered */}
            <View style={styles.galleryBtnSpacer} />
          </View>

          {/* Glowing BAWAAL Hub FAB — replaces heavy mode strip */}
          <TouchableOpacity
            style={styles.hubFab}
            onPress={() => !isRecording && setHubOpen(true)}
            activeOpacity={0.9}
            disabled={isRecording}
          >
            <Text style={styles.hubFabText}>BAWAAL Hub</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BawaalHubDrawer
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
        onSelect={handleHubSelect}
        joshUnlocked3m={joshUnlocked3m}
        onToggleJosh3m={() => setJoshUnlocked3m((v) => !v)}
      />

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
          setTimeout(() => setShowPostSheet(true), 60);
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
    top: 100,
    bottom: 210,
  },
  overlayRoot: { justifyContent: 'space-between' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    color: ACCENT,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#000000', fontWeight: '800' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  glassPill: {
    backgroundColor: 'rgba(10, 14, 26, 0.72)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  glassPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  flipPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  flipPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timerBadge: {
    backgroundColor: 'rgba(10, 10, 10, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    maxWidth: '42%',
  },
  timerText: {
    color: ACCENT,
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
  },
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
  timeChipActive: { backgroundColor: ACCENT },
  timeChipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
  },
  timeChipTextActive: { color: '#000000' },
  shutterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  galleryBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  galleryBtnDisabled: {
    opacity: 0.35,
  },
  galleryBtnSpacer: {
    width: 72,
  },
  galleryIconFrame: {
    width: 22,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  galleryIconPlay: {
    width: 0,
    height: 0,
    marginLeft: 2,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 7,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  galleryLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  shutterWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 18,
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
    borderColor: ACCENT,
  },
  hubFab: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  hubFabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
