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
  Platform,
  ScrollView,
} from 'react-native';
import {
  abortWebClipRecording,
  isWebMediaRecorderAvailable,
  startWebClipRecording,
  stopWebClipRecording,
} from './src/utils/webMediaRecorder';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { Video as ExpoAvVideo, ResizeMode } from 'expo-av';
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
import {
  coalesceRecordingUri,
  ensurePlayableRecordingUri,
  resolveSafeRecordingFallbackUri,
  settleStopRecording,
  STOP_SAVE_TIMEOUT_MS,
} from './src/utils/safeRecordingFallback';
import VideoPublishModal from './components/VideoPublishModal';
import {
  PostDestinationSelector,
  type ArenaTier,
} from './src/components/PostDestinationSelector';
import { getActiveUser } from './src/services/activeUserProfile';
import {
  fetchIsProUser,
  publishToDestination,
} from './src/services/destinationPublishService';
import { addNewPostToArenaFeed } from './arenaFeedStore';
import { showBawaalAlert } from './src/components/BawaalAlert';
export type { CreationMode, PostCreationPayload };

/** Live lens chrome stays high-contrast white; hub / sheets use brand orange. */
const ACCENT = '#FFFFFF';
const BRAND_ORANGE = '#FF5500';
const SHUTTER_RED = '#FF3B30';
const SHEET_BG = '#000000';
const TIME_OPTIONS = [5, 15, 30, 60] as const;

/** Live 1v1 setup — leaves the lens for challenge / live form. */
function isLiveHubMode(mode: CreationMode): boolean {
  return mode === 'WAR_CRY' || mode === 'BATTLE_BAWAAL';
}
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
  /** SPARKS / JOSH / challenge — parent opens VideoPublishModal with this URI. */
  onVideoRecorded?: (videoUri: string) => void;
  /** Parent VideoPublishModal is open — block goBack / safeNavigateHome until Success/Cancel. */
  publishHold?: boolean;
};

type HubMode = {
  id: CreationMode;
  title: string;
  tag: string;
  subtitle: string;
};

const HUB_MODES: HubMode[] = [
  {
    id: 'SPARKS',
    title: 'SPARKS',
    tag: 'Stories',
    subtitle: '30s max · Story heat that vanishes in 24h',
  },
  {
    id: 'JOSH',
    title: 'JOSH',
    tag: 'Reels',
    subtitle: '60s default · Unlock up to 3 min (180s) with coins',
  },
  {
    id: 'BAWAAL_BATTLE',
    title: 'BAWAAL BATTLE',
    tag: 'Group Challenge',
    subtitle: 'Group challenge mode for multiple participants',
  },
  {
    id: 'DARK_ARENA',
    title: 'DARK ARENA',
    tag: 'Open Challenge',
    subtitle: 'Anyone can post a challenge, anyone can participate',
  },
  {
    id: 'FACEOFF',
    title: 'FACEOFF',
    tag: 'Response Challenge',
    subtitle:
      'Athlete records a challenge; other athletes or challengers can answer',
  },
  {
    id: 'WAR_CRY',
    title: 'WAR CRY',
    tag: '1v1 Live Challenge',
    subtitle: '1v1 real-time live challenge mode',
  },
];

function modeCeiling(mode: CreationMode, joshUnlocked3m: boolean): number {
  switch (mode) {
    case 'SPARKS':
      return 30;
    case 'JOSH':
      return joshUnlocked3m ? 180 : 60;
    case 'BAWAAL_BATTLE':
    case 'BATTLE_REWIND':
    case 'DARK_ARENA':
    case 'FACEOFF':
      return 60;
    case 'WAR_CRY':
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
    case 'BAWAAL_BATTLE':
    case 'BATTLE_REWIND':
    case 'DARK_ARENA':
    case 'FACEOFF':
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

function hubModeTitle(mode: CreationMode): string {
  const hit = HUB_MODES.find((m) => m.id === mode);
  if (hit) return hit.title;
  if (mode === 'BATTLE_REWIND') return 'BAWAAL BATTLE';
  if (mode === 'BATTLE_BAWAAL') return 'WAR CRY';
  return 'SPARKS';
}

/** HUD rule chip: mode contract + selected duration for the active Hub mode. */
function hubModeRule(
  mode: CreationMode,
  selectedDuration: number,
  joshUnlocked3m: boolean
): string {
  if (isLiveHubMode(mode)) return 'LIVE 1v1';
  const secs = Math.max(1, Math.floor(selectedDuration || defaultDuration(mode)));
  switch (mode) {
    case 'SPARKS':
      return secs >= 30 ? '30s max' : `${secs}s · 30s max`;
    case 'JOSH':
      if (joshUnlocked3m) {
        return secs === 60
          ? '60s default · max 3m'
          : `${secs}s · 60s default · max 3m`;
      }
      return secs === 60 ? '60s default' : `${secs}s · 60s default`;
    case 'BAWAAL_BATTLE':
    case 'BATTLE_REWIND':
      return `${secs}s · group`;
    case 'DARK_ARENA':
      return `${secs}s · open`;
    case 'FACEOFF':
      return `${secs}s · respond`;
    default:
      return `${secs}s`;
  }
}

type HubHandoff = {
  mode: CreationMode;
  title: string;
  rule: string;
};

function buildHubHandoff(
  mode: CreationMode,
  selectedDuration: number,
  joshUnlocked3m: boolean
): HubHandoff {
  return {
    mode,
    title: hubModeTitle(mode),
    rule: hubModeRule(mode, selectedDuration, joshUnlocked3m),
  };
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
          source={require('./assets/BAWAAL_white_full.png')}
          style={hubStyles.logo}
          resizeMode="contain"
        />
        <Text style={hubStyles.title}>BAWAAL HUB</Text>
        <Text style={hubStyles.sub}>Pick your creation mode — tap to arm the lens</Text>

        <ScrollView
          style={hubStyles.modeScroll}
          contentContainerStyle={hubStyles.modeScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={hubStyles.cardGrid}>
            {HUB_MODES.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={hubStyles.card}
                activeOpacity={0.88}
                onPress={() => onSelect(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`${m.title} — ${m.tag}`}
              >
                <View style={hubStyles.cardHeader}>
                  <Text style={hubStyles.cardTitle}>{m.title}</Text>
                  <Text style={hubStyles.cardTag}>{m.tag}</Text>
                </View>
                <Text style={hubStyles.cardSub}>{m.subtitle}</Text>
                {m.id === 'JOSH' ? (
                  <TouchableOpacity
                    style={hubStyles.joshChip}
                    onPress={onToggleJosh3m}
                  >
                    <Text style={hubStyles.joshChipText}>
                      {joshUnlocked3m
                        ? '3 MIN UNLOCKED'
                        : 'Unlock 3 min (10 coins)'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

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
              setTimeout(() => onPickGallery(), 220);
            }}
            accessibilityLabel="Pick video from gallery"
          >
            <Text style={hubStyles.cardTitle}>GALLERY</Text>
            <Text style={hubStyles.cardSub}>
              Select clips with checkboxes — delete or use for a post
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const hubStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  sheet: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 2,
    borderColor: BRAND_ORANGE,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND_ORANGE,
    marginBottom: 10,
  },
  logo: { width: 130, height: 44, alignSelf: 'center', marginBottom: 4 },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  modeScroll: {
    flexGrow: 0,
  },
  modeScrollContent: {
    paddingBottom: 8,
  },
  cardGrid: {
    gap: 10,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BRAND_ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  cardTag: {
    color: BRAND_ORANGE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  joshChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(255, 85, 0, 0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  joshChipText: { color: BRAND_ORANGE, fontSize: 11, fontWeight: '800' },
  galleryCard: {
    borderStyle: 'dashed' as const,
    marginTop: 10,
    borderColor: 'rgba(255, 85, 0, 0.55)',
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
  const videoRef = useRef<ExpoAvVideo>(null);
  const slowMoEnabled = slowMoRate > 0;

  useEffect(() => {
    startSecRef.current = startSec;
    endSecRef.current = endSec;
  }, [startSec, endSec]);

  useEffect(() => {
    rateRef.current = slowMoRate > 0 ? slowMoRate : 1;
  }, [slowMoRate]);

  const releasePreview = useCallback(() => {
    const node = videoRef.current;
    if (!node) return;
    node.pauseAsync?.().catch(() => {});
    node.unloadAsync?.().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      releasePreview();
    };
  }, [releasePreview]);

  const onPlaybackStatusUpdate = useCallback(
    (status: { isLoaded?: boolean; durationMillis?: number; positionMillis?: number }) => {
      if (!status?.isLoaded) return;
      const durMs = Number(status.durationMillis);
      if (Number.isFinite(durMs) && durMs > 200) {
        const safeDur = safeDurationSec(durMs / 1000, bootDur);
        setDuration((prev) => (Math.abs(prev - safeDur) > 0.05 ? safeDur : prev));
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
      }
      const t = (Number(status.positionMillis) || 0) / 1000;
      setPlayheadSec(t);
      const inSlow = t >= startSecRef.current && t <= endSecRef.current;
      const nextRate = inSlow ? rateRef.current : 1;
      if (Math.abs(nextRate - lastRateRef.current) > 0.01) {
        lastRateRef.current = nextRate;
        videoRef.current
          ?.setStatusAsync?.({ rate: nextRate, shouldCorrectPitch: true })
          .catch(() => {});
      }
    },
    [bootDur]
  );

  const handleRetake = useCallback(() => {
    setPlaying(false);
    releasePreview();
    onRetake();
  }, [onRetake, releasePreview]);

  const handleNextToPost = useCallback(() => {
    setPlaying(false);
    releasePreview();
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
  }, [onNext, releasePreview, slowMoRate, startSec, endSec, duration, bootDur]);

  if (!visible || !uri) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onRetake}>
      <View style={previewStyles.root}>
        <StatusBar barStyle="light-content" />
        <Text style={previewStyles.title}>Slow-Mo Preview</Text>

        <View style={previewStyles.videoWrap}>
          <ExpoAvVideo
            ref={videoRef}
            source={{ uri }}
            style={previewStyles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={playing}
            isLooping
            isMuted={false}
            useNativeControls={false}
            progressUpdateIntervalMillis={80}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
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
            videoRef.current?.setPositionAsync(Math.round(sec * 1000)).catch(() => {});
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
  onVideoRecorded,
  publishHold = false,
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
    (isChallengeResponse ? 'FACEOFF' : undefined) ||
    'SPARKS';
  // Never boot camera into War Cry / live setup — that route is the challenge form
  const bootMode: CreationMode = isLiveHubMode(rawBootMode)
    ? 'SPARKS'
    : rawBootMode === 'BATTLE_REWIND'
      ? 'BAWAAL_BATTLE'
      : rawBootMode;

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
  /**
   * Explicit Hub → camera handoff. Once set (tap in BAWAAL Hub), HUD uses this
   * mode/title/rule and never falls back to opener/respond route titles.
   */
  const [hubHandoff, setHubHandoff] = useState<HubHandoff | null>(() =>
    isOpenerCapture || isChallengeResponse
      ? null
      : buildHubHandoff(bootMode, defaultDuration(bootMode), false)
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
  /** Opens VideoPublishModal after a successful capture (until Success/Cancel). */
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  /** Destination picker after ClipPreview “NEXT TO POST”. */
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);
  const [isProUser, setIsProUser] = useState(false);
  const [destinationPublishing, setDestinationPublishing] = useState(false);
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
  /** Prevents double preview when stop timeout bypass races late recordAsync. */
  const recordingHandoffDoneRef = useRef(false);
  /** Staged URI — set before React state so we never mount preview on a mid-flush path. */
  const pendingPreviewUriRef = useRef<string | null>(null);
  const pinchBaseZoomRef = useRef(0);
  const zoomRef = useRef(0);
  /** Bumped after each publish/close so CameraView remounts a clean native recorder. */
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidePillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);
  /** Sync ref so success/cancel can navigate after setIsPublishModalOpen(false). */
  const isPublishModalOpenRef = useRef(false);

  const ceiling = useMemo(
    () => modeCeiling(mode, joshUnlocked3m),
    [mode, joshUnlocked3m]
  );

  const availableTimes = useMemo((): number[] => {
    if (isLiveHubMode(mode)) return [];
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
    if (isLiveHubMode(mode) || isRecording) return;
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
    if (isLiveHubMode(rawBootMode)) {
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
      if (isLiveHubMode(mode)) return;
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
      if (Platform.OS === 'web') {
        abortWebClipRecording();
      } else {
        cam?.stopRecording?.();
      }
    } catch {
      /* ignore — may not be recording */
    }
    setIsRecording(false);
    setIsFinalizingClip(false);
    setIsProcessing(false);
    clearElapsedTimer();
  }, [clearElapsedTimer]);

  /** Open destination picker after preview Next (camera stays mounted). */
  const openDestinationSelector = useCallback(
    (uri: string) => {
      if (!uri || isOpenerCapture) return;
      console.log('[UniversalCamera] Recorded video URI:', uri);
      setRecordedVideoUri(uri);
      pendingPreviewUriRef.current = uri;
      setShowPostSheet(false);
      setShowPreview(false);
      setIsPublishModalOpen(false);
      isPublishModalOpenRef.current = false;
      setShowDestinationSelector(true);
      setIsFinalizingClip(false);
      setIsProcessing(false);
      try {
        onVideoRecorded?.(uri);
      } catch (err) {
        console.warn(
          '[UniversalCamera] onVideoRecorded failed:',
          (err as Error)?.message || err
        );
      }
      void fetchIsProUser()
        .then((pro) => setIsProUser(!!pro))
        .catch(() => setIsProUser(false));
    },
    [isOpenerCapture, onVideoRecorded]
  );

  /** Legacy publish modal host — prefer destination selector for new drops. */
  const openPublishModal = useCallback(
    (uri: string) => {
      openDestinationSelector(uri);
    },
    [openDestinationSelector]
  );

  /**
   * Post-record handoff: persist URI, keep CameraView mounted, open publish
   * (or opener ClipPreview). Never navigate / null URI here.
   */
  const handoffRecordedClip = useCallback(
    async (uri: string, opts?: { openPreview?: boolean }) => {
      const openPreview = opts?.openPreview !== false;
      pendingPreviewUriRef.current = uri;
      setRecordedVideoUri(uri);
      setIsProcessing(true);
      setIsFinalizingClip(true);
      setIsRecording(false);
      recordingLockRef.current = false;
      stoppingRef.current = false;
      setShowPostSheet(false);
      clearElapsedTimer();

      // Brief HW release — do NOT unmount CameraView
      await waitMs(RECORDING_TEARDOWN_MS);

      if (pendingPreviewUriRef.current !== uri) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }

      // ClipPreview first — Next opens PostDestinationSelector (opener returns draft)
      if (openPreview) {
        setShowDestinationSelector(false);
        setShowPreview(true);
      } else if (!isOpenerCapture) {
        openDestinationSelector(uri);
      } else {
        setShowPreview(false);
        setShowPostSheet(true);
      }
      setIsFinalizingClip(false);
      setIsProcessing(false);
    },
    [clearElapsedTimer, isOpenerCapture, openDestinationSelector]
  );

  // Camera / recorder lifecycle — stop recording + clear timers / player refs on unmount
  useEffect(() => {
    return () => {
      recordingLockRef.current = false;
      stoppingRef.current = false;
      pendingPreviewUriRef.current = null;
      recordAsyncWaitRef.current = null;
      try {
        if (Platform.OS === 'web') {
          abortWebClipRecording();
        } else {
          cameraRef.current?.stopRecording?.();
        }
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
      // Never wipe a frozen capture while publish/preview hold is active
      if (
        opts?.remountCamera !== true &&
        (publishHold ||
          isPublishModalOpen ||
          showDestinationSelector ||
          pendingPreviewUriRef.current)
      ) {
        // Soft unlock recorder flags only — keep recordedVideoUri mounted
        recordingLockRef.current = false;
        stoppingRef.current = false;
        setIsRecording(false);
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }
      // 1) Unbind native recorder first
      releaseCameraRecorder();
      // 2) Clear all JS session / trimmer / rate state to defaults
      pendingPreviewUriRef.current = null;
      recordAsyncWaitRef.current = null;
      recordingHandoffDoneRef.current = false;
      setShowPreview(false);
      setShowPostSheet(false);
      setShowDestinationSelector(false);
      setDestinationPublishing(false);
      isPublishModalOpenRef.current = false;
      setIsPublishModalOpen(false);
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
      publishHold,
      isPublishModalOpen,
      showDestinationSelector,
    ]
  );

  /**
   * Retake → drop clip/preview and return to the SAME live CameraView session.
   * Must not remount <CameraView/> or flip isCameraReady (Android black viewfinder).
   */
  const returnToLiveCamera = useCallback(() => {
    // Block remount while parent VideoPublishModal holds the frozen clip
    if (
      publishHold ||
      isPublishModalOpenRef.current ||
      isPublishModalOpen ||
      showDestinationSelector
    ) {
      return;
    }
    pendingPreviewUriRef.current = null;
    setShowPreview(false);
    setShowPostSheet(false);
    setShowDestinationSelector(false);
    isPublishModalOpenRef.current = false;
    setIsPublishModalOpen(false);
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
  }, [
    selectedDuration,
    recordLimit,
    revealTimePill,
    publishHold,
    isPublishModalOpen,
    showDestinationSelector,
  ]);

  const safeNavigateHome = useCallback(
    (params: Record<string, unknown>, opts?: { force?: boolean }) => {
      // Parent VideoPublishModal owns leave timing — never pop underneath it
      // `force` is used after Success/Cancel already closed the modal.
      if (
        !opts?.force &&
        (publishHold ||
          isPublishModalOpenRef.current ||
          showDestinationSelector ||
          navigatingRef.current)
      ) {
        return;
      }
      navigatingRef.current = true;
      // Drop preview / player first so unmount does not race native AV
      isPublishModalOpenRef.current = false;
      setIsPublishModalOpen(false);
      setShowPreview(false);
      setShowPostSheet(false);
      setShowDestinationSelector(false);
      setDestinationPublishing(false);
      setRecordedVideoUri(null);
      pendingPreviewUriRef.current = null;
      setIsFinalizingClip(false);
      setIsProcessing(false);
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
            else navigation?.navigate?.('Main', { tab: 'Arena' });
          } catch {
            /* ignore */
          }
        } finally {
          navigatingRef.current = false;
        }
      }, 300);
    },
    [navigation, resetCreationSession, publishHold, showDestinationSelector]
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
      // Capture mode name + rules immediately, then close Hub → camera HUD
      const nextDur = isLiveHubMode(next)
        ? 0
        : Math.min(
            defaultDuration(next),
            modeCeiling(next, joshUnlocked3m) || defaultDuration(next)
          ) || defaultDuration(next);
      const handoff = buildHubHandoff(next, nextDur || defaultDuration(next), joshUnlocked3m);
      setHubHandoff(handoff);
      setMode(next);
      if (!isLiveHubMode(next)) {
        setSelectedDuration(nextDur);
      }
      setHubOpen(false);
      // WAR CRY / legacy live — leave lens for live challenge setup
      if (isLiveHubMode(next)) {
        openBattleChallengeForm();
        return;
      }
      fadeTimePill(false);
      scheduleHidePill();
    },
    [joshUnlocked3m, fadeTimePill, scheduleHidePill, openBattleChallengeForm]
  );

  const handleTimeSelect = useCallback(
    (sec: number) => {
      if (isRecording) return;
      setSelectedDuration(sec);
      setHubHandoff((prev) => {
        const activeMode = prev?.mode || mode;
        return buildHubHandoff(activeMode, sec, joshUnlocked3m);
      });
      fadeTimePill(false);
      scheduleHidePill();
    },
    [isRecording, fadeTimePill, scheduleHidePill, mode, joshUnlocked3m]
  );

  const startRecording = useCallback(async () => {
    if (isLiveHubMode(mode)) {
      openBattleChallengeForm();
      return;
    }
    if (
      !isCameraReady ||
      isRecording ||
      publishHold ||
      isPublishModalOpen ||
      showDestinationSelector ||
      showPreview ||
      showPostSheet ||
      !!recordedVideoUri ||
      isFinalizingClip ||
      isProcessing ||
      destinationPublishing ||
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
    recordingHandoffDoneRef.current = false;
    setIsFinalizingClip(false);
    setIsProcessing(false);
    setIsRecording(true);
    fadeTimePill(true);
    startElapsedTimer();

    const useWebRecorder =
      Platform.OS === 'web' && isWebMediaRecorderAvailable();

    // Web: expo-camera record() is a no-op (`uri: ''`) — use MediaRecorder on the live stream.
    // Native: expo-camera recordAsync until stop or maxDuration.
    if (useWebRecorder) {
      // CameraView may attach srcObject a tick after onCameraReady
      await waitMs(50);
    }
    const recordPromise = useWebRecorder
      ? startWebClipRecording({ maxDurationSec: recordLimit })
      : cam.recordAsync({
          maxDuration: recordLimit,
        });
    // Swallow late Invariant rejections after stop already opened preview
    recordAsyncWaitRef.current = Promise.resolve(recordPromise).catch((err) => {
      console.warn(
        '[UniversalCamera] recordAsync late reject:',
        (err as Error)?.message || err
      );
      return null;
    });

    try {
      const video = (await recordPromise) as { uri?: string } | null;
      // Stop path already opened preview — never re-arm Saving clip…
      if (recordingHandoffDoneRef.current) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        setIsRecording(false);
        recordingLockRef.current = false;
        stoppingRef.current = false;
        return;
      }

      // Video object resolved — keep CameraView mounted; do not remount/release yet
      // Gate UI before compress/save — still no preview mount yet
      setIsProcessing(true);
      setIsFinalizingClip(true);
      setIsRecording(false);
      clearElapsedTimer();

      // Null / empty / codec fail → sample clip so preview never blacks out
      const { uri: playableUri, usedFallback } = await ensurePlayableRecordingUri(
        typeof video?.uri === 'string' ? video.uri : null,
        {
          persist: async (u) => {
            if (
              !u ||
              String(u).startsWith('emulator-mock://') ||
              /^https?:\/\//i.test(String(u)) ||
              /^blob:/i.test(String(u))
            ) {
              return u;
            }
            try {
              return (
                (await lockLocalRecording(u)) ||
                (await stabilizeLocalVideoUri(u)) ||
                u
              );
            } catch (stabErr) {
              console.warn(
                '[UniversalCamera] lock/stabilize failed:',
                (stabErr as Error)?.message || stabErr
              );
              return u;
            }
          },
        }
      );
      if (recordingHandoffDoneRef.current) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }
      if (usedFallback) {
        console.warn(
          '[UniversalCamera] missing/invalid record URI — sample fallback'
        );
      }
      const stableUri = playableUri || resolveSafeRecordingFallbackUri();
      setCameraError('');
      recordingHandoffDoneRef.current = true;

      // Instagram-style: auto-save to Camera Roll (skip mock / sample-only)
      if (!usedFallback && !String(stableUri).startsWith('emulator-mock://')) {
        void saveVideoToGallery(stableUri).then((res) => {
          if (res.ok && res.assetId) setGalleryAssetId(res.assetId);
        });
      }

      const clipDur = safeDurationSec(recordLimit, 15);
      setSlowMoEnabled(false);
      setSlowMoRate(0.5);
      setSlowMoStartSec(0);
      setSlowMoEndSec(clipDur);

      // Staged handoff — URI → delay → preview (never sync-unmount camera mid-flush)
      // Always land on ClipPreview so “NEXT TO POST” opens PostDestinationSelector
      await handoffRecordedClip(stableUri, { openPreview: true });
    } catch (e) {
      if (recordingHandoffDoneRef.current) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }
      console.warn(
        '[UniversalCamera] Recording error — sample preview:',
        (e as Error)?.message || e
      );
      recordAsyncWaitRef.current = null;
      stoppingRef.current = false;
      setIsRecording(false);
      recordingLockRef.current = false;
      clearElapsedTimer();
      setCameraError('');
      recordingHandoffDoneRef.current = true;
      const fallback = coalesceRecordingUri(null).uri;
      await handoffRecordedClip(fallback, { openPreview: true });
    } finally {
      recordAsyncWaitRef.current = null;
    }
  }, [
    mode,
    isCameraReady,
    isRecording,
    publishHold,
    isPublishModalOpen,
    showDestinationSelector,
    showPreview,
    showPostSheet,
    recordedVideoUri,
    isFinalizingClip,
    isProcessing,
    destinationPublishing,
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
   * Stop capture → persist URI → open VideoPublishModal.
   * CameraView stays mounted; looping Video overlay covers the lens.
   */
  const stopRecording = useCallback(async () => {
    if ((!isRecording && !recordingLockRef.current) || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    setIsProcessing(true);
    setIsFinalizingClip(true);
    setIsRecording(false);
    clearElapsedTimer();
    // Do NOT unmount camera / resetCreationSession / navigate on stop

    const stopTimeoutMs =
      Platform.OS === 'web'
        ? Math.max(STOP_SAVE_TIMEOUT_MS, 4000)
        : STOP_SAVE_TIMEOUT_MS;

    const savingWatchdog = setTimeout(() => {
      setIsFinalizingClip(false);
      setIsProcessing(false);
      const staged = pendingPreviewUriRef.current;
      if (staged && !recordingHandoffDoneRef.current) {
        recordingHandoffDoneRef.current = true;
        void handoffRecordedClip(staged, { openPreview: true });
      }
    }, Math.max(500, stopTimeoutMs));

    try {
      const settled = await settleStopRecording({
        // Web MediaRecorder onstop needs a few seconds after stop click
        timeoutMs: stopTimeoutMs,
        recordPromise: recordAsyncWaitRef.current as
          | Promise<{ uri?: string } | null>
          | null
          | undefined,
        stopRecording: () => {
          if (Platform.OS === 'web') {
            stopWebClipRecording();
            return;
          }
          cameraRef.current?.stopRecording?.();
        },
      });

      if (recordingHandoffDoneRef.current) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }

      const recordedUri =
        settled.uri || resolveSafeRecordingFallbackUri();
      console.log('[UniversalCamera] Recorded video URI:', recordedUri);

      if (settled.usedFallback || settled.timedOut) {
        console.warn(
          '[UniversalCamera] stop/save bypass — preview with settled URI:',
          settled.error || 'fallback'
        );
      }

      recordingHandoffDoneRef.current = true;
      recordingLockRef.current = false;
      stoppingRef.current = false;
      recordAsyncWaitRef.current = null;
      setCameraError('');
      await handoffRecordedClip(recordedUri, { openPreview: true });
    } catch (err) {
      if (recordingHandoffDoneRef.current) {
        setIsFinalizingClip(false);
        setIsProcessing(false);
        return;
      }
      console.warn(
        '[UniversalCamera] stopRecording crash — sample preview:',
        (err as Error)?.message || err
      );
      recordingHandoffDoneRef.current = true;
      recordingLockRef.current = false;
      stoppingRef.current = false;
      recordAsyncWaitRef.current = null;
      setCameraError('');
      const fallbackUri = resolveSafeRecordingFallbackUri();
      await handoffRecordedClip(fallbackUri, { openPreview: true });
    } finally {
      clearTimeout(savingWatchdog);
      setIsFinalizingClip(false);
      setIsProcessing(false);
    }
  }, [
    isRecording,
    clearElapsedTimer,
    handoffRecordedClip,
  ]);

  const handleShutter = useCallback(() => {
    if (isLiveHubMode(mode)) {
      openBattleChallengeForm();
      return;
    }
    // Frozen / publishing — never start a new take under the modal
    if (
      publishHold ||
      isPublishModalOpen ||
      showDestinationSelector ||
      showPreview ||
      showPostSheet ||
      !!recordedVideoUri ||
      isFinalizingClip ||
      isProcessing ||
      destinationPublishing
    ) {
      return;
    }
    if (isRecording) void stopRecording();
    else void startRecording();
  }, [
    mode,
    isRecording,
    publishHold,
    isPublishModalOpen,
    showDestinationSelector,
    showPreview,
    showPostSheet,
    recordedVideoUri,
    isFinalizingClip,
    isProcessing,
    destinationPublishing,
    openBattleChallengeForm,
    stopRecording,
    startRecording,
  ]);

  const handleClose = useCallback(() => {
    // Stay on camera while VideoPublishModal / destination picker is up
    if (publishHold || isPublishModalOpen || showDestinationSelector) return;
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
  }, [
    isRecording,
    navigation,
    publishHold,
    isPublishModalOpen,
    showDestinationSelector,
    resetCreationSession,
    stopRecording,
  ]);

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
      isLiveHubMode(mode)
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

      await handoffRecordedClip(uri, { openPreview: true });
    },
    [
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
      : hubModeTitle(mode);

  /** Single top broadcast pill: `[MODE] • [DETAILS]` — idle rules or live clock. */
  const broadcastHudText = useMemo(() => {
    const activeMode = hubHandoff?.mode ?? mode;
    const title = hubHandoff
      ? hubModeTitle(hubHandoff.mode)
      : isOpenerCapture || isChallengeResponse
        ? modeLabel
        : hubModeTitle(mode);

    if (isFinalizingClip || isProcessing) {
      return `${title} • SAVING…`;
    }
    if (isRecording) {
      return `${title} • ${formatClock(elapsedSec)} / ${formatClock(recordLimit)}`;
    }
    if (hubHandoff) {
      return `${hubModeTitle(activeMode)} • ${hubModeRule(activeMode, selectedDuration, joshUnlocked3m)}`;
    }
    if (isOpenerCapture || isChallengeResponse) {
      return `${modeLabel} • ${Math.max(1, Math.floor(recordLimit))}s`;
    }
    return `${hubModeTitle(mode)} • ${hubModeRule(mode, selectedDuration, joshUnlocked3m)}`;
  }, [
    hubHandoff,
    isOpenerCapture,
    isChallengeResponse,
    modeLabel,
    mode,
    selectedDuration,
    joshUnlocked3m,
    recordLimit,
    isFinalizingClip,
    isProcessing,
    isRecording,
    elapsedSec,
  ]);

  const handlePublishModalCancel = useCallback(() => {
    // Cancel — fully clear modal/camera hold then leave (no orphan black layers)
    isPublishModalOpenRef.current = false;
    setIsPublishModalOpen(false);
    setShowDestinationSelector(false);
    setDestinationPublishing(false);
    pendingPreviewUriRef.current = null;
    setShowPreview(false);
    setShowPostSheet(false);
    setRecordedVideoUri(null);
    recordingHandoffDoneRef.current = false;
    recordingLockRef.current = false;
    stoppingRef.current = false;
    setIsFinalizingClip(false);
    setIsProcessing(false);
    safeNavigateHome({ tab: 'Arena' }, { force: true });
  }, [safeNavigateHome]);

  const handleDestinationCancel = useCallback(() => {
    setShowDestinationSelector(false);
    setDestinationPublishing(false);
    // Return to slow-mo preview with the same clip
    if (recordedVideoUri) {
      setShowPreview(true);
      return;
    }
    handlePublishModalCancel();
  }, [recordedVideoUri, handlePublishModalCancel]);

  const handleDestinationPublish = useCallback(
    async (payload: { tier: ArenaTier; title: string; hashtag: string }) => {
      const uri = recordedVideoUri;
      if (!uri || destinationPublishing) return;

      const battleId =
        (typeof respondParams.battleId === 'string' && respondParams.battleId) ||
        (typeof respondParams.challengeId === 'string' &&
          respondParams.challengeId) ||
        null;

      setDestinationPublishing(true);
      try {
        const activeUser = getActiveUser?.() || {};
        const result = await publishToDestination({
          videoUri: uri,
          tier: payload.tier,
          title: payload.title,
          hashtag: payload.hashtag,
          isChallengeResponse,
          challengeId: battleId,
          userId: activeUser.userId || activeUser.id || null,
        });

        if (!result?.ok) {
          showBawaalAlert({
            title: 'PUBLISH FAILED',
            message:
              result?.error ||
              'Could not publish this clip. Your video is still on device.',
          });
          return;
        }

        const post = result.post || {
          id: `dest-${Date.now()}`,
          mode,
          title: payload.title,
          videoUri: result.publicUrl || uri,
          uri: result.publicUrl || uri,
          feedTarget: result.feedTarget || 'ARENA',
          timestamp: Date.now(),
          createdAt: Date.now(),
          _freshPublish: true,
        };

        if (result.feedTarget !== 'BATTLES' && result.publicUrl) {
          try {
            addNewPostToArenaFeed(post);
          } catch (err) {
            console.warn(
              '[UniversalCamera] destination Arena feed soft-fail:',
              (err as Error)?.message || err
            );
          }
        }

        try {
          onPublished?.(post as unknown as PostCreationPayload);
        } catch {
          /* ignore */
        }

        setShowDestinationSelector(false);
        setDestinationPublishing(false);
        isPublishModalOpenRef.current = false;
        setIsPublishModalOpen(false);
        setShowPreview(false);
        setShowPostSheet(false);
        pendingPreviewUriRef.current = null;
        setRecordedVideoUri(null);
        recordingHandoffDoneRef.current = false;
        recordingLockRef.current = false;
        stoppingRef.current = false;
        setIsFinalizingClip(false);
        setIsProcessing(false);

        const tab = result.feedTarget === 'BATTLES' ? 'Battles' : 'Arena';
        safeNavigateHome(
          {
            tab,
            ...(tab === 'Arena' ? { newArenaPost: post } : {}),
            ...(tab === 'Battles' ? { newBattlePost: post } : {}),
          },
          { force: true }
        );
      } catch (err) {
        console.warn(
          '[UniversalCamera] destination publish threw:',
          (err as Error)?.message || err
        );
        showBawaalAlert({
          title: 'PUBLISH FAILED',
          message:
            (err as Error)?.message ||
            'Network error while publishing. Try again.',
        });
      } finally {
        setDestinationPublishing(false);
      }
    },
    [
      recordedVideoUri,
      destinationPublishing,
      respondParams.battleId,
      respondParams.challengeId,
      isChallengeResponse,
      mode,
      onPublished,
      safeNavigateHome,
    ]
  );

  const handlePublishModalSuccess = useCallback(
    (data: Record<string, unknown> | null | undefined) => {
      const cloudUrl =
        (typeof data?.publicCloudUrl === 'string' && data.publicCloudUrl) ||
        (typeof data?.video_url === 'string' && data.video_url) ||
        (typeof data?.url === 'string' && data.url) ||
        (typeof data?.remoteVideoUri === 'string' && data.remoteVideoUri) ||
        null;
      const localUri =
        (typeof data?.localVideoUri === 'string' && data.localVideoUri) ||
        recordedVideoUri ||
        null;

      // Feed prepend ONLY after complete upload success (public HTTPS URL)
      if (!cloudUrl || !/^https:\/\//i.test(cloudUrl)) {
        showBawaalAlert({
          title: 'UPLOAD FAILED',
          message:
            'Cloud upload did not return a public URL. Your clip was not added to Arena.',
        });
        return;
      }

      const category =
        (typeof data?.category === 'string' && data.category) || 'COMBAT';
      const caption =
        (typeof data?.caption === 'string' && data.caption.trim()) ||
        challengeTitle ||
        'BAWAAL Drop';
      const post = {
        id: (typeof data?.id === 'string' && data.id) || `publish-${Date.now()}`,
        mode,
        videoUri: cloudUrl,
        uri: cloudUrl,
        video_url: cloudUrl,
        publicCloudUrl: cloudUrl,
        remoteVideoUri: cloudUrl,
        localVideoUri: localUri,
        title: caption,
        caption,
        athlete: '@you',
        author: '@you',
        category,
        sport: category,
        timestamp: Date.now(),
        createdAt: Date.now(),
        feedTarget: 'ARENA' as const,
        _freshPublish: true,
        cloudUploaded: true,
      };

      try {
        addNewPostToArenaFeed(post);
      } catch (err) {
        console.warn(
          '[UniversalCamera] addNewPostToArenaFeed failed:',
          (err as Error)?.message || err
        );
        showBawaalAlert({
          title: 'UPLOAD FAILED',
          message:
            (err as Error)?.message ||
            'Could not append the clip to Arena feed.',
        });
        return;
      }
      try {
        onPublished?.(post as unknown as PostCreationPayload);
      } catch {
        /* ignore */
      }
      // Close modal + clear capture hold BEFORE navigate (fixes black screen)
      isPublishModalOpenRef.current = false;
      setIsPublishModalOpen(false);
      setShowPreview(false);
      setShowPostSheet(false);
      pendingPreviewUriRef.current = null;
      setRecordedVideoUri(null);
      recordingHandoffDoneRef.current = false;
      recordingLockRef.current = false;
      stoppingRef.current = false;
      setIsFinalizingClip(false);
      setIsProcessing(false);
      safeNavigateHome(
        {
          tab: 'Arena',
          newArenaPost: post,
        },
        { force: true }
      );
    },
    [
      recordedVideoUri,
      mode,
      challengeTitle,
      onPublished,
      safeNavigateHome,
    ]
  );

  const activePublishUser = getActiveUser?.() || {};

  /** Block new takes while a clip / publish modal is held — do NOT unmount CameraView. */
  const captureHold =
    publishHold ||
    isPublishModalOpen ||
    showDestinationSelector ||
    showPreview ||
    showPostSheet ||
    !!recordedVideoUri ||
    isFinalizingClip ||
    isProcessing ||
    destinationPublishing;

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

      {/* Camera stays mounted after stop — prevents black flash under publish modal */}
      <PinchGestureHandler
        enabled={!isLiveHubMode(mode) && !captureHold}
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
            disabled={isRecording || captureHold || isLiveHubMode(mode)}
            pointerEvents={
              isRecording || captureHold || isLiveHubMode(mode)
                ? 'none'
                : 'auto'
            }
          />
        </View>
      </PinchGestureHandler>

      {/* Looping clip overlay while publish modal is up — covers live lens */}
      {recordedVideoUri ? (
        <View
          style={styles.capturedVideoOverlay}
          pointerEvents={isPublishModalOpen ? 'none' : 'box-none'}
        >
          <ExpoAvVideo
            source={{ uri: recordedVideoUri }}
            style={StyleSheet.absoluteFill}
            shouldPlay
            isLooping
            isMuted={!!isPublishModalOpen}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
          />
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.absoluteFill, styles.overlayRoot]}
      >
        {/* CANCEL · single broadcast HUD · FLIP — one centered pill only */}
        <View
          style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}
        >
          <View style={styles.topBarSide}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.glassPill}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.glassPillText}>✕ CANCEL</Text>
            </TouchableOpacity>
          </View>

          {!showPreview && !showPostSheet ? (
            <View style={styles.topBarCenter} pointerEvents="none">
              <View style={styles.modeHudPill}>
                <Text style={styles.modeHudText} numberOfLines={1}>
                  {broadcastHudText}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.topBarCenter} />
          )}

          <View style={[styles.topBarSide, styles.topBarSideEnd]}>
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
          {!isLiveHubMode(mode) && showTimePill && (
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
                isLiveHubMode(mode) && styles.shutterInnerLive,
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
        galleryDisabled={isRecording || isLiveHubMode(mode)}
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

      {/* Opener / explicit preview only — publish path uses looping Video overlay */}
      {showPreview &&
      recordedVideoUri &&
      !isPublishModalOpen &&
      !showDestinationSelector &&
      !isFinalizingClip &&
      !isProcessing ? (
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
            if (recordedVideoUri) {
              openDestinationSelector(recordedVideoUri);
              return;
            }
            setShowPreview(false);
            setTimeout(() => setShowPostSheet(true), 60);
          }}
        />
      ) : null}

      <Modal
        visible={showDestinationSelector && !!recordedVideoUri}
        animationType="slide"
        onRequestClose={handleDestinationCancel}
      >
        <View style={styles.destinationRoot}>
          <StatusBar barStyle="light-content" />
          <View style={styles.destinationTopBar}>
            <TouchableOpacity
              onPress={handleDestinationCancel}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.destinationBack}>← BACK</Text>
            </TouchableOpacity>
            {destinationPublishing ? (
              <ActivityIndicator color={SHUTTER_RED} />
            ) : (
              <View style={styles.destinationSpacer} />
            )}
          </View>
          {recordedVideoUri ? (
            <PostDestinationSelector
              videoUri={recordedVideoUri}
              isProUser={isProUser}
              onPublish={(payload) => {
                void handleDestinationPublish(payload);
              }}
            />
          ) : null}
          {destinationPublishing ? (
            <View style={styles.destinationBusy} pointerEvents="auto">
              <ActivityIndicator color={SHUTTER_RED} size="large" />
              <Text style={styles.destinationBusyText}>Publishing…</Text>
            </View>
          ) : null}
        </View>
      </Modal>

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
            // Prefer in-camera VideoPublishModal over CreationPostSheet navigate
            if (recordedVideoUri) {
              setShowPostSheet(false);
              openPublishModal(recordedVideoUri);
              return;
            }
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

      {/* Root-level publish modal — always last child so it paints above camera/video */}
      <View style={styles.publishModalHost} pointerEvents="box-none">
        <VideoPublishModal
          visible={isPublishModalOpen && !!recordedVideoUri}
          videoUri={recordedVideoUri}
          userId={activePublishUser.userId || activePublishUser.id}
          onClose={handlePublishModalCancel}
          onSuccess={handlePublishModalSuccess}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  absoluteFill: { ...ABSOLUTE_FILL },
  cameraGestureHost: {
    ...ABSOLUTE_FILL,
  },
  capturedVideoOverlay: {
    ...ABSOLUTE_FILL,
    zIndex: 50,
    elevation: 50,
    backgroundColor: '#000000',
  },
  publishModalHost: {
    ...ABSOLUTE_FILL,
    zIndex: 9999,
    elevation: 9999,
  },
  destinationRoot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: 48,
  },
  destinationTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  destinationBack: {
    color: '#3B82F6',
    fontWeight: '900',
    fontSize: 14,
  },
  destinationSpacer: { width: 24, height: 24 },
  destinationBusy: {
    ...ABSOLUTE_FILL,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  destinationBusyText: {
    color: '#FF3B30',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
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
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  topBarSide: {
    width: 96,
    flexShrink: 0,
    justifyContent: 'center',
  },
  topBarSideEnd: {
    alignItems: 'flex-end',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
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
  modeHudPill: {
    maxWidth: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeHudText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
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
