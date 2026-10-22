import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import BrandHeader from './BrandHeader';
import { useMainTabs } from './mainTabContext';

export default function ProfileScreen({ navigation }) {
  const { openProfileGateway } = useMainTabs();

  return (
    <View style={styles.container}>
      <BrandHeader
        screenName="PASSPORT"
        onBrandPress={openProfileGateway}
        rightSlot={
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.navigate?.('Arena')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close passport"
          >
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>R</Text>
            </View>
            <View style={styles.profileDetails}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.userName}>Rohit_VK7</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ SCOUT VERIFIED</Text>
                </View>
              </View>
              <Text style={styles.handleText}>@rohit_vk7 • Virar Boxing Club</Text>
              <Text style={styles.bioText}>Combat Sports Athlete & Striker</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCol, styles.statBoxPts]}>
              <Text style={styles.statNumber}>3,850</Text>
              <Text style={styles.statLabel}>BAWAAL PTS</Text>
            </View>
            <View style={[styles.statCol, styles.statBoxRank]}>
              <Text style={styles.statNumber}>#1</Text>
              <Text style={styles.statLabel}>VIRAR RANK</Text>
            </View>
            <View style={[styles.statCol, styles.statBoxWins]}>
              <Text style={styles.statNumber}>18</Text>
              <Text style={styles.statLabel}>BATTLES WON</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>AI FORM & SCOUTING METRICS</Text>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Strike Velocity & Speed</Text>
              <Text style={[styles.metricValue, styles.metricValueVelocity]}>94 / 100</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  styles.progressBarVelocity,
                  { width: '94%' },
                ]}
              />
            </View>
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Stamina & Form Check Score</Text>
              <Text style={[styles.metricValue, styles.metricValueStamina]}>88 / 100</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  styles.progressBarStamina,
                  { width: '88%' },
                ]}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#E5E5E5',
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '900',
  },
  profileDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(255,87,34,0.15)',
    borderWidth: 1,
    borderColor: '#FF5722',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: {
    color: '#FF5722',
    fontSize: 9,
    fontWeight: '800',
  },
  handleText: {
    color: '#A0A0A0',
    fontSize: 12,
    marginTop: 4,
  },
  bioText: {
    color: '#E5E5E5',
    fontSize: 13,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCol: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statBoxPts: {
    backgroundColor: '#000000',
    borderColor: '#FF5722',
  },
  statBoxRank: {
    backgroundColor: '#000000',
    borderColor: '#A0A0A0',
  },
  statBoxWins: {
    backgroundColor: '#000000',
    borderColor: '#A0A0A0',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: '#A0A0A0',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  metricsCard: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  metricsTitle: {
    color: '#FF5722',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 16,
  },
  metricItem: {
    marginBottom: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#E5E5E5',
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricValueVelocity: { color: '#FF5722' },
  metricValueStamina: { color: '#A0A0A0' },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarVelocity: { backgroundColor: '#FF5722' },
  progressBarStamina: { backgroundColor: '#A0A0A0' },
});
