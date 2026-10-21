import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const CRIMSON = '#FF2A5F';
const GOLD = '#FFD700';
const PLATINUM = '#E5E4E2';
const DARK_BG = '#08120F';

// Locked permanent categories
const PERMANENT_SPORTS_TABS = [
  'ALL',
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABADDI',
  'COMBAT',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
];

const LIVE_SCORE_SAMPLES = [
  {
    id: 'ind-aus-t20',
    sport: 'CRICKET',
    tier: 'PRO',
    title: 'IND vs AUS',
    line: 'IND 184/4 (18.2 ov) vs AUS',
    status: 'LIVE',
  },
  {
    id: 'mum-del-ranji',
    sport: 'CRICKET',
    tier: 'DOMESTIC',
    title: 'MUM vs DEL',
    line: 'MUM 210/3 vs DEL',
    status: 'LIVE',
  },
];

export default function ArenaFeed({ navigation }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [feedItems, setFeedItems] = useState([]);

  useEffect(() => {
    setFeedItems([
      {
        id: '1',
        sport: 'GYM',
        author: 'YOU',
        opponent: '@Yuki_Lift',
        target: '140 KG x 3 Reps',
        status: 'POSTED TO ARENA',
      },
    ]);
  }, []);

  const visibleFeed =
    activeTab === 'ALL'
      ? feedItems
      : feedItems.filter((item) => item.sport === activeTab);

  const openChallenge = (item) => {
    navigation?.navigate?.('Challenge', {
      challengeMaxDuration: 30,
      target: item?.target || '140 KG x 3 Reps',
      handle: item?.opponent?.replace(/^@/, '') || 'Yuki_Lift',
      reel: {
        creator: item?.opponent?.replace(/^@/, '') || 'Yuki_Lift',
        statSticker: item?.target || '140 KG x 3 Reps',
        category: item?.sport || 'GYM',
        challengeMaxDuration: 30,
        durationSec: 30,
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Header — ME only (SET relocated so it cannot overlap ALL tab) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BAWAAL</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation?.navigate?.('Profile')}
          >
            <Text style={styles.headerBtnText}>ME</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation?.navigate?.('Leaderboard')}
          >
            <Text style={styles.headerBtnText}>RANK</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Arena Subheader */}
        <View style={styles.subheaderRow}>
          <Text style={styles.subheaderTitle}>ARENA</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>TOKYO GLOBAL LIVE</Text>
          </View>
        </View>

        {/* Live Score Ticker Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tickerContainer}>
          {LIVE_SCORE_SAMPLES.map((score) => (
            <TouchableOpacity key={score.id} style={styles.scoreCard}>
              <View style={styles.scoreCardHeader}>
                <Text style={styles.scoreSport}>
                  {score.sport} [{score.tier}]
                </Text>
                <View style={styles.miniLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.miniLiveText}>{score.status}</Text>
                </View>
              </View>
              <Text style={styles.scoreTitle}>{score.title}</Text>
              <Text style={styles.scoreLine}>{score.line}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Locked permanent sports tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {PERMANENT_SPORTS_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    isActive ? styles.activeTabButton : styles.inactiveTabButton,
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive ? styles.activeTabText : styles.inactiveTabText,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Feed Items */}
        {visibleFeed.map((item) => (
          <View key={item.id} style={styles.feedCard}>
            <View style={styles.feedCardHeader}>
              <Text style={styles.feedAuthor}>{item.author}</Text>
              <Text style={styles.feedOpponent}>VS {item.opponent}</Text>
              <Text style={styles.feedTime}>JUST NOW</Text>
            </View>

            <View style={styles.videoContainer}>
              <View style={styles.streamPlaceholder}>
                <View style={styles.streamLiveRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.streamLiveLabel}>LIVE</Text>
                </View>
                <Text style={styles.streamPlaceholderText}>
                  BAWAAL ARENA STREAM - LIVE FEED ACTIVE
                </Text>
              </View>
            </View>

            <View style={styles.feedFooter}>
              <Text style={styles.targetText}>TARGET: {item.target}</Text>
              <View style={styles.postedBadge}>
                <Text style={styles.postedText}>{item.status}</Text>
              </View>
            </View>

            {/* Challenge action row under each video card */}
            <View style={styles.battleActionRow}>
              <TouchableOpacity
                style={styles.battleBtn}
                activeOpacity={0.85}
                onPress={() => openChallenge(item)}
              >
                <Text style={styles.battleBtnText}>+ BATTLE / CHALLENGE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    paddingTop: 45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3B37',
    backgroundColor: '#121E1B',
  },
  headerBtnText: {
    color: PLATINUM,
    fontWeight: 'bold',
    fontSize: 12,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  subheaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  subheaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8A9E9A',
    letterSpacing: 1.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0F14',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CRIMSON,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CRIMSON,
    marginRight: 6,
    alignSelf: 'center',
  },
  liveBadgeText: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tickerContainer: {
    paddingLeft: 16,
    marginBottom: 12,
  },
  scoreCard: {
    width: 210,
    backgroundColor: '#0F1A17',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#1E332E',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreSport: {
    color: CRIMSON,
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniLiveText: {
    color: CRIMSON,
    fontSize: 9,
    fontWeight: 'bold',
  },
  scoreTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  scoreLine: {
    color: '#8A9E9A',
    fontSize: 11,
  },
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsContainer: {
    paddingLeft: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#121E1B',
    borderWidth: 1,
    borderColor: '#1E332E',
  },
  activeTabButton: {
    backgroundColor: PLATINUM,
    borderColor: PLATINUM,
  },
  inactiveTabButton: {
    backgroundColor: '#121E1B',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: DARK_BG,
  },
  inactiveTabText: {
    color: '#8A9E9A',
  },
  feedCard: {
    backgroundColor: '#0F1A17',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E332E',
    overflow: 'hidden',
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  feedAuthor: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  feedOpponent: {
    color: GOLD,
    fontWeight: 'bold',
    fontSize: 13,
  },
  feedTime: {
    color: '#6B827D',
    fontSize: 10,
  },
  videoContainer: {
    height: 220,
    backgroundColor: '#050A09',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E332E',
  },
  streamPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090D12',
    paddingHorizontal: 20,
  },
  streamLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  streamLiveLabel: {
    color: CRIMSON,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  streamPlaceholderText: {
    color: PLATINUM,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  feedFooter: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  postedBadge: {
    backgroundColor: '#162823',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243D37',
  },
  postedText: {
    color: '#8A9E9A',
    fontSize: 10,
    fontWeight: 'bold',
  },
  battleActionRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 2,
  },
  battleBtn: {
    backgroundColor: PLATINUM,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  battleBtnText: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});