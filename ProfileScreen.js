import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <StatusBar barStyle="light-content" backgroundColor="#05070A" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/BAWAAL_text.png')}
            style={styles.wordmarkLogo}
          />
          <Text style={styles.headerAccent}>PASSPORT</Text>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
              return;
            }
            navigation?.navigate?.('Arena');
          }}
        >
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Info Card */}
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
              <Text style={styles.bioText}>🥊 Combat Sports Athlete & Striker</Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>3,850</Text>
              <Text style={styles.statLabel}>BAWAAL PTS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>#1</Text>
              <Text style={styles.statLabel}>VIRAR RANK</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>18</Text>
              <Text style={styles.statLabel}>BATTLES WON</Text>
            </View>
          </View>
        </View>

        {/* AI Scouting Metrics */}
        <View style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>⚡ AI FORM & SCOUTING METRICS</Text>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Strike Velocity & Speed</Text>
              <Text style={styles.metricValue}>94 / 100</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '94%' }]} />
            </View>
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Stamina & Form Check Score</Text>
              <Text style={styles.metricValue}>88 / 100</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '88%' }]} />
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
    backgroundColor: '#05070A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232630',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkLogo: {
    width: 95,
    height: 20,
    resizeMode: 'contain',
  },
  headerAccent: {
    color: '#E5E4E2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#A8AFB8',
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#1C1F26',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232630',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5E4E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#05070A',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: 'bold',
  },
  handleText: {
    color: '#A8AFB8',
    fontSize: 12,
    marginTop: 2,
  },
  bioText: {
    color: '#E5E4E2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#232630',
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#A8AFB8',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#232630',
  },
  metricsCard: {
    backgroundColor: '#1C1F26',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#232630',
  },
  metricsTitle: {
    color: '#A8AFB8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  metricItem: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    color: '#E5E4E2',
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#232630',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E5E4E2',
    borderRadius: 4,
  },
});