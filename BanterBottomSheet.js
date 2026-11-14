import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserHandle from './src/components/UserHandle';
import { isHandleVerified } from './src/data/athleteSocial';
import {
  fetchVideoComments,
  postVideoComment,
} from './src/services/videoSocialService';
import {
  BawaalEmoji,
  hasBawaalEmoji,
  BANTER_QUICK_KEYS,
} from './components/BawaalEmoji';
import {
  FullEmojiPickerDrawer,
  ALL_SKELETON_KEYS,
} from './components/FullEmojiPickerDrawer';
import {
  BawaalEmojiText,
  messageHasBawaalEmoji,
  toBawaalShortcode,
} from './src/utils/bawaalEmojiText';

const BG = '#000000';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BAWAAL_ORANGE = '#FF5500';

/** Horizontal Banter reaction tray — skulls first, then skeleton shortcuts. */
const BANTER_REACTIONS = BANTER_QUICK_KEYS;

const BAWAAL_MARKER_RE = /\[bawaal:([a-z0-9_]+)\]/i;

const DEMO_BANTER = [
  {
    id: 'b1',
    handle: '@Neha_Lift',
    verified: true,
    text: 'That pull was filthy :head_on_fire:',
  },
  {
    id: 'b2',
    handle: '@Dev_Snatch',
    verified: false,
    text: 'GIF energy only :laughing1:',
  },
  {
    id: 'b3',
    handle: '@Mia_Torque',
    verified: true,
    text: 'Send the angle next time :gold_cup:',
  },
];

function resolveBanterEmotion(item) {
  if (!item) return null;
  const candidates = [item.emotion, item.reaction, item.gif, item.emoji];
  for (const key of candidates) {
    if (key && hasBawaalEmoji(key)) return String(key).toLowerCase();
  }
  const match = String(item.text || '').match(BAWAAL_MARKER_RE);
  if (match && hasBawaalEmoji(match[1])) return match[1].toLowerCase();
  return null;
}

function withResolvedEmotion(row) {
  const emotion = resolveBanterEmotion(row);
  return emotion ? { ...row, emotion } : row;
}

const BanterMessageRow = memo(function BanterMessageRow({ item }) {
  const emotion = resolveBanterEmotion(item);
  const body = String(item.text || '').trim();
  const hasInline = messageHasBawaalEmoji(body);
  const showLeading = emotion && !hasInline;
  return (
    <View style={styles.row}>
      {showLeading ? (
        <BawaalEmoji name={emotion} size={22} style={styles.rowEmoji} />
      ) : null}
      <View style={styles.rowBody}>
        <UserHandle
          handle={item.handle}
          verified={item.verified ?? isHandleVerified(item.handle)}
          size={11}
          color={WHITE}
          badgeSize={12}
        />
        {body ? (
          <BawaalEmojiText
            text={body}
            textStyle={styles.rowText}
            style={styles.rowRich}
          />
        ) : showLeading ? (
          <Text style={styles.rowText}>reacted</Text>
        ) : null}
      </View>
    </View>
  );
});

/**
 * In-place banter / GIF comment sheet — does not switch to immersive reel view.
 */
export default function BanterBottomSheet({ visible, reel, onClose, onPosted }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [banter, setBanter] = useState(DEMO_BANTER);
  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setVaultOpen(false);
      return;
    }
    setDraft('');
    setSelection({ start: 0, end: 0 });
    let alive = true;
    setLoading(true);
    (async () => {
      const live = await fetchVideoComments(reel);
      if (!alive) return;
      if (live.length) {
        setBanter(live.map(withResolvedEmotion));
      } else if (reel?.banter?.length) {
        setBanter(reel.banter.map(withResolvedEmotion));
      } else {
        setBanter(DEMO_BANTER);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [visible, reel?.id]);

  const handle = reel?.author?.startsWith('@')
    ? reel.author
    : `@${String(reel?.author || 'athlete').replace(/^@/, '')}`;

  const openVaultForInsert = () => {
    setVaultOpen(true);
  };

  const keyExtractor = useCallback((item) => String(item.id), []);
  const renderBanterItem = useCallback(
    ({ item }) => <BanterMessageRow item={item} />,
    []
  );

  const insertEmojiShortcode = (key) => {
    if (!key || !hasBawaalEmoji(key)) return;
    const token = toBawaalShortcode(key);
    const start = Math.min(selection.start ?? draft.length, draft.length);
    const end = Math.min(selection.end ?? start, draft.length);
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    const cursor = start + token.length;
    setDraft(next);
    setSelection({ start: cursor, end: cursor });
    requestAnimationFrame(() => {
      try {
        inputRef.current?.focus?.();
      } catch (_) {
        /* ignore */
      }
    });
  };

  const sendBanter = async (emotionKey) => {
    const emotion =
      emotionKey && hasBawaalEmoji(emotionKey) ? String(emotionKey).toLowerCase() : null;
    const draftText = draft.trim();
    const text =
      draftText ||
      (emotion ? toBawaalShortcode(emotion).trim() : '');
    if (!text && !emotion) return;

    const optimistic = {
      id: `local-${Date.now()}`,
      handle: '@you',
      text: draftText || (emotion ? toBawaalShortcode(emotion).trim() : 'reacted'),
      emotion: emotion || null,
      gif: emotion || null,
    };
    setBanter((prev) => [optimistic, ...prev]);
    setDraft('');
    setSelection({ start: 0, end: 0 });

    const posted = await postVideoComment(
      reel,
      draftText || (emotion ? `[bawaal:${emotion}]` : '[bawaal:laughing1]')
    );
    if (posted?.comment?.id) {
      setBanter((prev) =>
        prev.map((row) =>
          row.id === optimistic.id
            ? withResolvedEmotion({
                ...optimistic,
                ...posted.comment,
                text: posted.comment.text || optimistic.text,
                emotion: optimistic.emotion || resolveBanterEmotion(posted.comment),
                gif: optimistic.emotion || posted.comment.gif,
              })
            : row
        )
      );
    }
    try {
      onPosted?.(posted?.comment || optimistic, reel);
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <>
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
                <View style={styles.subRow}>
                  <UserHandle
                    handle={handle}
                    verified={reel?.verified ?? isHandleVerified(handle)}
                    size={11}
                    color={MUTED}
                    badgeSize={12}
                  />
                  <Text style={styles.sub} numberOfLines={1}>
                    {' '}
                    · {reel?.caption || 'Arena reel'}
                  </Text>
                </View>
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
              {BANTER_REACTIONS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.gifChip}
                  onPress={() => sendBanter(key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${key}`}
                >
                  <BawaalEmoji name={key} size={26} style={styles.chipEmoji} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.vaultChip}
                onPress={openVaultForInsert}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Open skeleton vault (${ALL_SKELETON_KEYS.length})`}
              >
                <Text style={styles.vaultChipText}>VAULT</Text>
                <Text style={styles.vaultChipCount}>{ALL_SKELETON_KEYS.length}</Text>
              </TouchableOpacity>
            </ScrollView>

            <FlatList
              data={banter}
              keyExtractor={keyExtractor}
              renderItem={renderBanterItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              windowSize={5}
              maxToRenderPerBatch={10}
              initialNumToRender={10}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS !== 'web'}
              ListEmptyComponent={
                loading ? (
                  <Text style={styles.rowText}>Loading banter…</Text>
                ) : null
              }
            />

            <View style={styles.compose}>
              <TouchableOpacity
                style={styles.vaultComposeBtn}
                onPress={openVaultForInsert}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Insert skeleton emoji into message"
              >
                <BawaalEmoji name="crown" size={22} style={styles.chipEmoji} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Drop banter… use :gym: or vault"
                placeholderTextColor={MUTED}
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  const tip = value.length;
                  setSelection((prev) => {
                    if (prev.start > tip || prev.end > tip) {
                      return { start: tip, end: tip };
                    }
                    return prev;
                  });
                }}
                onSelectionChange={(e) => {
                  const next = e?.nativeEvent?.selection;
                  if (next && typeof next.start === 'number') {
                    setSelection(next);
                  }
                }}
                selection={selection}
                onSubmitEditing={() => sendBanter()}
                returnKeyType="send"
                blurOnSubmit={false}
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

      <FullEmojiPickerDrawer
        visible={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onSelectEmoji={(key) => {
          insertEmojiShortcode(key);
        }}
      />
    </>
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 1,
  },
  sub: {
    color: MUTED,
    fontSize: 11,
    flexShrink: 1,
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
  chipEmoji: {
    marginHorizontal: 0,
  },
  vaultChip: {
    minWidth: 52,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BAWAAL_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  vaultChipText: {
    color: BAWAAL_ORANGE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  vaultChipCount: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  vaultComposeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BAWAAL_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { maxHeight: 180, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  rowEmoji: {
    marginTop: 1,
    marginHorizontal: 0,
  },
  rowBody: { flex: 1 },
  rowRich: { marginTop: 1 },
  rowText: { color: WHITE, fontSize: 12 },
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
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendText: {
    color: BG,
    fontSize: 11,
    fontWeight: '900',
  },
});
