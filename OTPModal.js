import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Image } from 'react-native';

const LANDING_BG = '#000000';
const GOLD = '#FFD700';
const CRIMSON = '#FF2A5F';

export default function OTPModal({ visible, onVerify }) {
  const [otp, setOtp] = useState('');

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image
            source={require('./assets/explosive_golden_bawaal_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Phone Verification</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit OTP sent to your registered mobile number
          </Text>

          <TextInput
            style={styles.otpInput}
            placeholder="• • • • • •"
            placeholderTextColor="#5A7268"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(txt) => setOtp(txt)}
          />

          <TouchableOpacity
            style={[styles.verifyBtn, otp.length < 6 && styles.verifyBtnDisabled]}
            onPress={() => onVerify(otp)}
            disabled={otp.length < 6}
          >
            <Text style={styles.verifyBtnText}>VERIFY & ENTER ARENA</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn}>
            <Text style={styles.resendText}>
              Didn't receive code? <Text style={styles.resendHighlight}>Resend OTP</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: LANDING_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GOLD,
  },
  logo: { width: 140, height: 70, marginBottom: 12 },
  title: { color: GOLD, fontSize: 20, fontWeight: 'bold' },
  subtitle: {
    color: '#8BA89A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  otpInput: {
    width: '85%',
    backgroundColor: '#0A0C10',
    borderRadius: 12,
    color: GOLD,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: GOLD,
    letterSpacing: 8,
  },
  verifyBtn: {
    width: '100%',
    backgroundColor: CRIMSON,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: GOLD,
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  resendBtn: { marginTop: 16 },
  resendText: { color: '#8BA89A', fontSize: 12 },
  resendHighlight: { color: GOLD, fontWeight: 'bold' },
});
