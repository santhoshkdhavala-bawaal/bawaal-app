import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator,
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

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';
const CARD = '#121212';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GIF_STICKERS = ['🔥', '💀', '🐐', '💪', '🚀', '😂', '⚡', '🏆'];

const DEMO_BANTER = [
  { id: 'b1', handle: '@Neha_Lift', verified: true, text: 'That pull was filthy 🔥', gif: '🔥' },
  { id: 'b2', handle: '@Dev_Snatch', verified: false, text: 'GIF energy only', gif: '💀' },
  { id: 'b3', handle: '@Mia_Torque', verified: true, text: 'Send the angle next time', gif: '🐐' },
];

/**
 * Full-screen Arena Reel — banter = text & GIF audience chat (not audio).
 *
 * LOCK-IN layout: single safe top header; right rail bottom:180 (HYPE/BANTER/MORE);
 * emoji quick-reactions above caption, hidden while Banter drawer is open.
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
  const [banter, setBanter] = useState(DEMO_BANTER);
  const [draft, setDraft] = useState('');
  const [showBanter, setShowBanter] = useState(false);
  const [toast, setToast] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(!!initialMuted);
  const [activeGifs, setActiveGifs] = useState([
    { id: 'g1', emoji: '🔥', x: 0.72, y: 0.28 },
    { id: 'g2', emoji: '💪', x: 0.18, y: 0.42 },
  ]);
  const toastTimerRef = useRef(null);

  const flashToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const uri = useMemo(() => {
    const raw =
      resolveFeedVideoUri(reel) ||
      toPublicFeedVideoUrl(reel?.videoUri) ||
      toPublicFeedVideoUrl(reel?.publicCloudUrl) ||
      toPublicFeedVideoUrl(reel?.remoteVideoUri) ||
      toPublicFeedVideoUrl(reel?.localVideoUri) ||
      null;
    if (raw && isUsablePlaybackUri(raw)) {
      console.log('[ArenaReelViewer] public playback URL:', raw);
      return raw;
    }
    // Mock / invalid / delayed URL → keep player mounted with bundled sample
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
    setHype(reel.hypeCount || 0);
    setBanter(reel.banter?.length ? reel.banter : DEMO_BANTER);
    setDraft('');
    setShowBanter(false);
    setMoreOpen(false);
    setPaused(false);
    setMuted(!!initialMuted);
    setBuffering(!!uri);
    setPlaybackFailed(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!uri) return undefined;
    const t = setTimeout(() => setBuffering(false), 1600);
    return () => clearTimeout(t);
  }, [visible, reel?.id, reel, initialMuted, uri]);

  const togglePlayPause = useCallback(() => {
    // JS-only play/pause — never enter native VideoView fullscreen
    setPaused((p) => !p);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  // Keep tree warm when closed (visible=false) so the same URI resumes instantly
  if (!reel) return null;

  const handle = reel.author?.startsWith('@')
    ? reel.author
    : `@${String(reel.author || 'athlete').replace(/^@/, '')}`;

  const dropGif = (emoji) => {
    setActiveGifs((prev) => [
      ...prev,
      {
        id: `g-${Date.now()}`,
        emoji,
        x: 0.15 + Math.random() * 0.55,
        y: 0.2 + Math.random() * 0.4,
      },
    ]);
  };

  const sendBanter = () => {
    const text = draft.trim();
    if (!text) return;
    setBanter((prev) => [
      { id: `local-${Date.now()}`, handle: '@you', text, gif: '💬' },
      ...prev,
    ]);
    setDraft('');
  };

  const topPad =
    (Platform.OS === 'android'
      ? StatusBar.currentHeight || 40
      : Math.max(insets.top, 44)) + 8;
  const actionStackBottom = 180 + Math.max(insets.bottom, 0);
  const bottomStackPad = Math.max(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      // Instant open — no slide lag; feed already pre-buffered the same URI
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="fullScreen"
      hardwareAccelerated
    >
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent />
      <View style={styles.root}>
        <View style={styles.videoShell} pointerEvents="box-none">
          {showPosterCard ? (
            <View style={styles.posterCard} pointerEvents="none">
              <Image
                source={posterSource}
                style={styles.posterCardImage}
                resizeMode="cover"
              />
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
              <Image
                source={posterSource}
                style={styles.posterFill}
                resizeMode="cover"
                pointerEvents="none"
              />
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
              <Pressable
                style={styles.videoTapLayer}
                onPress={togglePlayPause}
                accessibilityLabel={paused ? 'Play video' : 'Pause video'}
              />
              <MuteToggleButton
                muted={muted}
                onPress={toggleMute}
                style={[styles.muteBtn, { top: topPad + 8 }]}
              />
              {paused ? (
                <View style={styles.pauseBadge} pointerEvents="none">
                  <Text style={styles.pauseBadgeText}>PAUSED</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {activeGifs.map((g) => (
          <Text
            key={g.id}
            style={[
              styles.gifFloat,
              { left: g.x * SCREEN_W, top: g.y * SCREEN_H },
            ]}
          >
            {g.emoji}
          </Text>
        ))}

        <View style={[styles.topSafe, { paddingTop: topPad }]} pointerEvents="box-none">
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
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!toast && (
          <View style={[styles.toast, { top: topPad + 52 }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <View style={[styles.actionStack, { bottom: actionStackBottom }]}>
          {moreOpen ? (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setMoreOpen(false);
                  flashToast('RESHARED TO ARENA');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.actionEmoji}>🚀</Text>
                <Text style={styles.actionCount}>RESHARE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setMoreOpen(false);
                  flashToast('REPOSTED');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.actionEmoji}>♻️</Text>
                <Text style={styles.actionCount}>REPOST</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setHype((n) => n + 1)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionEmoji}>🔥</Text>
            <Text style={styles.actionCount}>{hype}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowBanter((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionEmoji}>💬</Text>
            <Text style={styles.actionCount}>BANTER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setMoreOpen((v) => !v)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="More actions"
          >
            <Text style={styles.moreDots}>{moreOpen ? '✕' : '⋮'}</Text>
            <Text style={styles.actionCount}>MORE</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.bottomStack, { paddingBottom: bottomStackPad }]}
          pointerEvents="box-none"
        >
          {!showBanter ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gifTray}
              keyboardShouldPersistTaps="handled"
            >
              {GIF_STICKERS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.gifChip}
                  onPress={() => dropGif(emoji)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.gifChipText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.captionBlock}>
            <Text style={styles.caption} numberOfLines={3}>
              {reel.caption || reel.title || ''}
            </Text>
          </View>

          {showBanter ? (
            <View style={styles.banterPanel}>
              <ScrollView style={styles.banterList} showsVerticalScrollIndicator={false}>
                {banter.map((c) => (
                  <View key={c.id} style={styles.banterRow}>
                    <Text style={styles.banterGif}>{c.gif || '💬'}</Text>
                    <View style={styles.banterBody}>
                      <UserHandle
                        handle={c.handle}
                        verified={c.verified ?? isHandleVerified(c.handle)}
                        size={11}
                        color={WHITE}
                        textStyle={styles.banterHandle}
                        badgeSize={12}
                      />
                      <Text style={styles.banterText}>{c.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.composeRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Drop banter…"
                  placeholderTextColor={MUTED}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={sendBanter}
                  returnKeyType="send"
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendBanter} activeOpacity={0.85}>
                  <Text style={styles.sendText}>SEND</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
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
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  posterFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0A0A',
    zIndex: 0,
  },
  posterCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
    position: 'absolute',
    top: '18%',
    bottom: '32%',
    left: '10%',
    right: '22%',
    zIndex: 4,
  },
  muteBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 22,
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
  gifFloat: {
    position: 'absolute',
    fontSize: 36,
    zIndex: 5,
  },
  topSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topTitleBlock: {
    flexShrink: 1,
    paddingRight: 12,
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
    backgroundColor: 'rgba(18, 18, 18,0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
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
  actionStack: {
    position: 'absolute',
    right: 12,
    bottom: 180,
    zIndex: 15,
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  actionEmoji: {
    fontSize: 28,
  },
  moreDots: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
    backgroundColor: 'transparent',
  },
  actionCount: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
  },
  captionBlock: {
    paddingHorizontal: 16,
    paddingRight: 90,
    paddingBottom: 8,
  },
  caption: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  gifTray: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  gifChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  gifChipText: { fontSize: 20 },
  banterPanel: {
    marginHorizontal: 12,
    backgroundColor: 'rgba(18, 18, 18,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.25)',
    maxHeight: 160,
    padding: 10,
  },
  banterList: { maxHeight: 90 },
  banterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  banterGif: { fontSize: 16, marginTop: 1 },
  banterBody: { flex: 1 },
  banterHandle: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
  },
  banterText: {
    color: WHITE,
    fontSize: 12,
    marginTop: 1,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.3)',
    color: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sendText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
  },
});
