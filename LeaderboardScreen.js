import React, { useState } from 'react';
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
import { COLORS } from './theme';

const SPOTS = ['📍 Wankhede Turf', '📍 Virar Boxing Club', '📍 Gold Gym Shibuya'];

const RANK_TIERS = {
  1: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: '#D4AF37',
    textColor: '#F3E5AB',
  },
  2: {
    backgroundColor: 'rgba(235, 87, 87, 0.18)',
    borderColor: '#EB5757',
    textColor: '#FFB4B4',
  },
  3: {
    backgroundColor: 'rgba(46, 204, 113, 0.18)',
    borderColor: '#2ECC71',
    textColor: '#A2F9C6',
  },
};

const ATHLETES = [
  {
    rank: 1,
    name: 'Rohit_VK7',
    badge: 'COMBAT',
    badgeStyle: 'badgeCombat',
    sub: '👑 CHAMPION',
    pts: '3,850 pts',
  },
  {
    rank: 2,
    name: 'Karan_Deadlift',
    badge: 'GYM',
    badgeStyle: 'badgeGym',
    sub: '🔥 TOP CHALLENGER',
    pts: '3,420 pts',
  },
  {
    rank: 3,
    name: 'Aman_Striker',
    badge: 'CRICKET',
    badgeStyle: 'badgeCricket',
    sub: '⚡ RISER',
    pts: '2,980 pts',
  },
];

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeSpot, setActiveSpot] = useState('📍 Wankhede Turf');

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BACKGROUND_OBSIDIAN} />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('./assets/BAWAAL_text.png')} style={styles.wordmarkLogo} />
          <Text style={styles.headerAccent}>LEADERBOARD</Text>
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

        <Text style={styles.sectionTitle}>TOP ATHLETES THIS WEEK</Text>

        {ATHLETES.map((athlete) => {
          const tier = RANK_TIERS[athlete.rank];
          return (
            <View
              key={athlete.rank}
              style={[
                styles.rankCard,
                {
                  backgroundColor: tier.backgroundColor,
                  borderColor: tier.borderColor,
                },
              ]}
            >
              <Text style={[styles.rankNum, { color: tier.textColor }]}>#{athlete.rank}</Text>
              <View style={styles.athleteInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.athleteName}>{athlete.name}</Text>
                  <View style={styles[athlete.badgeStyle]}>
                    <Text style={[styles.badgeText, { color: tier.textColor }]}>{athlete.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.subText, { color: tier.textColor }]}>{athlete.sub}</Text>
              </View>
              <Text style={[styles.ptsText, { color: tier.textColor }]}>{athlete.pts}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.CARD_BORDER,
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
    color: COLORS.PLATINUM_BASE,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: COLORS.TEXT_MUTED,
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
    backgroundColor: COLORS.CARD_CHARCOAL,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  spotChipActive: {
    backgroundColor: COLORS.CARD_CHARCOAL,
    borderWidth: 1,
    borderColor: COLORS.OFF_WHITE,
  },
  spotChipText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  spotChipTextActive: {
    color: COLORS.OFF_WHITE,
    fontWeight: 'bold',
  },
  spotCard: {
    backgroundColor: COLORS.CARD_CHARCOAL,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  spotTitle: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotSubtitle: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  spotStatsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  spotStatVal: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
  },
  spotStatLbl: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
  },
  sectionTitle: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  rankCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  rankNum: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 36,
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
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  ptsText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeCombat: {
    backgroundColor: COLORS.GLASS_OVERLAY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGym: {
    backgroundColor: COLORS.GLASS_OVERLAY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCricket: {
    backgroundColor: COLORS.GLASS_OVERLAY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
});
