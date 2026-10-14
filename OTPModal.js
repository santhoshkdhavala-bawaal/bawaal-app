import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Image } from 'react-native';

export default function OTPModal({ visible, onVerify }) {
  const [otp, setOtp] = useState('');

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image
            source={require('./assets/gold b solo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Phone Verification 🔐</Text>
          <Text style={styles.subtitle}>Enter the 6-digit OTP sent to your registered mobile number</Text>

          <TextInput 
            style={styles.otpInput} 
            placeholder="• • • • • •" 
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(txt) => setOtp(txt)}
          />

          <TouchableOpacity 
            style={[styles.verifyBtn, otp.length < 6 && styles.verifyBtnDisabled]} 
            onPress={() => onVerify(otp)}
            disabled={otp.length < 6}
          >
            <Text style={styles.verifyBtnText}>VERIFY & ENTER ARENA 🏆</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn}>
            <Text style={styles.resendText}>Didn't receive code? <Text style={styles.resendHighlight}>Resend OTP</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: '#0f172a', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#f59e0b' },
  logo: { width: 64, height: 64, marginBottom: 12 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  otpInput: { width: '85%', backgroundColor: '#1e293b', borderRadius: 12, color: '#f59e0b', fontSize: 26, fontWeight: 'bold', textAlign: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#f59e0b', letterSpacing: 8 },
  verifyBtn: { width: '100%', backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 22 },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  resendBtn: { marginTop: 16 },
  resendText: { color: '#94a3b8', fontSize: 12 },
  resendHighlight: { color: '#38bdf8', fontWeight: 'bold' }
});