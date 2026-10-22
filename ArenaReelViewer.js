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
  return (
    typeof uri === 'string' &&
    (uri.startsWith('file://') ||
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('content://'))
  );
}

/**
 * Full-screen general Arena reel — banter comments + floating GIF overlays.
 * No battle / challenge CTAs.
 */
export default function ArenaReelViewer({ visible, reel, onClose }) {
  const insets = useSafeAreaInsets();
  const [hype, setHype] = useState(0);
  const [banter, setBanter] = useState(DEMO_BANTER);
  const [draft, setDraft] = useState('');
  const [showBanter, setShowBanter] = useState(true);
  const [toast, setToast] = useState('');
  const [activeGifs, setActiveGifs] = useState([
    { id: 'g1', emoji: '🔥', x: 0.72, y: 0.28 },
    { id: 'g2', emoji: '💪', x: 0.18, y: 0.42 },
  ]);

  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1400);
  };

  const uri = isPlayableUri(reel?.videoUri) ? reel.videoUri : null;
  const player = useVideoPlayer(uri || '', (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!visible || !reel) return undefined;
    setHype(reel.hypeCount || 0);
    setBanter(reel.banter?.length ? reel.banter : DEMO_BANTER);
    setDraft('');
    setShowBanter(true);
    let cancelled = false;
    (async () => {
      try {
        if (uri) {
          await player.replaceAsync({ uri });
          if (!cancelled) {
            player.loop = true;
            player.play();
          }
        }
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch (_) {
        /* ignore */
      }
    };
  }, [visible, reel?.id, uri, player, reel]);

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.root}>
        {uri ? (
          <VideoView
            style={StyleSheet.absoluteFillObject}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderLabel}>{handle}</Text>
            <Text style={styles.placeholderSub}>ARENA REEL</Text>
          </View>
        )}

        {/* Floating GIF overlays */}
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

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.topHint}>IMMERSIVE · BANTER + GIFS</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {!!toast && (
          <View style={[styles.toast, { top: Math.max(insets.top, 12) + 48 }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* Right action stack — Fire, Banter, Reshare, Repost */}
        <View style={[styles.actionStack, { bottom: Math.max(insets.bottom, 16) + 120 }]}>
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
            onPress={() => flashToast('RESHARED TO ARENA')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionEmoji}>🚀</Text>
            <Text style={styles.actionCount}>RESHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => flashToast('REPOSTED')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionEmoji}>♻️</Text>
            <Text style={styles.actionCount}>REPOST</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom-left creator + caption */}
        <View style={[styles.bottomLeft, { bottom: Math.max(insets.bottom, 16) + (showBanter ? 150 : 24) }]}>
          <Text style={styles.handle}>{handle}</Text>
          <Text style={styles.caption} numberOfLines={3}>
            {reel.caption || reel.title || ''}
          </Text>
        </View>

        {/* GIF sticker tray + banter drawer */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.banterWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gifTray}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLabel: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  placeholderSub: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  gifFloat: {
    position: 'absolute',
    fontSize: 36,
    zIndex: 5,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
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
    zIndex: 15,
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionCount: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  bottomLeft: {
    position: 'absolute',
    left: 16,
    right: 90,
    zIndex: 12,
  },
  handle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  caption: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  banterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
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
