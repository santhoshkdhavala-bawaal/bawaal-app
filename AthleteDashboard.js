import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function AthleteDashboard({ selectedLang = 'English', athleteData, onBack, onSOS }) {
  // Mock data if passed from registration
  const name = athleteData?.fullName || 'Rohan "The Juggernaut" Sharma';
  const sport = athleteData?.sport || 'Professional Boxing & MMA';
  const location = athleteData?.location || 'Mumbai, India';
  const club = athleteData?.club || 'Tiger Fight Club';

  const [activeTab, setActiveTab] = useState('SHOWCASE'); // 'SHOWCASE', 'SCOUTS', 'STATS'

  return (
    <SafeAreaView style={styles.outerGlowWrapper}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← EXIT ARENA</Text>
          </TouchableOpacity>

          <Image 
            source={require('./assets/gold b solo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain" 
          />
        </View>

        {/* Holographic Athlete ID Header */}
        <View style={styles.idCard}>
          <View style={styles.idCardGlowBadge}>
            <Text style={styles.verifiedText}>⚡ VERIFIED ARENA ATHLETE</Text>
          </View>
          <Text style={styles.athleteName}>{name}</Text>
          <Text style={styles.athleteDiscipline}>{sport} • {club}</Text>
          <Text style={styles.athleteLocation}>📍 {location}</Text>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>DRILL REELS</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>489</Text>
              <Text style={styles.metricLabel}>SCOUT VIEWS</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>98%</Text>
              <Text style={styles.metricLabel}>READINESS</Text>
            </View>
          </View>
        </View>

        {/* Command Navigation Tabs */}
        <View style={styles.tabRow}>
          {['SHOWCASE', 'SCOUT RADAR', 'TELEMETRY'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content Section based on active tab */}
        {activeTab === 'SHOWCASE' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>FEATURED ARENA REEL</Text>
            
            {/* Custom Cyber-Arena Video Card (Not Insta Style) */}
            <View style={styles.videoCard}>
              <View style={styles.videoThumbnailPlaceholder}>
                <View style={styles.playButtonCircle}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
                <View style={styles.videoBadgeTag}>
                  <Text style={styles.videoBadgeText}>SPARRING SESSION #04</Text>
                </View>
              </View>
              <View style={styles.videoInfoRow}>
                <View>
                  <Text style={styles.videoTitle}>Heavy Bag Power & Counter Combinations</Text>
                  <Text style={styles.videoSub}>Recorded Live at {club}</Text>
                </View>
                <TouchableOpacity style={styles.uploadNewBtn}>
                  <Text style={styles.uploadNewText}>+ UPLOAD</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Secondary Showcase Cards */}
            <View style={styles.drillGrid}>
              <View style={styles.smallDrillCard}>
                <Text style={styles.drillCardTitle}>Pad Work Drills</Text>
                <Text style={styles.drillCardMeta}>3 mins • 42 views</Text>
              </View>
              <View style={styles.smallDrillCard}>
                <Text style={styles.drillCardTitle}>Grappling Escapes</Text>
                <Text style={styles.drillCardMeta}>5 mins • 88 views</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'SCOUT RADAR' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>INCOMING SCOUT INVITATIONS</Text>
            <View style={styles.scoutCard}>
              <View style={styles.scoutInfo}>
                <Text style={styles.scoutName}>Global Fight League (GFL)</Text>
                <Text style={styles.scoutRole}>Interested in your striking metrics</Text>
              </View>
              <TouchableOpacity style={styles.acceptInviteBtn}>
                <Text style={styles.acceptInviteText}>CONNECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'TELEMETRY' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>MEDICAL & PHYSICAL STATUS</Text>
            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryItem}>🩸 Blood Group: <Text style={styles.telemetryValue}>O+ Positive</Text></Text>
              <Text style={styles.telemetryItem}>⚖️ Weight Class: <Text style={styles.telemetryValue}>Middleweight (75 kg)</Text></Text>
              <Text style={styles.telemetryItem}>🛡️ Medical Clearance: <Text style={[styles.telemetryValue, { color: '#22c55e' }]}>ACTIVE & VERIFIED</Text></Text>
            </View>
          </View>
        )}

        {/* Permanent SOS Emergency Lifeline Button */}
        <TouchableOpacity style={styles.sosBtn} onPress={onSOS} activeOpacity={0.85}>
          <Text style={styles.sosBtnText}>🚨 SOS - EMERGENCY ARENA SUPPORT</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerGlowWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#0a0f1d',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 11,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  idCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  idCardGlowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.150)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 10,
  },
  verifiedText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  athleteName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  athleteDiscipline: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  athleteLocation: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#1f2937',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#f59e0b',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  sectionContainer: {
    marginBottom: 25,
  },
  sectionHeader: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  videoCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  videoThumbnailPlaceholder: {
    height: 180,
    backgroundColor: '#1a2234',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  playIcon: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 3,
  },
  videoBadgeTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  videoBadgeText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
  },
  videoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  videoTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: width * 0.6,
  },
  videoSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  uploadNewBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  uploadNewText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
  },
  drillGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  smallDrillCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginRight: 6,
  },
  drillCardTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  drillCardMeta: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
  },
  scoutCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoutName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '900',
  },
  scoutRole: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  acceptInviteBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  acceptInviteText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '900',
  },
  telemetryCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
  },
  telemetryItem: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '700',
  },
  telemetryValue: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  sosBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  sosBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});