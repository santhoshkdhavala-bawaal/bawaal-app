/**
 * Targeted LIVE invite alert — only rendered for invited users.
 */
import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { INVITE_TTL_MS } from '../services/liveMatchService';

const BG = '#08120F';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';

function LiveMatchInviteBanner({ invite, onWatch, onDismiss }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!invite) return undefined;
    const remaining = Math.max(
      2500,
      Number(invite.expiresAt || Date.now() + INVITE_TTL_MS) - Date.now()
    );
    const timer = setTimeout(() => {
      onDismiss?.(invite);
    }, remaining);
    return () => clearTimeout(timer);
  }, [invite, onDismiss]);

  if (!invite) return null;

  const inviter = String(
    invite.inviterHandle || invite.hostHandle || 'fan'
  ).replace(/^@/, '');
  const sport = String(invite.sport || 'LIVE').toUpperCase();
  const line =
    invite.hasScoreboard === false
      ? `${sport} TELECAST`
      : `${invite.teamA || 'TEAM A'} vs ${invite.teamB || 'TEAM B'}`;

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) + 4 }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>
            @{inviter} invited you to LIVE {sport}: {line}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.watchBtn}
          onPress={() => onWatch?.(invite)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Watch live match"
        >
          <Text style={styles.watchText}>WATCH</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => onDismiss?.(invite)}
          hitSlop={10}
          accessibilityLabel="Dismiss invite"
        >
          <Ionicons name="close" size={18} color={MUTED} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center', width: '100%' },
      default: {},
    }),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  watchBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  watchText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(LiveMatchInviteBanner);
