import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';
const CARD = '#121212';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GIF_STICKERS = ['🔥', '💀', '🐐', '💪', '🚀', '😂', '⚡', '🏆'];

const DEMO_BANTER = [
  { id: 'b1', handle: '@Neha_Lift', text: 'That pull was filthy 🔥', gif: '🔥' },
  { id: 'b2', handle: '@Dev_Snatch', text: 'GIF energy only', gif: '💀' },
  { id: 'b3', handle: '@Mia_Torque', text: 'Send the angle next time', gif: '🐐' },
];

function isPlayableUri(uri) {
  if (uri == null) return false;
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  return (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://')
  );
}

function releasePlayer(player) {
  if (!player) return;
  try {
    player.pause?.();
  } catch (_) {
    /* ignore */
  }
  try {
    if (typeof player.release === 'function') player.release();
  } catch (_) {
    /* ignore */
  }
}

/**
 * Full-screen Arena Reel — banter = text & GIF audience chat (not audio).
 *
 * LOCK-IN layout: single safe top header; right rail bottom:180 (HYPE/BANTER/MORE);
 * emoji quick-reactions above caption, hidden while Banter drawer is open.
 */
export default function ArenaReelViewer({ visible, reel, onClose }) {
  const insets = useSafeAreaInsets();
  const [hype, setHype] = useState(0);
  const [banter, setBanter] = useState(DEMO_BANTER);
  const [draft, setDraft] = useState('');
  const [showBanter, setShowBanter] = useState(false);
  const [toast, setToast] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeGifs, setActiveGifs] = useState([
    { id: 'g1', emoji: '🔥', x: 0.72, y: 0.28 },
    { id: 'g2', emoji: '💪', x: 0.18, y: 0.42 },
  ]);

  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1400);
  };

  const uri = isPlayableUri(reel?.videoUri) ? String(reel.videoUri).trim() : null;
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const player = useVideoPlayer(uri && !playbackFailed ? { uri } : null, (p) => {
    try {
      p.loop = true;
      p.muted = false;
    } catch (_) {
      /* ignore */
    }
  });

  useEffect(() => {
    setPlaybackFailed(false);
  }, [uri, reel?.id]);

  useEffect(() => {
    if (!visible || !reel) return undefined;
    // Sync reel props into local UI when the viewer opens / switches clips.
    /* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability -- reel open reset + expo-video player API */
    setHype(reel.hypeCount || 0);
    setBanter(reel.banter?.length ? reel.banter : DEMO_BANTER);
    setDraft('');
    setShowBanter(false);
    setMoreOpen(false);
    let cancelled = false;
    (async () => {
      try {
        if (uri && player && !playbackFailed) {
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync({ uri });
          }
          if (!cancelled) {
            player.loop = true;
            player.play?.();
          }
        }
      } catch (e) {
        console.warn('[ArenaReelViewer] playback failed:', e?.message || e);
        if (!cancelled) setPlaybackFailed(true);
      }
    })();
    /* eslint-enable react-hooks/set-state-in-effect, react-hooks/immutability */
    return () => {
      cancelled = true;
      releasePlayer(player);
    };
  }, [visible, reel?.id, uri, player, reel, playbackFailed]);

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
  // Clear captions, emoji row, and open banter drawer.
  const actionStackBottom = 180 + Math.max(insets.bottom, 0);
  const bottomStackPad = Math.max(insets.bottom, 12);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent />
      <View style={styles.root}>
        {uri && !playbackFailed && player ? (
          <VideoView
            style={StyleSheet.absoluteFillObject}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={styles.placeholder} />
        )}

        {/* Floating GIF overlays on the video (not the header) */}
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

        {/* Single top header — StatusBar.currentHeight + 8 clears the clock */}
        <View style={[styles.topSafe, { paddingTop: topPad }]} pointerEvents="box-none">
          <View style={styles.topBar}>
            <View style={styles.topTitleBlock}>
              <Text style={styles.topHandle} numberOfLines={1}>
                {handle}
              </Text>
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

        {/* Right action stack — elevated clear of bottom chrome */}
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

        {/* Bottom stack: emoji (above caption) → caption → banter drawer */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.bottomStack, { paddingBottom: bottomStackPad }]}
          pointerEvents="box-none"
        >
          {/* Hide quick reactions while typing banter so they never cover the input */}
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
                      <Text style={styles.banterHandle}>{c.handle}</Text>
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
    backgroundColor: BG,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
  },
  closeText: { color: WHITE, fontSize: 16, fontWeight: '700' },
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
  },
  actionEmoji: {
    fontSize: 28,
  },
  moreDots: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
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
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
