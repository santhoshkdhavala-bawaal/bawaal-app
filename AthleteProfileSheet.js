import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#0A0A0A';
const SURFACE = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ORANGE = '#FF5722';
const CYAN = '#00E5FF';

function AthleteProfileBody({ athlete, roleLabel, onClose, visible }) {
  const insets = useSafeAreaInsets();
  const [following, setFollowing] = useState(false);

  const handle = athlete.handle || '@ATHLETE';
  const flag = athlete.flag || '🌐';
  const label = athlete.label || athlete.country || 'OPEN';
  const initial = String(handle.replace(/^@/, '') || 'A')
    .charAt(0)
    .toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handleBar} />
          <Text style={styles.roleChip}>{roleLabel}</Text>

          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.handle}>{handle}</Text>
              <Text style={styles.region}>
                {flag} {label}
              </Text>
              <Text style={styles.stats}>
                {athlete.reps ?? 0} REPS · {athlete.votes ?? 0} VOTES
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnOn]}
            activeOpacity={0.85}
            onPress={() => setFollowing((v) => !v)}
          >
            <Text style={[styles.followBtnText, following && styles.followBtnTextOn]}>
              {following ? '✓ FOLLOWING' : '+ FOLLOW'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Compact athlete profile drawer — Follow from live rivalry bar taps.
 */
export default function AthleteProfileSheet({
  visible,
  athlete,
  roleLabel = 'ATHLETE',
  onClose,
}) {
  if (!athlete) return null;

  return (
    <AthleteProfileBody
      key={`${athlete.id || athlete.handle}-${visible ? '1' : '0'}`}
      athlete={athlete}
      roleLabel={roleLabel}
      onClose={onClose}
      visible={visible}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginBottom: 12,
  },
  roleChip: {
    alignSelf: 'flex-start',
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  heroMeta: {
    flex: 1,
  },
  handle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
  },
  region: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  stats: {
    color: CYAN,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.4,
  },
  followBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  followBtnOn: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: ORANGE,
  },
  followBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  followBtnTextOn: {
    color: ORANGE,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeBtnText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
});
