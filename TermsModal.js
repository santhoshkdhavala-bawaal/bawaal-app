import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import BackLink from './src/components/BackLink';
import { injectWebScrollbarStyles } from './src/styles/injectWebScrollbar';

if (Platform.OS === 'web') {
  injectWebScrollbarStyles();
}

export default function TermsModal({ visible, onAgree, onBack }) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.goldGlowCard}>
          <ScrollView
            style={styles.termsScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS !== 'web'}
            // RN-Web maps className onto the overflow node for CSS scrollbar hooks
            {...(Platform.OS === 'web'
              ? { className: 'bawaal-terms-scroll' }
              : null)}
          >
            {/* Header Logo */}
            <View style={styles.logoHeader}>
              <Image
                source={require('./assets/BAWAAL_white_full.png')}
                style={styles.headerLogo}
                resizeMode="contain"
                accessibilityLabel="BAWAAL"
              />
              <Image
                source={require('./assets/BAWAAL_text.png')}
                style={styles.taglineLogo}
                resizeMode="contain"
                accessibilityLabel="own your chaos"
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

            <View style={styles.btnCol}>
              <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
                <Text style={styles.agreeText}>I AGREE & ENTER</Text>
              </TouchableOpacity>
              <BackLink label="Back" onPress={onBack} />
            </View>
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 10,
    justifyContent: 'center',
  },
  goldGlowCard: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF6600',
    padding: 12,
  },
  termsScroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: { paddingBottom: 30 },
  logoHeader: { alignItems: 'center', marginBottom: 12 },
  headerLogo: { width: 240, height: 72 },
  taglineLogo: { width: 160, height: 24, marginTop: 4 },
  subtitle: { color: '#A0A0A0', fontSize: 12, marginTop: 8, fontWeight: '600' },
  sectionCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.35)',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FF6600',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 6,
  },
  warningTitle: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
  },
  bodyText: { color: '#E8ECE9', fontSize: 12, lineHeight: 18 },
  highlight: { color: '#FF6600', fontWeight: 'bold' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 102, 0, 0.25)',
    marginVertical: 10,
  },
  btnCol: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  agreeBtn: {
    width: '100%',
    backgroundColor: '#FF6600',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  agreeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});