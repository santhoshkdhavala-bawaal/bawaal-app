/**
 * Host INVITE drawer — pick athletes or share match code/link.
 * Theme: #08120F / #FF5A1F
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchLiveInviteAthletes,
  sendLiveMatchInvites,
  getLiveMatchInviteCode,
  buildLiveMatchInviteLink,
} from '../services/liveMatchService';
import { getActiveUser } from '../services/activeUserProfile';

const BG = '#08120F';
const CARD = '#0F1A16';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const INPUT = '#12201B';

async function copyText(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    }
  } catch (_) {
    /* fall through */
  }
  try {
    await Share.share({ message: value });
    return true;
  } catch (_) {
    return false;
  }
}

function LiveMatchInviteModal({ visible, match, onClose }) {
  const [query, setQuery] = useState('');
  const [athletes, setAthletes] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const code = getLiveMatchInviteCode(match);
  const link = buildLiveMatchInviteLink(match);

  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      void searchLiveInviteAthletes(query)
        .then((list) => {
          if (!alive) return;
          setAthletes(Array.isArray(list) ? list : []);
          setLoading(false);
        })
        .catch(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [visible, query]);

  const toggle = useCallback((athlete) => {
    const key = `${athlete.id}|${athlete.handle}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = athlete;
      return next;
    });
  }, []);

  const selectedList = Object.values(selected);

  const handleSend = useCallback(async () => {
    if (!match?.id || selectedList.length === 0 || sending) return;
    setSending(true);
    setStatus('');
    try {
      const sender = getActiveUser();
      const result = await sendLiveMatchInvites({
        match,
        sender,
        host: sender,
        recipients: selectedList,
      });
      setStatus(
        result?.ok
          ? `Sent ${result.sent || selectedList.length} invite${
              (result.sent || selectedList.length) === 1 ? '' : 's'
            }`
          : 'Invite soft-failed — try share code'
      );
      setSelected({});
    } finally {
      setSending(false);
    }
  }, [match, selectedList, sending]);

  const handleCopyCode = useCallback(async () => {
    const ok = await copyText(`BAWAAL LIVE CODE: ${code}\n${link}`);
    setStatus(ok ? 'Code copied / share sheet opened' : 'Could not copy');
  }, [code, link]);

  const handleShare = useCallback(async () => {
    const message = `Join my BAWAAL LIVE ${String(
      match?.sport || 'MATCH'
    ).toUpperCase()} — code ${code}\n${link}`;
    try {
      await Share.share({ message, title: 'BAWAAL LIVE Invite' });
      setStatus('Share sheet opened');
    } catch (_) {
      await handleCopyCode();
    }
  }, [match?.sport, code, link, handleCopyCode]);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity
          style={styles.scrimHit}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>INVITE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={WHITE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>INVITE APP ATHLETES</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search handle or name"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {loading ? (
            <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} />
          ) : (
            <FlatList
              data={athletes}
              keyExtractor={(item) => `${item.id}-${item.handle}`}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const key = `${item.id}|${item.handle}`;
                const on = !!selected[key];
                return (
                  <TouchableOpacity
                    style={[styles.athleteRow, on && styles.athleteRowOn]}
                    onPress={() => toggle(item)}
                    activeOpacity={0.88}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.athleteName} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.athleteHandle} numberOfLines={1}>
                        @{item.handle}
                        {item.sport ? ` · ${item.sport}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={on ? ORANGE : MUTED}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>No athletes found</Text>
              }
            />
          )}

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (sending || selectedList.length === 0) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={sending || selectedList.length === 0}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.sendBtnText}>
                SEND INVITE
                {selectedList.length ? ` (${selectedList.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.section, { marginTop: 18 }]}>
            SHARE MATCH CODE / LINK
          </Text>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>6-CHARACTER CODE</Text>
            <Text style={styles.codeValue} selectable>
              {code}
            </Text>
            <Text style={styles.linkValue} numberOfLines={2}>
              {link}
            </Text>
            <TouchableOpacity
              style={styles.copyShareBtn}
              onPress={async () => {
                await handleCopyCode();
                await handleShare();
              }}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Copy and share invite code"
            >
              <Text style={styles.copyShareBtnText}>COPY / SHARE</Text>
            </TouchableOpacity>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  scrimHit: { flex: 1 },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center', width: '100%' },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  section: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: INPUT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    outlineStyle: 'none',
  },
  list: {
    maxHeight: 200,
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: CARD,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  athleteRowOn: {
    borderColor: 'rgba(255,90,31,0.55)',
    backgroundColor: 'rgba(255,90,31,0.1)',
  },
  athleteName: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },
  athleteHandle: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    color: MUTED,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sendBtn: {
    marginTop: 12,
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  codeCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.28)',
  },
  codeLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  codeValue: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
  },
  linkValue: {
    color: MUTED,
    fontSize: 11,
    marginTop: 6,
  },
  copyShareBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: WHITE,
    backgroundColor: ORANGE,
  },
  copyShareBtnText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  status: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default memo(LiveMatchInviteModal);
