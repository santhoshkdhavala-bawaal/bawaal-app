import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeFeedVideo, {
  resolveFeedVideoUri,
  toPublicFeedVideoUrl,
} from './src/components/SafeFeedVideo';
import MuteToggleButton from './src/components/MuteToggleButton';
import UserHandle from './src/components/UserHandle';
import { isHandleVerified } from './src/data/athleteSocial';
import {
  isUsablePlaybackUri,
  prefetchReelPoster,
  resolvePosterSource,
} from './src/utils/reelMediaFallback';
import { BawaalEmoji, hasBawaalEmoji } from './components/BawaalEmoji';
import { ALL_SKELETON_KEYS } from './src/constants/bawaalEmojiAssets';
import SafeRemoteImage from './src/components/SafeRemoteImage';
import { FullEmojiPickerDrawer } from './components/FullEmojiPickerDrawer';
import {
  FloatingEmojiBurstLayer,
  appendBurstParticles,
  createCenteredEmojiBurst,
} from './src/components/FloatingEmojiBurst';
import {
  REEL_MORE,
  REEL_VAULT,
  REEL_VAULT_ICON_KEY,
} from './src/constants/arenaReelOverlay';
import {
  SKULL_ASSETS,
  REEL_VAULT_SKULL,
  getSkullAsset,
} from './src/utils/skullAssets';
import ReelActionSheet, {
  REEL_SECONDARY_ACTION_IDS,
} from './src/components/ReelActionSheet';
import BanterBottomSheet from './BanterBottomSheet';
import DMChatSheet from './DMChatSheet';

/** Immersive reel right-rail gaps — clear air between ⋮, skull, and ⋮ action stack. */
const RAIL_GAP_MORE_TO_VAULT = 16;
const RAIL_GAP_VAULT_TO_SHEET = 14;

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.15;

const BG = '#08120F';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const GOLD = '#FFD700';
const CRIMSON = '#FF2A5F';
const ACCENT = GOLD;
const CARD = '#0A1210';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TAP_REACT_SIZE = 64;
const TAP_REACT_MS = 800;
const TAP_REACT_MAX = 14;

function pickRandomVaultKey() {
  const keys = ALL_SKELETON_KEYS;
  if (!keys || keys.length === 0) return 'love';
  return keys[Math.floor(Math.random() * keys.length)] || 'love';
}

/** Sports-app share payload for the active reel. */
function buildReelSharePayload(reel) {
  const handle = String(reel?.author || reel?.handle || 'athlete')
    .replace(/^@/, '')
    .trim() || 'athlete';
  const postId = reel?.id != null ? String(reel.id).trim() : '';
  const title = String(
    reel?.caption || reel?.title || reel?.name || 'Arena reel'
  )
    .replace(/\s+/g, ' ')
    .trim();
  const category = String(
    reel?.sport || reel?.category || reel?.sportCategory || reel?.sport_tag || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  const url = postId
    ? `https://bawaal.app/reel/${encodeURIComponent(postId)}`
    : 'https://bawaal.app';
  const headline = category ? `${category} · ${title}` : title;
  const message = `Check out @${handle} on BAWAAL Arena\n${headline}\n${url}`;
  return { handle, title, category, url, message, headline };
}

/** Web clipboard helper — Clipboard API with execCommand fallback. */
async function copyTextToClipboardWeb(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return !!ok;
  } catch {
    return false;
  }
}

/** Cross-platform copy — web clipboard, optional expo-clipboard on native. */
async function copyShareText(text) {
  if (Platform.OS === 'web') return copyTextToClipboardWeb(text);
  try {
    // Soft optional — present in Expo SDKs when installed.
    const ExpoClipboard = require('expo-clipboard');
    if (ExpoClipboard?.setStringAsync) {
      await ExpoClipboard.setStringAsync(String(text || ''));
      return true;
    }
    if (ExpoClipboard?.setString) {
      ExpoClipboard.setString(String(text || ''));
      return true;
    }
  } catch {
    /* no native clipboard module */
  }
  return false;
}

/** Open external share targets without unhandled rejections. */
function openExternalShareUrl(url) {
  const href = String(url || '').trim();
  if (!href) return;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      /* fall through */
    }
  }
  Linking.openURL(href).catch(() => {
    /* ignore — app may be missing */
  });
}

const SHARE_SHEET_ACTIONS = [
  { id: 'whatsapp', label: 'WhatsApp', tint: '#25D366' },
  { id: 'facebook', label: 'Facebook', tint: '#1877F2' },
  { id: 'x', label: 'X', tint: '#E8ECE9' },
  { id: 'telegram', label: 'Telegram', tint: '#2AABEE' },
  { id: 'copy', label: 'Copy Link', tint: GOLD },
  { id: 'more', label: 'More', tint: CRIMSON },
];

/**
 * Sleek BAWAAL share sheet — WhatsApp / Facebook / X / Telegram / Copy / More.
 * System share (navigator.share / Share.share) ONLY runs from the More button.
 */
const BawaalShareSheet = memo(function BawaalShareSheet({
  visible,
  reel,
  bottomPad = 16,
  onClose,
  onToast,
}) {
  const [copied, setCopied] = useState(false);
  const payload = useMemo(() => buildReelSharePayload(reel), [reel]);

  const closeSheet = useCallback(() => {
    setCopied(false);
    onClose?.();
  }, [onClose]);

  /** Explicit More (⋯) only — never called when opening SHARE REEL. */
  const runNativeOrWebMore = useCallback(async () => {
    const { message, url, title } = payload;
    try {
      if (Platform.OS === 'web') {
        if (
          typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function'
        ) {
          await navigator.share({
            title: title || 'BAWAAL Arena',
            text: message,
            url,
          });
          return;
        }
        const ok = await copyShareText(message);
        onToast?.(ok ? 'Link copied to clipboard' : 'Share unavailable', 2000);
        return;
      }
      await Share.share({
        title: 'BAWAAL Arena',
        message,
        url,
      });
    } catch (err) {
      const dismissed =
        err?.name === 'AbortError' ||
        /dismiss|cancel|abort/i.test(String(err?.message || ''));
      if (!dismissed) onToast?.('Share unavailable', 1800);
    }
  }, [onToast, payload]);

  const onPick = useCallback(
    async (id) => {
      const { message, url, title, headline } = payload;
      const shareTitle = headline || title || 'BAWAAL Arena';

      if (id === 'whatsapp') {
        openExternalShareUrl(
          `https://wa.me/?text=${encodeURIComponent(message)}`
        );
        closeSheet();
        return;
      }
      if (id === 'facebook') {
        openExternalShareUrl(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        );
        closeSheet();
        return;
      }
      if (id === 'x') {
        openExternalShareUrl(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
        );
        closeSheet();
        return;
      }
      if (id === 'telegram') {
        openExternalShareUrl(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareTitle)}`
        );
        closeSheet();
        return;
      }
      if (id === 'copy') {
        const ok = await copyShareText(message);
        if (ok) {
          setCopied(true);
          onToast?.('Link copied', 2200);
          setTimeout(() => setCopied(false), 1600);
        } else {
          onToast?.('Could not copy link', 2000);
        }
        return;
      }
      if (id === 'more') {
        // ONLY path that may invoke Share.share / navigator.share
        closeSheet();
        setTimeout(() => {
          void runNativeOrWebMore();
        }, 80);
      }
    },
    [closeSheet, onToast, payload, runNativeOrWebMore]
  );

  if (!visible) return null;

  const cellW = Math.floor((Math.min(SCREEN_W, 480) - 32 - 20) / 3);

  return (
    <View style={shareStyles.overlay} pointerEvents="box-none">
      <Pressable
        style={shareStyles.backdrop}
        onPress={closeSheet}
        accessibilityRole="button"
        accessibilityLabel="Close share"
      />
      <View style={[shareStyles.sheet, { paddingBottom: bottomPad }]}>
        <View style={shareStyles.handle} />
        <View style={shareStyles.header}>
          <Text style={shareStyles.kicker}>SHARE REEL</Text>
          <TouchableOpacity
            onPress={closeSheet}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={shareStyles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={shareStyles.preview} numberOfLines={2}>
          {payload.headline}
        </Text>
        <Text style={shareStyles.handleLine} numberOfLines={1}>
          @{payload.handle}
        </Text>
        <View style={shareStyles.grid}>
          {SHARE_SHEET_ACTIONS.map((action) => {
            const isCopy = action.id === 'copy';
            const label = isCopy && copied ? 'Copied' : action.label;
            return (
              <TouchableOpacity
                key={action.id}
                style={[
                  shareStyles.cell,
                  { width: cellW },
                  isCopy && copied && shareStyles.cellCopied,
                ]}
                onPress={() => void onPick(action.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <View
                  style={[
                    shareStyles.iconOrb,
                    { borderColor: action.tint },
                  ]}
                >
                  <Text style={[shareStyles.iconGlyph, { color: action.tint }]}>
                    {action.id === 'whatsapp'
                      ? 'W'
                      : action.id === 'facebook'
                        ? 'f'
                        : action.id === 'x'
                          ? 'X'
                          : action.id === 'telegram'
                            ? 'T'
                            : action.id === 'copy'
                              ? copied
                                ? '✓'
                                : '⧉'
                              : '⋯'}
                  </Text>
                </View>
                <Text
                  style={[
                    shareStyles.cellLabel,
                    isCopy && copied && { color: GOLD },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const shareStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 80,
    elevation: 80,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,215,0,0.28)',
    paddingHorizontal: 16,
    paddingTop: 10,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kicker: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  close: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  preview: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  handleLine: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'flex-start',
    rowGap: 18,
    marginBottom: 10,
  },
  cell: {
    alignItems: 'center',
    marginBottom: 2,
  },
  cellCopied: {
    opacity: 1,
  },
  iconOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconGlyph: {
    fontSize: 18,
    fontWeight: '900',
  },
  cellLabel: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

/**
 * One-shot floating vault react at tap (x,y) — scale 0.3→1.2, rise −120, fade out.
 * Self-removes via onDone when the 800ms sequence finishes.
 */
const FloatingTapReact = memo(function FloatingTapReact({
  id,
  emojiKey,
  x,
  y,
  onDone,
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: TAP_REACT_MS,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onDone?.(id);
    });
    return () => {
      anim.stop();
    };
  }, [progress, id, onDone]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.2],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -120],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tapReactFloat,
        {
          left: x - TAP_REACT_SIZE / 2,
          top: y - TAP_REACT_SIZE / 2,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <BawaalEmoji
        name={emojiKey || 'love'}
        size={TAP_REACT_SIZE}
        style={styles.tapReactEmoji}
      />
    </Animated.View>
  );
});

/**
 * Full-screen Arena Reel — immersive edge-to-edge player (zero-clutter Option B).
 *
 * Layout: stealth full-bleed video; right rail = mute + vault skull + ⋮ only.
 * All social actions (Like/skull vault, Banter, Share, DM, Comment) live inside ⋮.
 * No bottom Share/React/Banter/Chat bar or always-on reaction strip.
 */
export default function ArenaReelViewer({
  visible,
  reel,
  onClose,
  /** Inherit mute from the feed card so fullscreen doesn't flash a second control set. */
  initialMuted = false,
}) {
  const insets = useSafeAreaInsets();
  const [hype, setHype] = useState(0);
  const [showBanter, setShowBanter] = useState(false);
  const [showDm, setShowDm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(!!initialMuted);
  /** Tap-to-react bursts — absolute (x,y) + vault key; removed after animation. */
  const [tapReacts, setTapReacts] = useState([]);
  /** Vault modal selections — upward FloatingEmojiBurst particles. */
  const [burstParticles, setBurstParticles] = useState([]);
  const [containerSize, setContainerSize] = useState({
    width: SCREEN_W,
    height: SCREEN_H,
  });
  const toastTimerRef = useRef(null);
  const tapSeqRef = useRef(0);
  const [dismissY] = useState(() => new Animated.Value(0));
  const [dismissOpacity] = useState(() => new Animated.Value(1));
  const dismissingRef = useRef(false);
  const overlaysBlockingRef = useRef(false);
  const vaultSkullSource =
    REEL_VAULT_SKULL ||
    getSkullAsset(REEL_VAULT_ICON_KEY) ||
    SKULL_ASSETS.skullOrange ||
    SKULL_ASSETS.skull_orange123 ||
    SKULL_ASSETS.skull_fire_full;

  const flashToast = useCallback((msg, durationMs = 1400) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast(''),
      Math.max(900, Number(durationMs) || 1400)
    );
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const resetDismissAnim = useCallback(() => {
    dismissingRef.current = false;
    dismissY.setValue(0);
    dismissOpacity.setValue(1);
  }, [dismissY, dismissOpacity]);

  const finishDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setShowBanter(false);
    setShowDm(false);
    setShowShare(false);
    setMoreOpen(false);
    setVaultOpen(false);
    Animated.parallel([
      Animated.timing(dismissY, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(dismissOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      resetDismissAnim();
      if (finished) onClose?.();
    });
  }, [dismissY, dismissOpacity, onClose, resetDismissAnim]);

  useEffect(() => {
    overlaysBlockingRef.current =
      showBanter || showDm || showShare || vaultOpen || moreOpen;
  }, [showBanter, showDm, showShare, vaultOpen, moreOpen]);

  // Pan dismiss — RN PanResponder + Animated refs (gesture handlers only).
  /* eslint-disable react-hooks/refs -- dismiss gesture reads refs inside handlers, not for render */
  const panAnimRef = useRef({ dismissY, dismissOpacity, finishDismiss });
  panAnimRef.current = { dismissY, dismissOpacity, finishDismiss };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (overlaysBlockingRef.current || dismissingRef.current) {
            return false;
          }
          return (
            gesture.dy > 14 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25
          );
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy <= 0) return;
          const { dismissY: dy, dismissOpacity: dop } = panAnimRef.current;
          dy.setValue(gesture.dy);
          dop.setValue(Math.max(0.28, 1 - gesture.dy / (SCREEN_H * 0.55)));
        },
        onPanResponderRelease: (_, gesture) => {
          const {
            dismissY: dy,
            dismissOpacity: dop,
            finishDismiss: dismiss,
          } = panAnimRef.current;
          if (
            gesture.dy > DISMISS_DISTANCE ||
            gesture.vy > DISMISS_VELOCITY
          ) {
            dismiss();
            return;
          }
          Animated.parallel([
            Animated.spring(dy, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 5,
              speed: 18,
            }),
            Animated.timing(dop, {
              toValue: 1,
              duration: 140,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          const { dismissY: dy, dismissOpacity: dop } = panAnimRef.current;
          Animated.parallel([
            Animated.spring(dy, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 5,
            }),
            Animated.timing(dop, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    []
  );
  /* eslint-enable react-hooks/refs */

  const uri = useMemo(() => {
    const raw =
      resolveFeedVideoUri(reel) ||
      toPublicFeedVideoUrl(reel?.videoUri) ||
      toPublicFeedVideoUrl(reel?.publicCloudUrl) ||
      toPublicFeedVideoUrl(reel?.remoteVideoUri) ||
      toPublicFeedVideoUrl(reel?.localVideoUri) ||
      null;
    if (raw && isUsablePlaybackUri(raw)) return raw;
    // Mock / invalid / delayed URL → black shell (no sync bundled-mp4 swap)
    return null;
  }, [reel]);

  const posterUri =
    reel?.thumbnailUrl ||
    reel?.thumbnail_url ||
    reel?.posterUri ||
    null;
  const posterSource = useMemo(
    () => resolvePosterSource(posterUri),
    [posterUri]
  );
  const [buffering, setBuffering] = useState(true);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const showPosterCard = !uri || playbackFailed;

  useEffect(() => {
    prefetchReelPoster();
  }, []);

  useEffect(() => {
    if (!visible || !reel) return undefined;
    /* eslint-disable react-hooks/set-state-in-effect -- reel open reset */
    resetDismissAnim();
    setHype(reel.hypeCount || 0);
    setShowBanter(false);
    setShowDm(false);
    setShowShare(false);
    setMoreOpen(false);
    setVaultOpen(false);
    setPaused(false);
    setMuted(!!initialMuted);
    setBuffering(!!uri);
    setPlaybackFailed(false);
    setTapReacts([]);
    setBurstParticles([]);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!uri) return undefined;
    const t = setTimeout(() => setBuffering(false), 1600);
    return () => clearTimeout(t);
  }, [visible, reel?.id, reel, initialMuted, uri, resetDismissAnim]);

  const togglePlayPause = useCallback(() => {
    // JS-only play/pause — never enter native VideoView fullscreen
    setPaused((p) => !p);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const removeTapReact = useCallback((id) => {
    setTapReacts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const removeBurstParticle = useCallback((id) => {
    setBurstParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onShellLayout = useCallback((event) => {
    const { width, height } = event?.nativeEvent?.layout || {};
    if (width > 0 && height > 0) {
      setContainerSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    }
  }, []);

  const handleSelectVaultEmoji = useCallback(
    (emojiId) => {
      setVaultOpen(false);
      if (!emojiId) return;
      const next = createCenteredEmojiBurst(emojiId, containerSize);
      setBurstParticles((prev) => appendBurstParticles(prev, next));
    },
    [containerSize]
  );

  const spawnTapReactAt = useCallback((x, y, emojiKey) => {
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    tapSeqRef.current += 1;
    const id = `tap-${Date.now()}-${tapSeqRef.current}`;
    const key =
      emojiKey && hasBawaalEmoji(emojiKey)
        ? String(emojiKey).toLowerCase()
        : pickRandomVaultKey();
    setTapReacts((prev) => {
      const next = [...prev, { id, key, x: nx, y: ny }];
      return next.length > TAP_REACT_MAX ? next.slice(-TAP_REACT_MAX) : next;
    });
  }, []);

  const handleVideoTap = useCallback(
    (e) => {
      const ne = e?.nativeEvent || {};
      // Prefer local coords on the full-bleed video container
      const x =
        typeof ne.locationX === 'number'
          ? ne.locationX
          : typeof ne.pageX === 'number'
            ? ne.pageX
            : SCREEN_W / 2;
      const y =
        typeof ne.locationY === 'number'
          ? ne.locationY
          : typeof ne.pageY === 'number'
            ? ne.pageY
            : SCREEN_H / 2;
      spawnTapReactAt(x, y);
    },
    [spawnTapReactAt]
  );

  const dropGif = useCallback(
    (emotionKey) => {
      const emoji =
        emotionKey && hasBawaalEmoji(emotionKey)
          ? String(emotionKey).toLowerCase()
          : 'laughing1';
      spawnTapReactAt(
        SCREEN_W * (0.2 + Math.random() * 0.6),
        SCREEN_H * (0.25 + Math.random() * 0.4),
        emoji
      );
    },
    [spawnTapReactAt]
  );

  const openShareSheet = useCallback(() => {
    setMoreOpen(false);
    setVaultOpen(false);
    setShowBanter(false);
    setShowDm(false);
    setShowShare(true);
  }, []);

  const openBanterFeed = useCallback(() => {
    setMoreOpen(false);
    setVaultOpen(false);
    setShowDm(false);
    setShowShare(false);
    setShowBanter(true);
  }, []);

  const openReactions = useCallback(() => {
    setMoreOpen(false);
    setShowBanter(false);
    setShowDm(false);
    setShowShare(false);
    setVaultOpen(true);
  }, []);

  const openDmSheet = useCallback(() => {
    setMoreOpen(false);
    setVaultOpen(false);
    setShowBanter(false);
    setShowShare(false);
    setShowDm(true);
  }, []);

  const dmPeer = useMemo(() => {
    if (!reel) return null;
    const handle = String(reel.author || reel.handle || 'athlete').replace(
      /^@/,
      ''
    );
    return {
      id: reel.user_id || reel.userId || reel.hostId || handle,
      userId: reel.user_id || reel.userId || reel.hostId || null,
      handle,
      displayName: reel.displayName || reel.realName || handle,
      avatarUri: reel.avatarUri || reel.avatar_url || reel.avatar || null,
    };
  }, [reel]);

  const onMoreAction = useCallback(
    async (actionId) => {
      setMoreOpen(false);
      if (actionId === 'like') {
        setHype((n) => n + 1);
        dropGif('head_on_fire');
        // Like → skull / vault reaction picker (no duplicate bottom React bar)
        openReactions();
        return;
      }
      if (actionId === 'banter' || actionId === 'comment') {
        openBanterFeed();
        return;
      }
      if (actionId === 'share') {
        openShareSheet();
        return;
      }
      if (actionId === 'dm' || actionId === 'send') {
        openDmSheet();
      }
    },
    [dropGif, openBanterFeed, openDmSheet, openReactions, openShareSheet]
  );

  // Keep tree warm when closed (visible=false) so the same URI resumes instantly
  if (!reel) return null;

  const handle = reel.author?.startsWith('@')
    ? reel.author
    : `@${String(reel.author || 'athlete').replace(/^@/, '')}`;

  const topPad =
    (Platform.OS === 'android'
      ? StatusBar.currentHeight || 40
      : Math.max(insets.top, 44)) + 8;
  /**
   * Right rail stack (bottom → top): ⋮ → gap → skull vault → gap → action sheet.
   * Extra gaps so the expanded Like/Banter/Share/DM/Comment stack never covers the skull.
   */
  const moreBottom = 24 + Math.max(insets.bottom, 0);
  const vaultBottom = moreBottom + REEL_MORE.height + RAIL_GAP_MORE_TO_VAULT;
  const sheetBottom =
    vaultBottom + REEL_VAULT.height + RAIL_GAP_VAULT_TO_SHEET;
  const captionPad = Math.max(insets.bottom, 12) + 8;

  return (
    <Modal
      visible={visible}
      // Instant open — no slide lag; feed already pre-buffered the same URI
      animationType="fade"
      onRequestClose={finishDismiss}
      statusBarTranslucent
      presentationStyle="fullScreen"
      hardwareAccelerated
    >
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent />
      <Animated.View
        style={[
          styles.root,
          {
            opacity: dismissOpacity,
            transform: [{ translateY: dismissY }],
          },
        ]}
        onLayout={onShellLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.videoShell} pointerEvents="box-none">
          {showPosterCard ? (
            <View style={styles.posterCard} pointerEvents="none">
              <View style={[styles.posterCardImage, { backgroundColor: BG }]} />
              {posterSource ? (
                <SafeRemoteImage
                  source={posterSource}
                  style={styles.posterCardImage}
                  resizeMode="cover"
                  fallbackSource={null}
                />
              ) : null}
              <View style={styles.posterCardScrim} />
              <View style={styles.posterCardBody}>
                <Text style={styles.posterCardEyebrow}>ARENA REEL</Text>
                <UserHandle
                  handle={handle}
                  verified={reel.verified ?? isHandleVerified(handle)}
                  size={18}
                  color={WHITE}
                  textStyle={styles.posterCardHandle}
                />
                <Text style={styles.posterCardCaption} numberOfLines={4}>
                  {reel.caption ||
                    reel.title ||
                    'Clip unavailable — caption locked in.'}
                </Text>
                {!uri ? (
                  <Text style={styles.posterCardHint}>
                    No playable video URL · showing poster card
                  </Text>
                ) : (
                  <Text style={styles.posterCardHint}>
                    Playback failed · showing poster card
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <>
              <View
                style={[styles.posterFill, { backgroundColor: BG }]}
                pointerEvents="none"
              />
              {posterSource ? (
                <SafeRemoteImage
                  source={posterSource}
                  style={styles.posterFill}
                  resizeMode="cover"
                  pointerEvents="none"
                  fallbackSource={null}
                />
              ) : null}
              <SafeFeedVideo
                uri={uri}
                source={reel}
                posterUri={posterUri}
                style={styles.videoFill}
                muted={muted}
                loop
                autoPlay={visible}
                paused={paused || !visible}
                contentFit="cover"
                nativeControls={false}
                immersive
                onPlaybackError={() => {
                  setPlaybackFailed(true);
                  setBuffering(false);
                }}
              />
              {buffering && visible ? (
                <View style={styles.bufferOverlay} pointerEvents="none">
                  <ActivityIndicator color={WHITE} size="large" />
                </View>
              ) : null}
              {/* Full-bleed tap layer — spawn vault skull/skel reacts at (x,y) */}
              <Pressable
                style={styles.videoTapLayer}
                onPress={handleVideoTap}
                onLongPress={togglePlayPause}
                delayLongPress={280}
                accessibilityLabel="Tap to react · long-press to pause"
              />
              {paused ? (
                <View style={styles.pauseBadge} pointerEvents="none">
                  <Text style={styles.pauseBadgeText}>PAUSED</Text>
                </View>
              ) : null}
            </>
          )}

          {/* Poster / no-video: still allow tap-to-react on the shell */}
          {showPosterCard ? (
            <Pressable
              style={styles.videoTapLayer}
              onPress={handleVideoTap}
              accessibilityLabel="Tap to react"
            />
          ) : null}
        </View>

        {tapReacts.map((rx) => (
          <FloatingTapReact
            key={rx.id}
            id={rx.id}
            emojiKey={rx.key}
            x={rx.x}
            y={rx.y}
            onDone={removeTapReact}
          />
        ))}

        <FloatingEmojiBurstLayer
          particles={burstParticles}
          onParticleDone={removeBurstParticle}
          onLayout={onShellLayout}
          style={styles.burstOverlay}
        />

        <View style={[styles.topSafe, { paddingTop: topPad }]} pointerEvents="box-none">
          <View style={styles.dragHandleHit} pointerEvents="none">
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.topBar}>
            <View style={styles.topTitleBlock}>
              <UserHandle
                handle={handle}
                verified={reel.verified ?? isHandleVerified(handle)}
                size={15}
                color={WHITE}
                textStyle={styles.topHandle}
              />
              <Text style={styles.topHint}>ARENA REEL</Text>
            </View>
            <View style={styles.topBarRight}>
              <MuteToggleButton
                muted={muted}
                onPress={toggleMute}
                style={styles.headerMute}
              />
              <TouchableOpacity
                onPress={finishDismiss}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close reel"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!!toast && (
          <View style={[styles.toast, { top: topPad + 52 }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/*
          Right rail (bottom → top): ⋮ → skull vault → (⋮ action stack when open).
          Mute lives in the top header next to ✕ (not on this rail).
        */}
        <TouchableOpacity
          style={[styles.moreBtn, { bottom: moreBottom }]}
          onPress={() => {
            setVaultOpen(false);
            setMoreOpen((v) => !v);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={moreOpen ? 'Close actions' : 'More actions'}
          accessibilityState={{ expanded: moreOpen }}
        >
          <Text style={styles.moreDots}>{moreOpen ? '✕' : '⋮'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.vaultFab, { bottom: vaultBottom }]}
          onPress={() => {
            setMoreOpen(false);
            setShowBanter(false);
            setShowDm(false);
            setShowShare(false);
            setVaultOpen((open) => !open);
          }}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            vaultOpen ? 'Close BAWAAL skull vault' : 'Open BAWAAL skull vault'
          }
          accessibilityState={{ expanded: vaultOpen }}
        >
          <Image
            source={vaultSkullSource}
            style={styles.vaultFabImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </TouchableOpacity>

        {/* ⋮ popup sits above the skull — Like · Banter · Share · DM · Comment */}
        <ReelActionSheet
          visible={moreOpen}
          showLabels
          compact
          showClose={false}
          actionIds={REEL_SECONDARY_ACTION_IDS}
          reel={reel}
          onClose={() => setMoreOpen(false)}
          onAction={onMoreAction}
          style={{
            bottom: sheetBottom,
            top: undefined,
            right: REEL_MORE.right,
            zIndex: 60,
          }}
        />

        <FullEmojiPickerDrawer
          visible={vaultOpen && visible}
          onClose={() => setVaultOpen(false)}
          onSelectEmoji={handleSelectVaultEmoji}
        />

        {/* Caption only — no bottom Share/React/Banter/Chat bar or reaction strip */}
        <View
          style={[styles.captionDock, { paddingBottom: captionPad }]}
          pointerEvents="box-none"
        >
          <View style={styles.captionBlock}>
            <Text style={styles.caption} numberOfLines={3}>
              {reel.caption || reel.title || ''}
            </Text>
            {hype > 0 ? (
              <Text style={styles.hypeMeta}>{hype} HYPE</Text>
            ) : null}
          </View>
        </View>

        <BanterBottomSheet
          visible={showBanter && visible}
          reel={reel}
          onClose={() => setShowBanter(false)}
        />
        <DMChatSheet
          visible={showDm && visible}
          peer={dmPeer}
          onClose={() => setShowDm(false)}
        />
        <BawaalShareSheet
          visible={showShare && visible}
          reel={reel}
          bottomPad={Math.max(insets.bottom, 16) + 12}
          onClose={() => setShowShare(false)}
          onToast={flashToast}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
  },
  videoShell: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
    overflow: 'hidden',
  },
  posterFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
    zIndex: 0,
  },
  posterCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    justifyContent: 'flex-end',
  },
  posterCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.45,
  },
  posterCardScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  posterCardBody: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    paddingTop: 32,
    zIndex: 2,
  },
  posterCardEyebrow: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  posterCardHandle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  posterCardCaption: {
    marginTop: 14,
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    maxWidth: '88%',
  },
  posterCardHint: {
    marginTop: 18,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  videoFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: BG,
    zIndex: 1,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    zIndex: 2,
  },
  videoTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  tapReactFloat: {
    position: 'absolute',
    width: TAP_REACT_SIZE,
    height: TAP_REACT_SIZE,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapReactEmoji: {
    marginHorizontal: 0,
  },
  pauseBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pauseBadgeText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  topSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  dragHandleHit: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topTitleBlock: {
    flexShrink: 1,
    paddingRight: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMute: {
    marginRight: 2,
  },
  topHandle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  topHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 30,
    backgroundColor: 'rgba(8, 18, 15,0.94)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CRIMSON,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  closeBtn: {
    // Icon-only — flat, no circle / shadow
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  closeText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  burstOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 35,
    elevation: 35,
  },
  vaultFab: {
    position: 'absolute',
    right: REEL_VAULT.right,
    width: REEL_VAULT.width,
    height: REEL_VAULT.height,
    zIndex: 55,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  vaultFabImage: {
    width: REEL_VAULT.iconSize,
    height: REEL_VAULT.iconSize,
  },
  moreBtn: {
    position: 'absolute',
    right: REEL_MORE.right,
    width: REEL_MORE.width,
    height: REEL_MORE.height,
    zIndex: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  moreDots: {
    color: ACCENT,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
    backgroundColor: 'transparent',
  },
  captionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
  },
  captionBlock: {
    paddingHorizontal: 16,
    paddingRight: 96,
    paddingBottom: 8,
  },
  caption: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  hypeMeta: {
    marginTop: 6,
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
