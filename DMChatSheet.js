/**
 * Stealth-black 1v1 DM chat surface — full-screen sheet.
 * Sent bubbles: accent blue · Received: dark grey · SEND bar at bottom.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserHandle from './src/components/UserHandle';
import { isHandleVerified } from './src/data/athleteSocial';
import {
  fetchMessageHistory,
  markMessagesRead,
  resolveSenderId,
  sendMessage,
  subscribeToConversation,
} from './dmStore';

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const BORDER = 'rgba(255,255,255,0.18)';
/** Accent blue — outbound bubbles (matches Passport FOLLOWING) */
const SENT_BLUE = '#3B82F6';
/** Subtle dark grey — inbound bubbles */
const RECV_GREY = '#1A1A1A';
const RECV_BORDER = 'rgba(255,255,255,0.12)';

function peerAvatar(peer, size = 36) {
  const name = peer?.displayName || peer?.handle || '?';
  const initials = String(name)
    .replace(/^@/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (peer?.avatarUri) {
    return (
      <Image
        source={{ uri: peer.avatarUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: WHITE,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: WHITE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: WHITE, fontWeight: '900', fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return '';
  }
}

function MessageBubble({ item, mine }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
          {formatTime(item.createdAt)}
          {mine && item.read ? ' · Read' : ''}
        </Text>
      </View>
    </View>
  );
}

/**
 * @param {{
 *   visible: boolean,
 *   peer: object|null,
 *   onClose: () => void,
 * }} props
 */
export default function DMChatSheet({ visible, peer, onClose }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [senderId, setSenderId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const peerId = peer?.id || peer?.userId || null;
  const handle = peer?.handle
    ? peer.handle.startsWith('@')
      ? peer.handle
      : `@${String(peer.handle).replace(/^@/, '')}`
    : '@athlete';

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToEnd?.({ animated });
      } catch (_) {
        /* ignore */
      }
    });
  }, []);

  const mergeMessage = useCallback((msg) => {
    if (!msg?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      // Drop optimistic twin with same text/sender near same second
      const withoutDup = prev.filter(
        (m) =>
          !(
            m.local &&
            m.senderId === msg.senderId &&
            m.text === msg.text &&
            Math.abs(new Date(m.createdAt) - new Date(msg.createdAt)) < 5000
          )
      );
      return [...withoutDup, msg].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    });
    scrollToEnd(true);
  }, [scrollToEnd]);

  useEffect(() => {
    if (!visible || !peerId) return undefined;
    let cancelled = false;
    let unsub = () => {};

    (async () => {
      setLoading(true);
      setDraft('');
      const me = await resolveSenderId();
      if (cancelled) return;
      setSenderId(me);

      const { messages: history } = await fetchMessageHistory(me, peerId);
      if (cancelled) return;
      setMessages(history);
      setLoading(false);
      scrollToEnd(false);
      markMessagesRead(peerId, { senderId: me }).catch(() => {});

      unsub = subscribeToConversation(me, peerId, (msg) => {
        if (cancelled) return;
        // Skip echo of our own insert if already present
        mergeMessage(msg);
        if (msg.receiverId === me) {
          markMessagesRead(peerId, { senderId: me }).catch(() => {});
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [visible, peerId, mergeMessage, scrollToEnd]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !peerId || sending) return;
    setSending(true);
    setDraft('');
    try {
      const { message } = await sendMessage(peerId, text, { senderId });
      if (message) mergeMessage(message);
    } finally {
      setSending(false);
    }
  };

  if (!peer) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {peerAvatar(peer, 40)}
            <View style={styles.headerMeta}>
              <UserHandle
                handle={handle}
                verified={peer.verified ?? isHandleVerified(handle)}
                size={15}
                color={WHITE}
              />
              {peer.displayName ? (
                <Text style={styles.headerSub} numberOfLines={1}>
                  {peer.displayName}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Close message"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={SENT_BLUE} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollToEnd(false)}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptySub}>
                    Send the first DM to {handle}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <MessageBubble item={item} mine={item.senderId === senderId} />
              )}
              keyboardShouldPersistTaps="handled"
            />
          )}

          <View
            style={[
              styles.composer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={MUTED}
              multiline
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={onSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={onSend}
              disabled={!draft.trim() || sending}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Text style={styles.sendBtnText}>{sending ? '…' : 'SEND'}</Text>
            </TouchableOpacity>
          </View>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  headerSub: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  close: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
  },
  bubbleRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: SENT_BLUE,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: RECV_GREY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RECV_BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  bubbleTextMine: {
    color: WHITE,
  },
  bubbleTime: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.72)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: SURFACE,
  },
  sendBtn: {
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendBtnText: {
    color: BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
