import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, SafeAreaView, Alert } from 'react-native';

export default function VideoFeed({ userRole, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sosModal, setSosModal] = useState(false);

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.goldGlowCard}>
        
        {/* Header Section: Solo Logo + Clean Round SOS Button Below It */}
        <View style={styles.header}>
          <View style={styles.rightHeaderStack}>
            
            {/* Solo Logo Menu Trigger */}
            <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
              <Image
                source={require('./assets/gold b solo.png')}
                style={styles.logoBadge}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Dedicated Round SOS Emergency Button */}
            <TouchableOpacity style={styles.roundSosBtn} onPress={() => setSosModal(true)}>
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Stream Content */}
        <View style={styles.feedContent}>
          <Text style={styles.streamTitle}>🔥 BAWAAL ARENA STREAM</Text>
          <Text style={styles.streamSubtitle}>[ Video Stream: Rohan Sharma - Shadowboxing Speed Drills ]</Text>

          {/* Dynamic Actions Sidebar */}
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionEmoji}>🔥</Text>
              <Text style={styles.actionText}>1.4k</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionEmoji}>💬</Text>
              <Text style={styles.actionText}>89</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionEmoji}>🚀</Text>
              <Text style={styles.actionText}>34</Text>
            </TouchableOpacity>

            {/* Special Scout Action Button */}
            {userRole === 'scout' && (
              <TouchableOpacity style={[styles.actionBtn, styles.scoutActionBtn]}>
                <Text style={styles.actionEmoji}>🔍</Text>
                <Text style={styles.scoutActionText}>SCOUT</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Dropdown Menu Modal */}
        <Modal visible={menuOpen} transparent={true} animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
            <View style={styles.dropdownMenu}>
              <Text style={styles.menuHeader}>BAWAAL MENU 🏆</Text>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuText}>👤 My Profile & Stats</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuText}>⚙️ App Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuText}>🥊 Active Challenges</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuText}>📋 Medical Clearance Card</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={onLogout || (() => setMenuOpen(false))}>
                <Text style={[styles.menuText, { color: '#ef4444' }]}>🚪 Log Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* SOS Alert Modal */}
        <Modal visible={sosModal} transparent={true} animationType="slide">
          <View style={styles.sosOverlay}>
            <View style={styles.sosCard}>
              <Text style={styles.sosTitle}>🚨 EMERGENCY ATHLETE ASSIST</Text>
              <Text style={styles.sosDesc}>Instantly dispatch emergency alert and location to your registered emergency contact numbers.</Text>
              
              <TouchableOpacity 
                style={styles.sosTriggerBtn} 
                onPress={() => {
                  Alert.alert("SOS Dispatched", "Emergency contacts notified via SMS!");
                  setSosModal(false);
                }}
              >
                <Text style={styles.sosTriggerText}>TRIGGER SOS ALERT NOW 🚨</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSosModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#0f172a', padding: 8 },
  goldGlowCard: { 
    flex: 1, 
    backgroundColor: '#0f172a', 
    borderRadius: 24, 
    borderWidth: 2, 
    borderColor: '#f59e0b', 
    padding: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 4 },
  rightHeaderStack: { alignItems: 'center', gap: 12 },
  logoBadge: { width: 42, height: 42 },
  roundSosBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: '#ef4444', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    elevation: 4
  },
  sosText: { color: '#ffffff', fontWeight: 'bold', fontSize: 10 },
  feedContent: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  streamTitle: { color: '#f59e0b', fontSize: 18, fontWeight: 'bold' },
  streamSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  rightActions: { position: 'absolute', right: 10, bottom: 40, gap: 16, alignItems: 'center' },
  actionBtn: { alignItems: 'center' },
  scoutActionBtn: { marginTop: 8, backgroundColor: '#10b981', padding: 8, borderRadius: 12 },
  scoutActionText: { color: '#0f172a', fontSize: 9, fontWeight: 'bold' },
  actionEmoji: { fontSize: 26 },
  actionText: { color: '#f8fafc', fontSize: 11, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 20 },
  dropdownMenu: { width: 220, backgroundColor: '#1e293b', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f59e0b' },
  menuHeader: { color: '#f59e0b', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  menuItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  sosOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sosCard: { width: '100%', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#ef4444' },
  sosTitle: { color: '#ef4444', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  sosDesc: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  sosTriggerBtn: { width: '100%', backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  sosTriggerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  cancelBtn: { marginTop: 14, paddingVertical: 8 },
  cancelText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13 }
});