/**
 * Quick DM share picker — send a reel/challenge deep-link to BAWAAL users.
 * Soft-fails offline via dmStore local threads.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOLLOWING, SUGGESTED, isHandleVerified } from '../data/athleteSocial';
import { sendMessage } from '../../dmStore';
import UserHandle from './UserHandle';

const BG = '#0b0b0b';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';

function buildReelShareBody(reel) {
  const postId = reel?.id != null ? String(reel.id) : '';
  const handle = String(reel?.author || reel?.handle || 'athlete').replace(
    /^@/,
    ''
  );
  const caption = String(reel?.caption || reel?.target || 'BAWAAL reel').slice(
    0,
    80
  );
  return postId
    ? `BAWAAL drop from @${handle}: ${caption}\nhttps://bawaal.app/reel/${postId}`
    : `BAWAAL drop from @${handle}: ${caption}`;
}

function DmSharePicker({ visible, reel, onClose, onSent }) {
  const insets = useSafeAreaInsets();
  const [sendingId, setSendingId] = useState(null);
  const [status, setStatus] = useState('');

  const recipients = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const row of [...FOLLOWING, ...SUGGESTED]) {
      const id = String(row.id || row.handle || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push(row);
    }
    return list;
  }, []);

  const sendTo = useCallback(
    async (athlete) => {
      if (!athlete || sendingId) return;
      const receiverId = String(athlete.id || athlete.handle || '').trim();
      if (!receiverId) return;
      setSendingId(receiverId);
      setStatus('');
      try {
        const body = buildReelShareBody(reel);
        const result = await sendMessage(receiverId, body);
        if (result?.message) {
          setStatus(`Sent to ${athlete.handle || athlete.displayName}`);
          try {
            onSent?.(athlete, result.message);
          } catch (_) {
            /* ignore */
          }
          setTimeout(() => {
            onClose?.();
            setStatus('');
          }, 450);
        } else {
          setStatus('Could not send — try again');
        }
      } catch (_) {
        setStatus('Could not send — try again');
      } finally {
        setSendingId(null);
      }
    },
    [reel, sendingId, onClose, onSent]
  );

  const keyExtractor = useCallback((item) => String(item.id), []);
  const renderItem = useCallback(
    ({ item }) => {
      const busy = sendingId === String(item.id);
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => sendTo(item)}
          activeOpacity={0.85}
          disabled={!!sendingId}
          accessibilityRole="button"
          accessibilityLabel={`Send to ${item.handle}`}
        >
          <View style={styles.rowMeta}>
            <Text style={styles.name}>{item.displayName || item.handle}</Text>
            <UserHandle
              handle={item.handle}
              verified={item.verified ?? isHandleVerified(item.handle)}
              size={11}
              color={MUTED}
              badgeSize={12}
            />
          </View>
          {busy ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <Text style={styles.sendChip}>SEND</Text>
          )}
        </TouchableOpacity>
      );
    },
    [sendTo, sendingId]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>SEND VIA DM</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sub} numberOfLines={2}>
            Share this reel directly to a BAWAAL athlete
          </Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <FlatList
            data={recipients}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

export default memo(DmSharePicker);
export { buildReelShareBody };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    maxHeight: '58%',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  close: { color: WHITE, fontSize: 18, fontWeight: '700' },
  sub: {
    color: MUTED,
    fontSize: 11,
    marginBottom: 10,
  },
  status: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  list: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,87,34,0.25)',
  },
  rowMeta: { flex: 1, paddingRight: 10 },
  name: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  sendChip: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
