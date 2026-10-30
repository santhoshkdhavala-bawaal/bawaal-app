/**
 * UniversalCamera — LOCKED minimal BAWAAL creation engine.
 * Cancel · Flip · dotted spinning shutter · native pinch-to-zoom (works while recording).
 * Do NOT re-add zoom presets, flash, floating speed badges, or slow-mo overlays on the live lens.
 * Speed / slow-mo live only on post-record ClipPreviewModal.
 * See `.cursor/rules/bawaal-challengecam-locked.mdc` + `bawaal-ui-baseline`.
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
  InteractionManager,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import CreationPostSheet from './PostCreationSheet';
import type {
  CreationMode,
  PostCreationPayload,
} from './PostCreationSheet';
import FilmStripTrimmer from './FilmStripTrimmer';
import DeviceGalleryModal, {
  type DeviceGalleryAsset,
} from './src/components/DeviceGalleryModal';
import { stabilizeLocalVideoUri } from './src/services/uploadService';
import { lockLocalRecording } from './src/services/recordToPostService';
import { saveVideoToGallery } from './src/services/galleryMediaService';
import { isExpoGo } from './src/utils/runtimeEnv';
import { validateRecordedVideoUri } from './src/utils/recordedVideoUri';
export type { CreationMode, PostCreationPayload };

/** Minimalist Black & White */
const ACCENT = '#FFFFFF';
const SHUTTER_RED = '#FF3B30';
const SHEET_BG = 'rgba(10,10,10,0.95)';
const TIME_OPTIONS = [5, 15, 30, 60] as const;
const PILL_HIDE_MS = 5000;
const MIN_TRIM_SPAN = 0.5;
const DOT_COUNT = 28;

function clampZoom(z: number) {
  if (!Number.isFinite(z)) return 0;
  return Math.min(1, Math.max(0, z));
}

/** Yield so expo-camera / muxer can flush before preview mounts a decoder. */
function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Hardware lock release window after stopRecording resolves (~200ms). */
const RECORDING_TEARDOWN_MS = 200;
/** Extra beat after setting videoUri so React commits before ClipPreview mounts. */
const PREVIEW_HANDSHAKE_MS = 100;

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
  onPickGallery,
  galleryDisabled,
  joshUnlocked3m,
  onToggleJosh3m,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: CreationMode) => void;
  onPickGallery: () => void;
  galleryDisabled?: boolean;
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

        <TouchableOpacity
          style={[
            hubStyles.card,
            hubStyles.galleryCard,
            galleryDisabled && hubStyles.galleryCardDisabled,
          ]}
          activeOpacity={0.88}
          disabled={galleryDisabled}
          onPress={() => {
            if (galleryDisabled) return;
            onClose();
            // Let hub modal dismiss before launching the system picker
            setTimeout(() => onPickGallery(), 220);
          }}
          accessibilityLabel="Pick video from gallery"
        >
          <Text style={hubStyles.cardTitle}>Gallery</Text>
          <Text style={hubStyles.cardSub}>
            Select clips with checkboxes — delete or use for a post
          </Text>
        </TouchableOpacity>
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
  galleryCard: {
    borderStyle: 'dashed' as const,
    marginTop: 4,
  },
  galleryCardDisabled: {
    opacity: 0.4,
  },
});

/** Allowed slow-mo rates — never index outside this list. */
const SLOWMO_RATES = [0, 0.25, 0.5, 0.75] as const;
type SlowMoRate = (typeof SLOWMO_RATES)[number];

function clampSlowMoRate(rate: unknown): SlowMoRate {
  const n = typeof rate === 'number' ? rate : Number(rate);
  if (!Number.isFinite(n)) return 0.5;
  const hit = SLOWMO_RATES.find((r) => Math.abs(r - n) < 0.001);
  return hit ?? 0.5;
}

function safeDurationSec(value: unknown, fallback = 15): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.max(1, fallback);
  return Math.max(1, n);
}

/** Pause + unload so preview audio cannot ghost after Post / leave. */
function stopAndUnloadPlayer(player: {
  pause?: () => void;
  muted?: boolean;
  volume?: number;
  replace?: (source: null) => void;
  replaceAsync?: (source: null) => Promise<unknown>;
} | null) {
  if (!player) return;
  try {
    player.pause?.();
  } catch {
    /* ignore */
  }
  try {
    player.muted = true;
    player.volume = 0;
  } catch {
    /* ignore */
  }
  try {
    // expo-video equivalent of unloadAsync — clears decoder + audio session
    if (typeof player.replace === 'function') {
      player.replace(null);
    } else if (typeof player.replaceAsync === 'function') {
      void player.replaceAsync(null);
    }
  } catch {
    /* ignore */
  }
}

type ClipPreviewModalProps = {
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
};

/** Expo Go: black shell — never mounts expo-video / native AV. */
function ExpoGoClipPreviewModal({
  visible,
  uri,
  fallbackDuration,
  onRetake,
  onNext,
}: ClipPreviewModalProps) {
  const bootDur = safeDurationSec(fallbackDuration, 15);
  if (!visible || !uri) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onRetake}>
      <View style={previewStyles.root}>
        <StatusBar barStyle="light-content" />
        <Text style={previewStyles.title}>Slow-Mo Preview</Text>
        <View style={previewStyles.videoWrap}>
          <View style={previewStyles.expoGoPlaceholder}>
            <Text style={previewStyles.expoGoPlaceholderTitle}>PREVIEW</Text>
            <Text style={previewStyles.expoGoPlaceholderBody}>
              Video playback needs a development build
            </Text>
          </View>
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
                slowMoEnabled: false,
                slowMoRate: 1,
                slowMoStartSec: 0,
                slowMoEndSec: bootDur,
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

function NativeClipPreviewModal({
  visible,
  uri,
  fallbackDuration,
  onRetake,
  onNext,
}: ClipPreviewModalProps) {
  const bootDur = safeDurationSec(fallbackDuration, 15);
  const [playing, setPlaying] = useState(true);
  const [slowMoRate, setSlowMoRate] = useState<SlowMoRate>(0.5);
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

  // Only attach a source while the preview is on-screen — kills ghost audio
  const player = useVideoPlayer(
    visible && uri ? { uri } : null,
    (p) => {
      p.loop = true;
      p.muted = false;
      try {
        p.timeUpdateEventInterval = 0.08;
      } catch {
        /* ignore */
      }
    }
  );

  // Play / pause while visible; when hidden → hard stop + unload (ghost fix)
  useEffect(() => {
    if (!player) return;
    if (!visible) {
      stopAndUnloadPlayer(player);
      return;
    }
    try {
      if (playing) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [player, playing, visible]);

  // Unmount safety net — always tear down audio
  useEffect(() => {
    return () => {
      stopAndUnloadPlayer(player);
    };
  }, [player]);

  useEffect(() => {
    if (!player || !visible) return;
    let sub: { remove?: () => void } | null = null;
    let statusSub: { remove?: () => void } | null = null;
    let durTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const syncDuration = () => {
        const nativeDur = Number(player.duration);
        if (!Number.isFinite(nativeDur) || nativeDur <= 0.2) return;
        const safeDur = safeDurationSec(nativeDur, bootDur);
        setDuration(safeDur);
        setStartSec((s) => {
          const next = Math.max(0, Math.min(Number(s) || 0, safeDur - MIN_TRIM_SPAN));
          return Number.isFinite(next) ? next : 0;
        });
        setEndSec((e) => {
          const raw = Number(e);
          const next = Math.min(
            safeDur,
            Math.max(Number.isFinite(raw) ? raw : safeDur, MIN_TRIM_SPAN)
          );
          return Number.isFinite(next) ? next : safeDur;
        });
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
  }, [player, visible, bootDur]);

  const handleRetake = useCallback(() => {
    setPlaying(false);
    stopAndUnloadPlayer(player);
    onRetake();
  }, [player, onRetake]);

  const handleNextToPost = useCallback(() => {
    setPlaying(false);
    stopAndUnloadPlayer(player);
    const dur = safeDurationSec(duration, bootDur);
    const start = Math.max(0, Math.min(Number(startSec) || 0, dur - MIN_TRIM_SPAN));
    const end = Math.min(
      dur,
      Math.max(Number(endSec) || dur, start + MIN_TRIM_SPAN)
    );
    const rate = clampSlowMoRate(slowMoRate);
    onNext({
      slowMoEnabled: rate > 0,
      slowMoRate: rate > 0 ? rate : 1,
      slowMoStartSec: Number.isFinite(start) ? start : 0,
      slowMoEndSec: Number.isFinite(end) ? end : dur,
    });
  }, [
    player,
    onNext,
    slowMoRate,
    startSec,
    endSec,
    duration,
    bootDur,
  ]);

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
          {SLOWMO_RATES.map((rate) => {
            const active = Math.abs(slowMoRate - rate) < 0.001;
            return (
              <TouchableOpacity
                key={`rate-${rate}`}
                style={[
                  previewStyles.rateChip,
                  active && previewStyles.rateChipActive,
                ]}
                onPress={() => setSlowMoRate(clampSlowMoRate(rate))}
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
            onPress={handleRetake}
            activeOpacity={0.85}
          >
            <Text style={previewStyles.secondaryText}>RETAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={previewStyles.primaryBtn}
            onPress={handleNextToPost}
            activeOpacity={0.9}
          >
            <Text style={previewStyles.primaryText}>NEXT TO POST</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ClipPreviewModal(props: ClipPreviewModalProps) {
  if (isExpoGo) {
    return <ExpoGoClipPreviewModal {...props} />;
  }
  return <NativeClipPreviewModal {...props} />;
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
  expoGoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#000000',
  },
  expoGoPlaceholderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  expoGoPlaceholderBody: {
    color: '#A3A3A3',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
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

  const respondParams = route?.params || {};
  /** + BATTLE / Battles LAUNCH → 1-tap Arena Open Challenge camera */
  const isOpenerCapture = Boolean(
    respondParams.captureOpenerOnly || respondParams.isArenaOpenChallenge
  );
  const isChallengeResponse =
    !isOpenerCapture &&
    Boolean(
      respondParams.isChallengeResponse ||
        respondParams.battleId ||
        respondParams.challengeId
    );
  const rawBootMode: CreationMode =
    initialMode ||
    (respondParams.initialMode as CreationMode | undefined) ||
    (isChallengeResponse ? 'BATTLE_REWIND' : undefined) ||
    'SPARKS';
  // Never boot camera into BATTLE_BAWAAL — that route is the challenge form
  const bootMode: CreationMode =
    rawBootMode === 'BATTLE_BAWAAL' ? 'SPARKS' : rawBootMode;

  const challengeMaxDuration = Math.max(
    5,
    Math.min(
      60,
      Number(respondParams.challengeMaxDuration) ||
        Number((respondParams.reel as { challengeMaxDuration?: number } | undefined)?.challengeMaxDuration) ||
        defaultDuration(bootMode)
    )
  );

  const [mode, setMode] = useState<CreationMode>(bootMode);
  const [hubOpen, setHubOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(() =>
    isChallengeResponse
      ? Math.min(challengeMaxDuration, modeCeiling(bootMode, false))
      : defaultDuration(bootMode)
  );
  const [showTimePill, setShowTimePill] = useState(true);
  const [timePillOpacity] = useState(() => new Animated.Value(1));

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [joshUnlocked3m, setJoshUnlocked3m] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoom, setZoom] = useState(0);
  const [cameraError, setCameraError] = useState('');

  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [galleryAssetId, setGalleryAssetId] = useState<string | null>(null);
  const [showDeviceGallery, setShowDeviceGallery] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);
  /** True while awaiting recordAsync settle + HW release before preview. */
  const [isFinalizingClip, setIsFinalizingClip] = useState(false);
  /** True during stop → compress/save — blocks UI / unmount races. */
  const [isProcessing, setIsProcessing] = useState(false);
  const [slowMoEnabled, setSlowMoEnabled] = useState(false);
  const [slowMoRate, setSlowMoRate] = useState<SlowMoRate>(0.5);
  const [slowMoStartSec, setSlowMoStartSec] = useState(0);
  const [slowMoEndSec, setSlowMoEndSec] = useState(15);

  const cameraRef = useRef<CameraView>(null);
  const recordingLockRef = useRef(false);
  const stoppingRef = useRef(false);
  /** Settles when the in-flight `recordAsync` promise resolves (video object ready). */
  const recordAsyncWaitRef = useRef<Promise<unknown> | null>(null);
  /** Staged URI — set before React state so we never mount preview on a mid-flush path. */
  const pendingPreviewUriRef = useRef<string | null>(null);
  const pinchBaseZoomRef = useRef(0);
  const zoomRef = useRef(0);
  /** Bumped after each publish/close so CameraView remounts a clean native recorder. */
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
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

  // One-shot permission request on mount — avoids black / dead camera states
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([requestCameraPermission(), requestMicPermission()]);
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[UniversalCamera] permission request failed:',
            (err as Error)?.message || err
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestCameraPermission, requestMicPermission]);

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

  const clearHidePillTimer = useCallback(() => {
    if (hidePillTimerRef.current) {
      clearTimeout(hidePillTimerRef.current);
      hidePillTimerRef.current = null;
    }
  }, []);

  const applyZoom = useCallback((next: number) => {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
  }, []);

  /** Smooth continuous zoom — enabled before and during recording. */
  const onPinchGestureEvent = useCallback(
    (e: PinchGestureHandlerGestureEvent) => {
      if (mode === 'BATTLE_BAWAAL') return;
      const scale = e.nativeEvent.scale;
      if (!Number.isFinite(scale) || scale <= 0) return;
      // scale starts at 1 each gesture; map onto CameraView 0–1 with light acceleration
      const base = pinchBaseZoomRef.current;
      const next = base + (scale - 1) * (0.85 + base * 0.4);
      applyZoom(next);
    },
    [applyZoom, mode]
  );

  const onPinchHandlerStateChange = useCallback(
    (e: PinchGestureHandlerStateChangeEvent) => {
      const { state, oldState } = e.nativeEvent;
      if (state === State.BEGAN || oldState === State.BEGAN) {
        pinchBaseZoomRef.current = zoomRef.current;
      }
    },
    []
  );

  /**
   * Release native recorder resources so a second take never hits a stale session.
   * Do NOT call this between stopRecording and preview handoff — that unmounts/tears
   * down while the muxer is still flushing and can throw native memory exceptions.
   */
  const releaseCameraRecorder = useCallback(() => {
    const cam = cameraRef.current;
    recordingLockRef.current = false;
    stoppingRef.current = false;
    try {
      cam?.stopRecording?.();
    } catch {
      /* ignore — may not be recording */
    }
    setIsRecording(false);
    setIsFinalizingClip(false);
    setIsProcessing(false);
    clearElapsedTimer();
  }, [clearElapsedTimer]);

  /**
   * Safe preview handshake: keep CameraView mounted, stage URI, wait for HW release,
   * then commit videoUri and only afterwards open ClipPreviewModal / post sheet.
   */
  const handoffRecordedClip = useCallback(
    async (uri: string, opts?: { openPreview?: boolean }) => {
      const openPreview = opts?.openPreview !== false;
      pendingPreviewUriRef.current = uri;
      setIsProcessing(true);
      setIsFinalizingClip(true);
      setIsRecording(false);
      recordingLockRef.current = false;
      stoppingRef.current = false;
      clearElapsedTimer();

      // Let expo-camera fully release the capture lock before any decoder mounts
      await waitMs(RECORDING_TEARDOWN_MS);
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      // Commit URI first — do not toggle showPreview in the same sync turn
      setRecordedVideoUri(uri);
      setShowPreview(false);
      setShowPostSheet(false);

      await waitMs(PREVIEW_HANDSHAKE_MS);

      if (pendingPreviewUriRef.current !== uri) {
        // A newer take / retake superseded this handoff
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }

      if (openPreview) {
        setShowPreview(true);
        setShowPostSheet(false);
      } else {
        setShowPreview(false);
        setShowPostSheet(true);
      }
      setIsFinalizingClip(false);
      setIsProcessing(false);
    },
    [clearElapsedTimer]
  );

  // Camera / recorder lifecycle — stop recording + clear timers / player refs on unmount
  useEffect(() => {
    return () => {
      recordingLockRef.current = false;
      stoppingRef.current = false;
      pendingPreviewUriRef.current = null;
      recordAsyncWaitRef.current = null;
      try {
        cameraRef.current?.stopRecording?.();
      } catch {
        /* ignore */
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      if (hidePillTimerRef.current) {
        clearTimeout(hidePillTimerRef.current);
        hidePillTimerRef.current = null;
      }
    };
  }, []);

  const startElapsedTimer = useCallback(() => {
    clearElapsedTimer();
    setElapsedSec(0);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, [clearElapsedTimer]);

  /**
   * Hard reset of preview / post / slow-mo / camera session state.
   * Prevents stale trimmer/rate indexes and recorder crashes on the next take.
   */
  const resetCreationSession = useCallback(
    (opts?: { remountCamera?: boolean }) => {
      // 1) Unbind native recorder first
      releaseCameraRecorder();
      // 2) Clear all JS session / trimmer / rate state to defaults
      pendingPreviewUriRef.current = null;
      recordAsyncWaitRef.current = null;
      setShowPreview(false);
      setShowPostSheet(false);
      setHubOpen(false);
      setRecordedVideoUri(null);
      setGalleryAssetId(null);
      setSlowMoEnabled(false);
      setSlowMoRate(0.5);
      setSlowMoStartSec(0);
      setSlowMoEndSec(safeDurationSec(selectedDuration || recordLimit, 15));
      setElapsedSec(0);
      setCameraError('');
      setIsFinalizingClip(false);
      setIsProcessing(false);
      clearHidePillTimer();
      recordingLockRef.current = false;
      stoppingRef.current = false;
      // 3) Remount CameraView ONLY when explicitly requested (post-publish / crash recovery)
      // NEVER remount on Retake — remount blacks the live preview until user leaves the screen.
      if (opts?.remountCamera === true) {
        setIsCameraReady(false);
        setCameraSessionKey((k) => k + 1);
      }
    },
    [
      selectedDuration,
      recordLimit,
      releaseCameraRecorder,
      clearHidePillTimer,
    ]
  );

  /**
   * Retake → drop clip/preview and return to the SAME live CameraView session.
   * Must not remount <CameraView/> or flip isCameraReady (Android black viewfinder).
   */
  const returnToLiveCamera = useCallback(() => {
    pendingPreviewUriRef.current = null;
    setShowPreview(false);
    setShowPostSheet(false);
    setRecordedVideoUri(null);
    setGalleryAssetId(null);
    setSlowMoEnabled(false);
    setSlowMoRate(0.5);
    setSlowMoStartSec(0);
    setSlowMoEndSec(safeDurationSec(selectedDuration || recordLimit, 15));
    setElapsedSec(0);
    setCameraError('');
    recordingLockRef.current = false;
    stoppingRef.current = false;
    setIsRecording(false);
    setIsFinalizingClip(false);
    setIsProcessing(false);
    // Keep cameraSessionKey + isCameraReady untouched so the live feed stays attached
    revealTimePill();
  }, [selectedDuration, recordLimit, revealTimePill]);

  const safeNavigateHome = useCallback(
    (params: Record<string, unknown>) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      // Drop preview / player first so unmount does not race native AV
      setShowPreview(false);
      setShowPostSheet(false);
      pendingPreviewUriRef.current = null;
      // Screen is unmounting — skip remount (that was paying double camera init cost)
      resetCreationSession({ remountCamera: false });
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
    [navigation, resetCreationSession]
  );

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
      !isCameraReady ||
      isRecording ||
      isFinalizingClip ||
      isProcessing ||
      recordingLockRef.current ||
      stoppingRef.current
    ) {
      return;
    }

    // Full session teardown before every take (multi-sport sequential clips)
    pendingPreviewUriRef.current = null;
    resetCreationSession({ remountCamera: false });
    releaseCameraRecorder();

    // Yield so native stopRecording / state clears settle before recordAsync
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 32));
    });

    if (!isCameraReady || !cameraRef.current) {
      // Force a clean remount then abort this press — user taps shutter again
      setIsCameraReady(false);
      setCameraSessionKey((k) => k + 1);
      setCameraError('Camera resetting — tap shutter again.');
      return;
    }

    const cam = cameraRef.current;
    recordingLockRef.current = true;
    stoppingRef.current = false;
    setIsFinalizingClip(false);
    setIsProcessing(false);
    setIsRecording(true);
    fadeTimePill(true);
    startElapsedTimer();

    const recordPromise = cam.recordAsync({
      maxDuration: recordLimit,
      // Higher bitrate when slow-mo capture is armed (cleaner ramp / punch-ins)
    });
    recordAsyncWaitRef.current = recordPromise;

    try {
      const video = await recordPromise;
      // Video object resolved — keep CameraView mounted; do not remount/release yet
      const rawCheck = validateRecordedVideoUri(
        typeof video?.uri === 'string' ? video.uri : null
      );

      if (!rawCheck.ok || !rawCheck.uri) {
        clearElapsedTimer();
        setIsRecording(false);
        recordingLockRef.current = false;
        stoppingRef.current = false;
        setIsFinalizingClip(false);
        setIsProcessing(false);
        setCameraError(
          rawCheck.message ||
            'Recording finished without a valid .mp4 / .mov clip. Try again.'
        );
        return;
      }

      const uri = rawCheck.uri;

      // Gate UI before compress/save — still no preview mount yet
      setIsProcessing(true);
      setIsFinalizingClip(true);
      setIsRecording(false);
      clearElapsedTimer();

      // Persist to documentDirectory/bawaal_clips/bawaal_*.mp4 before gallery/post
      let stableUri = uri;
      try {
        stableUri =
          (await lockLocalRecording(uri)) ||
          (await stabilizeLocalVideoUri(uri)) ||
          uri;
      } catch (stabErr) {
        console.warn(
          '[UniversalCamera] lock/stabilize failed, using raw uri:',
          (stabErr as Error)?.message || stabErr
        );
      }
      const stableCheck = validateRecordedVideoUri(stableUri);
      if (!stableCheck.ok || !stableCheck.uri) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        recordingLockRef.current = false;
        stoppingRef.current = false;
        setCameraError(
          stableCheck.message ||
            'Could not save a playable clip. Please retake.'
        );
        return;
      }
      stableUri = stableCheck.uri;
      setCameraError('');

      // Instagram-style: auto-save to Camera Roll (keep asset id for optional delete)
      void saveVideoToGallery(stableUri).then((res) => {
        if (res.ok && res.assetId) setGalleryAssetId(res.assetId);
      });

      const clipDur = safeDurationSec(recordLimit, 15);
      setSlowMoEnabled(false);
      setSlowMoRate(0.5);
      setSlowMoStartSec(0);
      setSlowMoEndSec(clipDur);

      // Staged handoff — URI → delay → preview (never sync-unmount camera mid-flush)
      const openPreview =
        mode === 'SPARKS' || mode === 'JOSH' || isOpenerCapture;
      await handoffRecordedClip(stableUri, { openPreview });
    } catch (e) {
      console.error('[UniversalCamera] Recording error:', e);
      recordAsyncWaitRef.current = null;
      stoppingRef.current = false;
      setIsFinalizingClip(false);
      setIsProcessing(false);
      releaseCameraRecorder();
      resetCreationSession({ remountCamera: true });
      setCameraError('Could not save this clip. Try again.');
    } finally {
      recordAsyncWaitRef.current = null;
    }
  }, [
    mode,
    isCameraReady,
    isRecording,
    isFinalizingClip,
    isProcessing,
    isOpenerCapture,
    recordLimit,
    fadeTimePill,
    startElapsedTimer,
    clearElapsedTimer,
    openBattleChallengeForm,
    releaseCameraRecorder,
    resetCreationSession,
    handoffRecordedClip,
  ]);

  /**
   * Stop capture and await native stop + recordAsync video object BEFORE any
   * React state / navigation. CameraView stays mounted through the 200ms HW window.
   */
  const stopRecording = useCallback(async () => {
    if ((!isRecording && !recordingLockRef.current) || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    try {
      const stopResult = cameraRef.current?.stopRecording?.() as
        | void
        | Promise<unknown>
        | undefined;
      if (stopResult && typeof (stopResult as Promise<unknown>).then === 'function') {
        await stopResult;
      }
    } catch (e) {
      console.warn('[UniversalCamera] stopRecording:', e);
    }
    // Await video object from the active recordAsync (started in startRecording)
    const pending = recordAsyncWaitRef.current;
    if (pending) {
      try {
        await Promise.race([
          pending,
          waitMs(10_000).then(() => {
            throw new Error('recordAsync settle timeout');
          }),
        ]);
      } catch (err) {
        console.warn(
          '[UniversalCamera] await recordAsync after stop:',
          (err as Error)?.message || err
        );
      }
    }
    // Safety timeout — expo-camera / muxer release before any state flip
    await waitMs(RECORDING_TEARDOWN_MS);
    setIsProcessing(true);
    setIsFinalizingClip(true);
  }, [isRecording]);

  const handleShutter = useCallback(() => {
    if (mode === 'BATTLE_BAWAAL') {
      openBattleChallengeForm();
      return;
    }
    if (isFinalizingClip || isProcessing) return;
    if (isRecording) void stopRecording();
    else void startRecording();
  }, [
    mode,
    isRecording,
    isFinalizingClip,
    isProcessing,
    openBattleChallengeForm,
    stopRecording,
    startRecording,
  ]);

  const handleClose = useCallback(() => {
    void (async () => {
      if (isRecording || recordingLockRef.current) {
        try {
          await stopRecording();
        } catch {
          /* ignore */
        }
        // Extra beat after stop so unmounting this screen cannot race the muxer
        await waitMs(PREVIEW_HANDSHAKE_MS);
      }
      pendingPreviewUriRef.current = null;
      // Soft reset only — remounting CameraView on every back makes the next open lag
      resetCreationSession({ remountCamera: false });
      setHubOpen(false);
      setTimeout(() => {
        if (navigation?.canGoBack?.()) navigation.goBack?.();
        else navigation?.navigate?.('Main', { tab: 'Arena' });
      }, 80);
    })();
  }, [isRecording, navigation, resetCreationSession, stopRecording]);

  const flipCamera = useCallback(() => {
    if (isRecording || isFinalizingClip || isProcessing) return;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording, isFinalizingClip, isProcessing]);

  /** Open in-app gallery (checkbox select + targeted delete / import). */
  const openDeviceGallery = useCallback(() => {
    if (
      isRecording ||
      isFinalizingClip ||
      isProcessing ||
      mode === 'BATTLE_BAWAAL'
    ) {
      return;
    }
    setShowDeviceGallery(true);
  }, [isRecording, isFinalizingClip, isProcessing, mode]);

  /**
   * Import one device gallery asset into the same preview / post path as a recording.
   */
  const importGalleryAsset = useCallback(
    async (picked: DeviceGalleryAsset) => {
      if (!picked?.uri || isFinalizingClip || isProcessing) return;
      let uri = picked.uri;
      try {
        uri =
          (await lockLocalRecording(uri)) ||
          (await stabilizeLocalVideoUri(uri)) ||
          uri;
      } catch (stabErr) {
        console.warn(
          '[UniversalCamera] gallery pick lock failed:',
          (stabErr as Error)?.message || stabErr
        );
      }

      const pickedAssetId =
        typeof picked.id === 'string' &&
        picked.id &&
        !/^(file|content|ph|assets-library|http):/i.test(picked.id) &&
        !picked.id.includes('://')
          ? picked.id
          : null;

      const assetDurationSec =
        typeof picked.duration === 'number' && picked.duration > 0
          ? Math.ceil(picked.duration)
          : recordLimit;

      setCameraError('');
      setShowDeviceGallery(false);
      setGalleryAssetId(pickedAssetId);
      setSlowMoEnabled(false);
      setSlowMoRate(0.5);
      setSlowMoStartSec(0);
      setSlowMoEndSec(safeDurationSec(assetDurationSec, recordLimit));
      fadeTimePill(true);

      const openPreview = mode === 'SPARKS' || mode === 'JOSH';
      await handoffRecordedClip(uri, { openPreview });
    },
    [
      mode,
      recordLimit,
      fadeTimePill,
      isFinalizingClip,
      isProcessing,
      handoffRecordedClip,
    ]
  );

  const progress =
    isRecording && recordLimit > 0
      ? Math.min(1, elapsedSec / recordLimit)
      : 0;

  const permissionsPending =
    cameraPermission == null || micPermission == null;
  const permissionsGranted =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  const challengeTitle =
    typeof respondParams.target === 'string' && respondParams.target.trim()
      ? respondParams.target.trim()
      : typeof (respondParams.reel as { statSticker?: string } | undefined)?.statSticker ===
          'string'
        ? String(
            (respondParams.reel as { statSticker?: string }).statSticker
          ).trim()
        : null;
  const modeLabel = isOpenerCapture
    ? challengeTitle
      ? `OPENER · ${challengeTitle}`.slice(0, 36)
      : 'RECORD OPENER'
    : isChallengeResponse
      ? challengeTitle
        ? `RESPOND · ${challengeTitle}`.slice(0, 36)
        : 'RESPOND'
      : HUB_MODES.find((m) => m.id === mode)?.title || '⚡ SPARKS';

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
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <PinchGestureHandler
        enabled={mode !== 'BATTLE_BAWAAL'}
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchHandlerStateChange}
        minPointers={2}
        avgTouches
      >
        <View style={styles.cameraGestureHost} collapsable={false}>
          <CameraView
            key={`bawaal-cam-${cameraSessionKey}`}
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode="video"
            mute={false}
            videoQuality="720p"
            zoom={zoom}
            enableTorch={false}
            onCameraReady={() => {
              setIsCameraReady(true);
              setCameraError('');
            }}
            onMountError={(err) => {
              recordingLockRef.current = false;
              setIsRecording(false);
              setIsCameraReady(false);
              setCameraError(err?.message || 'Could not start camera.');
            }}
          />

          {/* Single-tap only when idle — never blocks two-finger pinch while recording */}
          <Pressable
            style={styles.viewfinderTap}
            onPress={revealTimePill}
            disabled={isRecording || mode === 'BATTLE_BAWAAL'}
            pointerEvents={
              isRecording || mode === 'BATTLE_BAWAAL' ? 'none' : 'auto'
            }
          />
        </View>
      </PinchGestureHandler>

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
                : isFinalizingClip || isProcessing
                  ? '⏳ SAVING…'
                  : isRecording
                    ? `🔴 ${formatClock(elapsedSec)} / ${formatClock(recordLimit)}`
                    : modeLabel}
            </Text>
          </View>

          <View style={styles.topRightControls}>
            <TouchableOpacity
              onPress={flipCamera}
              style={styles.flipPill}
              disabled={isRecording}
              accessibilityLabel="Flip camera"
            >
              <Text style={styles.flipPillText}>FLIP</Text>
            </TouchableOpacity>
          </View>
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
        onPickGallery={openDeviceGallery}
        galleryDisabled={isRecording || mode === 'BATTLE_BAWAAL'}
        joshUnlocked3m={joshUnlocked3m}
        onToggleJosh3m={() => setJoshUnlocked3m((v) => !v)}
      />

      <DeviceGalleryModal
        visible={showDeviceGallery}
        onClose={() => setShowDeviceGallery(false)}
        onPickVideo={(asset) => {
          void importGalleryAsset(asset);
        }}
      />

      {/* Saving / HW-release gate — keeps CameraView mounted, blocks double shutter */}
      {isFinalizingClip || isProcessing ? (
        <View style={styles.finalizingOverlay} pointerEvents="auto">
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.finalizingText}>Saving clip…</Text>
        </View>
      ) : null}

      {/* Mount preview only after handoff commits URI + teardown delay (no mid-flush decode) */}
      {showPreview && recordedVideoUri && !isFinalizingClip && !isProcessing ? (
        <ClipPreviewModal
          key={recordedVideoUri}
          visible
          uri={recordedVideoUri}
          fallbackDuration={recordLimit}
          onRetake={returnToLiveCamera}
          onNext={({
            slowMoEnabled: sm,
            slowMoRate: rate,
            slowMoStartSec: s,
            slowMoEndSec: e,
          }) => {
            const clipDur = safeDurationSec(
              e,
              safeDurationSec(recordLimit, 15)
            );
            const start = Math.max(0, Number(s) || 0);
            setSlowMoEnabled(!!sm);
            setSlowMoRate(clampSlowMoRate(rate));
            setSlowMoStartSec(
              Number.isFinite(start) ? Math.min(start, clipDur - 0.5) : 0
            );
            setSlowMoEndSec(clipDur);
            // Record Opener for Create Arena Challenge — skip post sheet, return clip
            if (isOpenerCapture && recordedVideoUri) {
              const draft =
                (respondParams.createChallengeDraft as Record<string, unknown>) ||
                {};
              setShowPreview(false);
              releaseCameraRecorder();
              requestAnimationFrame(() => {
                safeNavigateHome({
                  tab: 'Arena',
                  reopenCreateChallenge: true,
                  openerClipUri: recordedVideoUri,
                  createChallengeDraft: {
                    ...draft,
                    openerUri: recordedVideoUri,
                  },
                });
              });
              return;
            }
            // Keep recordedVideoUri — only dismiss preview, open post sheet
            setShowPreview(false);
            setTimeout(() => setShowPostSheet(true), 60);
          }}
        />
      ) : null}

      <Modal
        visible={showPostSheet}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPostSheet(false);
          setShowPreview(false);
        }}
      >
        <CreationPostSheet
          mode={mode}
          videoUri={recordedVideoUri}
          galleryAssetId={galleryAssetId}
          slowMoEnabled={slowMoEnabled}
          slowMoRate={clampSlowMoRate(slowMoRate)}
          slowMoStartSec={Math.max(0, Number(slowMoStartSec) || 0)}
          slowMoEndSec={safeDurationSec(slowMoEndSec, recordLimit)}
          durationSec={safeDurationSec(recordLimit, 15)}
          onClose={() => {
            setShowPreview(false);
            setShowPostSheet(false);
          }}
          onGalleryAssetDeleted={() => setGalleryAssetId(null)}
          onStopMedia={() => {
            // Kill preview + release any lingering recorder before/during upload
            setShowPreview(false);
            releaseCameraRecorder();
          }}
          onSuccess={(payload) => {
            if (payload) onPublished?.(payload);
            const battleId =
              (typeof respondParams.battleId === 'string' && respondParams.battleId) ||
              (typeof respondParams.challengeId === 'string' &&
                respondParams.challengeId) ||
              null;
            const respondSport =
              (typeof respondParams.sport === 'string' && respondParams.sport) ||
              (respondParams.reel as { category?: string } | undefined)?.category ||
              'GYM';
            const respondHandle =
              typeof respondParams.handle === 'string'
                ? respondParams.handle.replace(/^@/, '')
                : 'Challenger';
            // Arena RESPOND always returns to Arena (not Battles legacy path)
            const tab = isChallengeResponse
              ? 'Arena'
              : payload?.feedTarget === 'BATTLES'
                ? 'Battles'
                : 'Arena';
            const safePost = payload?.newPost || {
              id: `fallback-${Date.now()}`,
              mode,
              videoUri: recordedVideoUri,
              title: challengeTitle || 'BAWAAL Drop',
              timestamp: Date.now(),
              feedTarget: tab === 'Battles' ? 'BATTLES' : 'ARENA',
            };
            // Unmount preview + release decoder BEFORE feed mounts the same URI
            setShowPreview(false);
            setShowPostSheet(false);
            releaseCameraRecorder();
            resetCreationSession({ remountCamera: false });
            const freshPost = {
              ...safePost,
              ...(isChallengeResponse
                ? {
                    type: 'battle_thread',
                    isBattleResponse: true,
                    isBattle: true,
                    battleId: battleId || safePost.id,
                    challengeId: battleId || safePost.id,
                    target: challengeTitle || safePost.title || 'Battle response',
                    opponent: `@${respondHandle}`,
                    challengeOf: respondHandle,
                    sport: respondSport,
                    category: respondSport,
                    creator: 'You',
                    author: '@you',
                    videoUri:
                      safePost.videoUri ||
                      safePost.uri ||
                      recordedVideoUri ||
                      null,
                    uri:
                      safePost.uri ||
                      safePost.videoUri ||
                      recordedVideoUri ||
                      null,
                    localVideoUri: safePost.localVideoUri || null,
                    feedTarget: 'ARENA',
                  }
                : {}),
              // Force newest-first so Arena never flashes an older clip on top
              createdAt: Date.now(),
              timestamp: Date.now(),
              _freshPublish: true,
            };
            // Defer navigation one tick so Video unload can finish
            requestAnimationFrame(() => {
              safeNavigateHome({
                tab,
                ...(tab === 'Arena' ? { newArenaPost: freshPost } : {}),
                ...(tab === 'Battles' ? { newBattlePost: freshPost } : {}),
              });
            });
          }}
        />
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  absoluteFill: { ...ABSOLUTE_FILL },
  cameraGestureHost: {
    ...ABSOLUTE_FILL,
  },
  camera: { ...ABSOLUTE_FILL },
  viewfinderTap: {
    ...ABSOLUTE_FILL,
    top: 100,
    bottom: 210,
  },
  overlayRoot: { justifyContent: 'space-between' },
  finalizingOverlay: {
    ...ABSOLUTE_FILL,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
    gap: 14,
  },
  finalizingText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
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
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flipPill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  torchPillOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  torchPillTextOn: {
    color: '#000000',
  },
  controlDisabled: {
    opacity: 0.35,
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
  shutterWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
