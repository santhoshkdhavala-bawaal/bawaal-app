/**
 * Standalone OTP modal — stealth black, B solo watermark, no white framing.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BawaalPromptModal from './src/components/BawaalPromptModal';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const HAIRLINE = 'rgba(255,255,255,0.72)';
const LOGO = require('./assets/BAWAAL_B_solo.png');

export default function OTPModal({ visible, onVerify }) {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState(null);

  const handleVerify = () => {
    if (String(otp || '').trim().length < 6) {
      setNotice({
        title: 'Invalid OTP',
        message: 'Please enter the complete 6-digit verification code.',
      });
      return;
    }
    onVerify?.(otp);
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={[
            styles.overlay,
            { paddingBottom: Math.max(48, insets.bottom + 40) },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[
              styles.card,
              { paddingBottom: Math.max(48, insets.bottom + 36) },
            ]}
          >
            <Image
              source={LOGO}
              style={styles.watermark}
              resizeMode="contain"
              pointerEvents="none"
            />
            <Image
              source={LOGO}
              style={styles.logo}
              resizeMode="contain"
              tintColor={WHITE}
            />
            <Text style={styles.brand}>BAWAAL</Text>
            <Text style={styles.title}>VERIFY MOBILE NUMBER</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit OTP sent to your registered mobile number
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="• • • • • •"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              selectionColor={WHITE}
              blurOnSubmit
            />

            <TouchableOpacity
              style={[styles.verifyBtn, otp.length < 6 && styles.verifyBtnDisabled]}
              onPress={handleVerify}
              activeOpacity={0.85}
            >
              <Text style={styles.verifyBtnText}>VERIFY & ENTER ARENA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendBtn} activeOpacity={0.75}>
              <Text style={styles.resendText}>
                Didn't receive code? <Text style={styles.resendHighlight}>Resend OTP</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BawaalPromptModal
        visible={Boolean(notice)}
        mode="notice"
        title={notice?.title || 'BAWAAL'}
        message={notice?.message || ''}
        onCancel={() => setNotice(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  card: {
    width: '90%',
    backgroundColor: BG,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: -10,
    right: -8,
    width: 160,
    height: 160,
    opacity: 0.07,
  },
  logo: {
    width: 28,
    height: 28,
    marginBottom: 10,
  },
  brand: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3.2,
    marginBottom: 14,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  subtitle: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 18,
  },
  otpInput: {
    width: '88%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
    color: WHITE,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 12,
    letterSpacing: 8,
  },
  verifyBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  verifyBtnDisabled: { opacity: 0.45 },
  verifyBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  resendBtn: { marginTop: 14, marginBottom: 8 },
  resendText: { color: MUTED, fontSize: 12 },
  resendHighlight: { color: WHITE, fontWeight: '800' },
});
