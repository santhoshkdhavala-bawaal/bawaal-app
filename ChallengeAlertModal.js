import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';

const BG = '#000000';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#FF5722';

/**
 * Challenge alert popup from center + BATTLE FAB when an active alert exists.
 */
export default function ChallengeAlertModal({
  visible,
  challenge,
  onAccept,
  onDecline,
  onClose,
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!challenge) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Animated.Text style={[styles.thunder, { transform: [{ scale: pulse }] }]}>
            ⚡
          </Animated.Text>
          <Text style={styles.eyebrow}>INCOMING BATTLE ALERT</Text>
          <Text style={styles.handle}>{challenge.handle || '@Rival_IN'}</Text>
          <Text style={styles.sport}>{challenge.sport || 'GYM'}</Text>
          <Text style={styles.detail}>
            {challenge.detail || challenge.target || 'Open challenge'}
          </Text>

          <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.85} onPress={onAccept}>
            <Text style={styles.acceptText}>ACCEPT & RECORD</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} activeOpacity={0.85} onPress={onDecline}>
            <Text style={styles.declineText}>DECLINE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ACCENT,
    padding: 22,
    alignItems: 'center',
  },
  thunder: {
    fontSize: 36,
    marginBottom: 6,
  },
  eyebrow: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  handle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
  },
  sport: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  detail: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 22,
    lineHeight: 22,
  },
  acceptBtn: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  acceptText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  declineBtn: {
    width: '100%',
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUTED,
    paddingVertical: 13,
    alignItems: 'center',
  },
  declineText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
