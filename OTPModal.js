/**
 * Standalone OTP modal — stealth black, B solo watermark, no white framing.
 * Locked to 4-digit OTPInput; verify only via SUBMIT / VERIFY (no auto-submit).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BawaalPromptModal from './src/components/BawaalPromptModal';
import OTPInput, { OTP_LENGTH, emptyOtpDigits } from './OTPInput';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const LOGO = require('./assets/BAWAAL_B_solo.png');

function OTPModalBody({ onVerify, onNotice }) {
  const insets = useSafeAreaInsets();
  const [otpDigits, setOtpDigits] = useState(emptyOtpDigits);

  /** Manual verify only — never triggered by completing the 4th digit. */
  const handleVerify = () => {
    const otp = otpDigits.join('');
    if (otp.length < OTP_LENGTH) {
      onNotice?.({
        title: 'Invalid OTP',
        message: `Please enter the complete ${OTP_LENGTH}-digit verification code.`,
      });
      return;
    }
    onVerify?.(otp);
  };

  return (
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
          Enter the {OTP_LENGTH}-digit OTP sent to your registered mobile number
        </Text>

        <View style={styles.otpWrap}>
          <OTPInput digits={otpDigits} onChangeDigits={setOtpDigits} />
        </View>

        <TouchableOpacity
          style={[
            styles.verifyBtn,
            otpDigits.join('').length < OTP_LENGTH && styles.verifyBtnDisabled,
          ]}
          onPress={handleVerify}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Submit verify OTP"
        >
          <Text style={styles.verifyBtnText}>SUBMIT / VERIFY</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} activeOpacity={0.75}>
          <Text style={styles.resendText}>
            {"Didn't receive code? "}
            <Text style={styles.resendHighlight}>Resend OTP</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function OTPModal({ visible, onVerify }) {
  const [notice, setNotice] = useState(null);

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent>
        {visible ? (
          <OTPModalBody
            key="otp-session"
            onVerify={onVerify}
            onNotice={setNotice}
          />
        ) : null}
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
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    borderWidth: 0,
    margin: 0,
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
    elevation: 0,
    shadowOpacity: 0,
  },
  watermark: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 140,
    height: 140,
    opacity: 0.06,
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
  otpWrap: {
    marginBottom: 8,
    alignItems: 'center',
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
