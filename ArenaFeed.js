import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';

const CATEGORIES = [
  'ALL',
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABBADI',
  'COMBAT',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
];

export default function ArenaFeed({ navigation }) {
  const [activeCategory, setActiveCategory] = useState('ALL');

  const openChallenge = () => {
    navigation?.navigate('Challenge', {
      reel: {
        creator: 'Yuki_Lift',
        statSticker: '140 KG x 3 Reps',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />
      <View style={styles.container}>
        
        {/* TOP BRAND HEADER */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>BAWAAL</Text>
            <Text style={styles.subBrand}>ARENA</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>TOKYO GLOBAL LIVE</Text>
            </View>

            {/* Profile / settings entry points (no hardcoded icon overlays) */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              activeOpacity={0.75}
              onPress={() => navigation?.navigate?.('Profile')}
              accessibilityLabel="Open profile"
            >
              <Text style={styles.headerActionText}>ME</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionBtn}
              activeOpacity={0.75}
              onPress={() => navigation?.navigate?.('Profile', { section: 'settings' })}
              accessibilityLabel="Open settings"
            >
              <Text style={styles.headerActionText}>SET</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CATEGORY FILTER BAR (Plain Words Typography Flow) */}
        <View style={styles.categoryBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  activeOpacity={0.7}
                  style={styles.categoryTextWrapper}
                >
                  <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* FEED CONTENT PLACEHOLDER */}
        <ScrollView style={styles.feedScroll}>
          <View style={styles.cardPlaceholder}>
            <Text style={styles.cardTitle}>ARENA FEEDS</Text>
            <Text style={styles.cardSubtitle}>
              Showing updates for {activeCategory}...
            </Text>
            
            {/* Primary Metallic Orange Action CTA → ChallengeScreen / ChallengeCam */}
            <TouchableOpacity
              style={styles.challengeButton}
              activeOpacity={0.8}
              onPress={openChallenge}
            >
              <Text style={styles.challengeButtonText}>⚡ CHALLENGE THIS ⚡</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    backgroundColor: '#050505', // Pitch Black Base Canvas
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginRight: 6,
  },
  subBrand: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B00', // Metallic Orange Dot
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerActionBtn: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* CATEGORY FILTER BAR STYLES (No Container / Plain Text) */
  categoryBarContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryTextWrapper: {
    marginRight: 24, // Clean word spacing without any pill boxes
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.5)', // Off-white for unselected categories
  },
  activeCategoryText: {
    color: '#FF6B00', // Metallic Orange active state highlight
    fontWeight: '900',
  },

  /* FEED CONTENT STYLES */
  feedScroll: {
    flex: 1,
    padding: 16,
  },
  cardPlaceholder: {
    backgroundColor: '#0A0A0C', // Deep Charcoal Card Base
    borderRadius: 8,
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginVertical: 12,
  },
  challengeButton: {
    backgroundColor: '#FF6B00', // Metallic Orange CTA Button
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  challengeButtonText: {
    color: '#050505',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});