import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SPOTS = ['📍 Wankhede Turf', '📍 Virar Boxing Club', '📍 Gold Gym Shibuya'];

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeSpot, setActiveSpot] = useState('📍 Wankhede Turf');

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/BAWAAL_text.png')}
            style={styles.wordmarkLogo}
          />
          <Text style={styles.headerAccent}>LEADERBOARD</Text>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.navigate('ArenaFeed')}
        >
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Spot Selector Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spotSelector}>
          {SPOTS.map((spot) => (
            <TouchableOpacity
              key={spot}
              style={[styles.spotChip, activeSpot === spot && styles.spotChipActive]}
              onPress={() => setActiveSpot(spot)}
            >
              <Text style={[styles.spotChipText, activeSpot === spot && styles.spotChipTextActive]}>
                {spot}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Spot Details Card */}
        <View style={styles.spotCard}>
          <Text style={styles.spotTitle}>{activeSpot}</Text>
          <Text style={styles.spotSubtitle}>Top Local Athletes & Spot Kings</Text>
          <View style={styles.spotStatsRow}>
            <View>
              <Text style={styles.spotStatVal}>142</Text>
              <Text style={styles.spotStatLbl}>Battles Held</Text>
            </View>
            <View>
              <Text style={styles.spotStatVal}>12.4K</Text>
              <Text style={styles.spotStatLbl}>Fire Count</Text>
            </View>
          </View>
        </View>

        {/* Leaderboard Rankings */}
        <Text style={styles.sectionTitle}>TOP ATHLETES THIS WEEK</Text>

        <View style={styles.rankCard}>
          <Text style={styles.rankNum}>#1</Text>
          <View style={styles.athleteInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.athleteName}>Rohit_VK7</Text>
              <View style={styles.badgeCombat}>
                <Text style={styles.badgeText}>COMBAT</Text>
              </View>
            </View>
            <Text style={styles.subText}>👑 CHAMPION</Text>
          </View>
          <Text style={styles.ptsText}>3,850 pts</Text>
        </View>

        <View style={styles.rankCard}>
          <Text style={styles.rankNum}>#2</Text>
          <View style={styles.athleteInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.athleteName}>Karan_Deadlift</Text>
              <View style={styles.badgeGym}>
                <Text style={styles.badgeText}>GYM</Text>
              </View>
            </View>
            <Text style={styles.subText}>🔥 TOP CHALLENGER</Text>
          </View>
          <Text style={styles.ptsText}>3,420 pts</Text>
        </View>

        <View style={styles.rankCard}>
          <Text style={styles.rankNum}>#3</Text>
          <View style={styles.athleteInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.athleteName}>Aman_Striker</Text>
              <View style={styles.badgeCricket}>
                <Text style={styles.badgeText}>CRICKET</Text>
              </View>
            </View>
            <Text style={styles.subText}>⚡ RISER</Text>
          </View>
          <Text style={styles.ptsText}>2,980 pts</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2130',
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
    color: '#FF9500',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  spotSelector: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  spotChip: {
    backgroundColor: '#121824',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  spotChipActive: {
    backgroundColor: '#FF9500',
  },
  spotChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  spotChipTextActive: {
    color: '#0B0E14',
    fontWeight: 'bold',
  },
  spotCard: {
    backgroundColor: '#121824',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2130',
  },
  spotTitle: {
    color: '#FF9500',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  spotStatsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  spotStatVal: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotStatLbl: {
    color: '#64748B',
    fontSize: 11,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  rankCard: {
    backgroundColor: '#121824',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A2130',
  },
  rankNum: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: 'bold',
    width: 32,
  },
  athleteInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  athleteName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  subText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  ptsText: {
    color: '#FF9500',
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeCombat: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGym: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCricket: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FF9500',
    fontSize: 9,
    fontWeight: 'bold',
  },
});