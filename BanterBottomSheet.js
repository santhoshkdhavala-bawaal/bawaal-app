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
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';

const GIF_STICKERS = ['🔥', '💀', '🐐', '💪', '🚀', '😂', '⚡', '🏆'];

const DEMO_BANTER = [
  { id: 'b1', handle: '@Neha_Lift', text: 'That pull was filthy 🔥', gif: '🔥' },
  { id: 'b2', handle: '@Dev_Snatch', text: 'GIF energy only', gif: '💀' },
  { id: 'b3', handle: '@Mia_Torque', text: 'Send the angle next time', gif: '🐐' },
];

/**
 * In-place banter / GIF comment sheet — does not switch to immersive reel view.
 */
export default function BanterBottomSheet({ visible, reel, onClose }) {
  const insets = useSafeAreaInsets();
  const [banter, setBanter] = useState(DEMO_BANTER);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!visible) return;
    setBanter(reel?.banter?.length ? reel.banter : DEMO_BANTER);
    setDraft('');
  }, [visible, reel?.id, reel]);

  const handle = reel?.author?.startsWith('@')
    ? reel.author
    : `@${String(reel?.author || 'athlete').replace(/^@/, '')}`;

  const sendBanter = (gif) => {
    const text = draft.trim();
    if (!text && !gif) return;
    setBanter((prev) => [
      {
        id: `local-${Date.now()}`,
        handle: '@you',
        text: text || 'reacted',
        gif: gif || '💬',
      },
      ...prev,
    ]);
    setDraft('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerMeta}>
              <Text style={styles.title}>BANTER</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {handle} · {reel?.caption || 'Arena reel'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gifTray}
          >
            {GIF_STICKERS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.gifChip}
                onPress={() => sendBanter(emoji)}
                activeOpacity={0.85}
              >
                <Text style={styles.gifChipText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {banter.map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.rowGif}>{c.gif || '💬'}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowHandle}>{c.handle}</Text>
                  <Text style={styles.rowText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.compose}>
            <TextInput
              style={styles.input}
              placeholder="Drop banter…"
              placeholderTextColor={MUTED}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => sendBanter()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => sendBanter()}
              activeOpacity={0.85}
            >
              <Text style={styles.sendText}>SEND</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0,0.45)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    maxHeight: '62%',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: MUTED,
    opacity: 0.45,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerMeta: { flex: 1, paddingRight: 12 },
  title: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sub: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  close: { color: WHITE, fontSize: 18, fontWeight: '700' },
  gifTray: {
    paddingBottom: 10,
    gap: 8,
  },
  gifChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  gifChipText: { fontSize: 18 },
  list: { maxHeight: 180, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  rowGif: { fontSize: 16, marginTop: 1 },
  rowBody: { flex: 1 },
  rowHandle: { color: ACCENT, fontSize: 11, fontWeight: '800' },
  rowText: { color: WHITE, fontSize: 12, marginTop: 1 },
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(160,176,168,0.3)',
    color: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
  },
});
