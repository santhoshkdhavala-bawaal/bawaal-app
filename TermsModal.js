import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Image } from 'react-native';
import BackLink from './src/components/BackLink';

export default function TermsModal({ visible, onAgree, onBack }) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.goldGlowCard}>
          
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Header Logo */}
            <View style={styles.logoHeader}>
              <Image
                source={require('./assets/bawaal_bolder_larger.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>Arena Philosophy & Terms of Service</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🏆 THE BAWAAL PHILOSOPHY</Text>
              <Text style={styles.bodyText}>
                BAWAAL is built to discover, empower, and showcase India's athletic talent. We stand for pure sportsmanship, mutual respect, and raw athletic grit. <Text style={styles.highlight}>No hate, no politics—just pure sports.</Text>
              </Text>

              <View style={styles.divider} />

              <Text style={styles.warningTitle}>⚠️ PERSONAL LIABILITY NOTICE</Text>
              <Text style={styles.bodyText}>
                You are entirely and solely responsible for your actions, uploads, comments, and interactions on this platform. BAWAAL and its team are nowhere responsible for your actions. If any legal action arises from your content or conduct, you alone will have to deal with it entirely.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>1. BRAND & IDENTITY PROTECTION</Text>
              <Text style={styles.bodyText}>
                The BAWAAL name, logo, design assets, and visual identity are protected brand trademarks. Unauthorized commercial use or duplication is strictly prohibited.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>2. ATHLETE SAFETY & COMBAT CONDUCT</Text>
              <Text style={styles.bodyText}>
                All combat sparring and martial arts content must adhere strictly to sportsmanship rules. Unsanctioned street fights, reckless violence, or intentional injury will result in immediate permanent profile ban.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>3. INTELLECTUAL PROPERTY & UPLOADS</Text>
              <Text style={styles.bodyText}>
                By uploading drill clips and sparring videos, you confirm you hold all rights to the media and grant BAWAAL a non-exclusive license to showcase your talent to scouts and fans.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>4. DATA PRIVACY & EMERGENCY CONTACTS</Text>
              <Text style={styles.bodyText}>
                Emergency contact numbers provided in the Medical Card are strictly encrypted and accessed only when an SOS signal is triggered during training/events.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>5. SCOUT & USER VERIFICATION</Text>
              <Text style={styles.bodyText}>
                Scouts, talent agents, and coaches must provide verified credentials and identity documents before issuing direct recruitment offers or contacting registered athletes.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>6. ACCOUNT TERMINATION & DISCIPLINARY ACTIONS</Text>
              <Text style={styles.bodyText}>
                BAWAAL reserves the absolute right to suspend or permanently ban any account found spreading hate speech, fake athletic records, harassing athletes, or violating arena decorum.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.btnRow}>
              <BackLink label="Back" onPress={onBack} />

              <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
                <Text style={styles.agreeText}>I AGREE & ENTER 🔥</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 10, justifyContent: 'center' },
  goldGlowCard: { 
    flex: 1, 
    backgroundColor: '#0f172a', 
    borderRadius: 24, 
    borderWidth: 2, 
    borderColor: '#f59e0b', 
    padding: 12,
  },
  scrollContent: { paddingBottom: 30 },
  logoHeader: { alignItems: 'center', marginBottom: 12 },
  headerLogo: { width: 220, height: 110 },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2, fontWeight: '600' },
  sectionCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#f59e0b', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  warningTitle: { color: '#ef4444', fontWeight: 'bold', fontSize: 13, marginBottom: 6, marginTop: 10 },
  bodyText: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  highlight: { color: '#f59e0b', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  backText: { color: '#3B82F6', fontWeight: '900', fontSize: 13 },
  agreeBtn: { flex: 1, backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  agreeText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 }
});