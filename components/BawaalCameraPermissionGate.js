/**
 * Tactical BAWAAL camera / mic permission gate.
 * Used by UniversalCamera when expo-camera permissions are pending or denied.
 * Live lens chrome stays locked elsewhere — this screen is pre-lens only.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';

const BG = '#000000';
const ORANGE = '#FF5500';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';

export const BawaalCameraPermissionGate = memo(function BawaalCameraPermissionGate({
  pending = false,
  onRequestPermissions,
  onClose,
}) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {onClose ? (
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Text style={styles.closeText}>✕ CANCEL</Text>
        </TouchableOpacity>
      ) : null}

      <Image
        source={require('../assets/BAWAAL_white_full.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="BAWAAL"
      />

      <Text style={styles.kicker}>CAMERA PIPELINE</Text>
      <Text style={styles.title}>
        {pending ? 'ARMING THE LENS…' : 'PERMISSIONS REQUIRED'}
      </Text>
      <Text style={styles.body}>
        {pending
          ? 'Requesting camera and microphone access for battle clips.'
          : 'BAWAAL needs Camera + Microphone to record challenges, heavy-bag clips, and Arena drops.'}
      </Text>

      {pending ? (
        <ActivityIndicator color={ORANGE} size="large" style={styles.spinner} />
      ) : (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            try {
              onRequestPermissions?.();
            } catch (_) {
              /* ignore */
            }
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Grant camera and microphone permissions"
        >
          <Text style={styles.ctaText}>GRANT PERMISSION</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>Stealth black · Electric orange · Zero clutter</Text>
    </View>
  );
});

export default BawaalCameraPermissionGate;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  logo: {
    width: 180,
    height: 56,
    marginBottom: 8,
  },
  kicker: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  body: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 8,
  },
  spinner: {
    marginTop: 12,
  },
  cta: {
    marginTop: 8,
    backgroundColor: ORANGE,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  ctaText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
  },
});
