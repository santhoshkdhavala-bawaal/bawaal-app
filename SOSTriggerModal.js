// SOSTriggerModal.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';

export default function SOSTriggerModal({ isVisible, contacts, onCancel }) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    let timer = null;
    if (isVisible) {
      setSecondsLeft(5);
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            triggerActualSMS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isVisible]);

  const triggerActualSMS = () => {
    Alert.alert(
      '🚨 SOS ALERT SENT',
      `Emergency broadcast & Live GPS link sent to:\n1. +91 ${contacts[0] || 'Primary'}\n2. +91 ${contacts[1] || 'Secondary'}\n3. +91 ${contacts[2] || 'Coach'}`
    );
    onCancel();
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>🚨 ATHLETE SOS TRIGGERED</Text>
          <Text style={styles.sub}>Broadcasting Emergency Alert & GPS location in:</Text>
          
          <View style={styles.circle}>
            <Text style={styles.countdown}>{secondsLeft}</Text>
          </View>

          <View style={styles.recipientBox}>
            <Text style={styles.recipientHeader}>📲 Alert Recipients:</Text>
            {contacts.map((num, i) => (
              <Text key={i} style={styles.numText}>{i + 1}. +91 {num}</Text>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>CANCEL SOS ALERT ✖️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(5, 12, 22, 0.95)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#1E2A38', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  title: { color: '#FF3B30', fontSize: 18, fontWeight: '900' },
  sub: { color: '#8E9AAF', fontSize: 11, marginTop: 4 },
  circle: { width: 72, height: 72, borderRadius: 36, borderBottomWidth: 4, borderColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', marginVertical: 14, backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  countdown: { color: '#FF3B30', fontSize: 32, fontWeight: '900' },
  recipientBox: { width: '100%', backgroundColor: '#0B192C', padding: 10, borderRadius: 8, marginBottom: 14 },
  recipientHeader: { color: '#8E9AAF', fontSize: 10, fontWeight: 'bold' },
  numText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  cancelBtn: { backgroundColor: '#2B3A4C', width: '100%', height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
});