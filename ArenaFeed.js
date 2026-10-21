import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  Modal,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from './src/services/supabase';

const { width, height } = Dimensions.get('window');

const CRIMSON = '#FF2A5F';
const GOLD = '#FFD700';
const PLATINUM = '#E5E4E2';

const LIVE_SCORE_SAMPLES = [
  {
    id: 'ind-aus-t20',
    sport: 'CRICKET',
    tier: 'PRO',
    tierTone: 'pro',
    title: 'IND vs AUS',
    line: 'IND 184/4 (18.2 ov) vs AUS',
    detail:
      'T20 International — India chasing a strong total. 4th wicket partnership still intact at 18.2 overs.',
    venue: 'Wankhede Stadium · Mumbai',
    status: 'LIVE',
  },
  {
    id: 'mum-del-ranji',
    sport: 'RANJI',
    tier: 'DOMESTIC',
    tierTone: 'domestic',
    title: 'MUM vs DEL',
    line: 'MUM 210/3 vs DEL',
    detail:
      'Ranji Trophy — Mumbai solid at 210/3 after lunch. Delhi looking for an early breakthrough.',
    venue: 'Wankhede · Domestic Circuit',
    status: 'LIVE',
  },
  {
    id: 'virar-vasai',
    sport: 'LOCAL TURF',
    tier: 'COMMUNITY',
    tierTone: 'community',
    title: 'VIRAR STRIKERS vs VASAI KINGS',
    line: 'VIRAR STRIKERS 42/1 (3.5 ov) vs VASAI KINGS',
    detail:
      'Community turf cricket — Virar Strikers off to a flyer. Local battle energy on full display.',
    venue: 'Virar Ground · Community League',
    status: 'LIVE',
  },
  {
    id: 'isl-mum-mb',
    sport: 'FOOTBALL',
    tier: 'ISL',
    tierTone: 'pro',
    title: 'MUMBAI CITY vs MOHUN BAGAN',
    line: 'MUMBAI CITY 2 - 1 MOHUN BAGAN',
    detail:
      'Indian Super League — Mumbai City lead late. Mohun Bagan pressing for an equalizer.',
    venue: 'Mumbai Football Arena',
    status: 'LIVE',
  },
];

function PulsingLiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 520,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: CRIMSON,
        opacity: pulse,
        marginRight: 5,
      }}
    />
  );
}

/** Horizontal live sports score ticker — PRO / DOMESTIC / COMMUNITY cards. */
function LiveScoreTicker({ onSelectMatch }) {
  return (
    <View style={styles.tickerWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tickerContent}
      >
        {LIVE_SCORE_SAMPLES.map((match) => (
          <TouchableOpacity
            key={match.id}
            style={styles.scoreCard}
            activeOpacity={0.85}
            onPress={() => onSelectMatch?.(match)}
          >
            <View style={styles.scoreCardTop}>
              <Text style={styles.scoreSport}>
                {match.sport}{' '}
                <Text
                  style={[
                    styles.scoreTier,
                    match.tierTone === 'community' && styles.scoreTierGold,
                    match.tierTone === 'domestic' && styles.scoreTierDomestic,
                  ]}
                >
                  [{match.tier}]
                </Text>
              </Text>
              <View style={styles.scoreLiveBadge}>
                <PulsingLiveDot />
                <Text style={styles.scoreLiveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.scoreLine} numberOfLines={2}>
              {match.line}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/** Lightweight bottom sheet for match detail + battle CTA. */
function MatchDetailSheet({ match, visible, onClose, onStartBattle }) {
  if (!match) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetLiveRow}>
            <PulsingLiveDot />
            <Text style={styles.sheetLiveText}>LIVE · {match.sport}</Text>
            <Text
              style={[
                styles.sheetTierPill,
                match.tierTone === 'community' && styles.sheetTierPillGold,
              ]}
            >
              {match.tier}
            </Text>
          </View>
          <Text style={styles.sheetTitle}>{match.title}</Text>
          <Text style={styles.sheetScore}>{match.line}</Text>
          <Text style={styles.sheetDetail}>{match.detail}</Text>
          <Text style={styles.sheetVenue}>{match.venue}</Text>

          <TouchableOpacity
            style={styles.sheetCta}
            activeOpacity={0.85}
            onPress={() => onStartBattle?.(match)}
          >
            <Text style={styles.sheetCtaText}>START BATTLE ON THIS MATCH</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetDismiss} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetDismissText}>CLOSE</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Interactive Scrub Bar component for live video scrubbing
function InteractiveScrubBar({ progress, duration, onSeek, onSeekStart, onSeekEnd }) {
  const [localProgress, setLocalProgress] = useState(progress);
  const localProgressRef = useRef(progress);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) {
      setLocalProgress(progress);
      localProgressRef.current = progress;
    }
  }, [progress, dragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setDragging(true);
        if (onSeekStart) onSeekStart();
        const touchX = evt.nativeEvent.locationX;
        const newProgress = Math.max(0, Math.min(1, touchX / (width - 48)));
        setLocalProgress(newProgress);
        localProgressRef.current = newProgress;
      },
      onPanResponderMove: (evt) => {
        const touchX = evt.nativeEvent.locationX;
        const newProgress = Math.max(0, Math.min(1, touchX / (width - 48)));
        setLocalProgress(newProgress);
        localProgressRef.current = newProgress;
      },
      onPanResponderRelease: () => {
        setDragging(false);
        if (onSeek) onSeek(localProgressRef.current);
        if (onSeekEnd) onSeekEnd();
      },
    })
  ).current;

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.scrubContainer}>
      <View style={styles.scrubTrackContainer} {...panResponder.panHandlers}>
        <View style={styles.scrubTrackBackground}>
          <View
            style={[
              styles.scrubTrackFill,
              { width: `${Math.min(100, Math.max(0, localProgress * 100))}%` },
            ]}
          />
        </View>
        <View
          style={[
            styles.scrubThumb,
            { left: `${Math.min(100, Math.max(0, localProgress * 100))}%` },
          ]}
        />
      </View>
      <View style={styles.scrubTimeRow}>
        <Text style={styles.scrubTimeText}>
          {formatTime(localProgress * (duration || 30000))} / {formatTime(duration || 30000)} · 1x
        </Text>
      </View>
    </View>
  );
}

export default function ArenaFeed({ navigation, route }) {
  const [feedBattles, setFeedBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [playingStates, setPlayingStates] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [videoDurations, setVideoDurations] = useState({});
  const [selectedMatch, setSelectedMatch] = useState(null);
  const videoRefs = useRef({});

  const handleStartBattleOnMatch = (match) => {
    setSelectedMatch(null);
    navigation?.navigate?.('Challenge', {
      challengeMaxDuration: 30,
      target: `${match.sport}: ${match.line}`,
      battleId: match.id,
      reel: {
        creator: match.sport,
        statSticker: match.line,
        category: match.sport.includes('FOOTBALL') ? 'FOOTBALL' : 'CRICKET',
        challengeMaxDuration: 30,
        durationSec: 30,
        battleId: match.id,
      },
    });
  };

  // Fetch live battles from Supabase on mount
  useEffect(() => {
    fetchArenaBattles();
  }, []);

  const fetchArenaBattles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('battle_responses')
        .select(`
          id,
          video_url,
          slow_mo_start,
          slow_mo_end,
          slow_mo_speed,
          created_at,
          profiles (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setFeedBattles(data);
      } else {
        // Fallback default sample if DB is empty
        setFeedBattles([
          {
            id: 'sample-1',
            profiles: { username: 'Yuki_Lift', avatar_url: null },
            video_url: 'https://d826372d82.imgdist.com/pub/sfprod/sample_challenge.mp4',
            target_exercise: '140 KG x 3 Reps',
          },
        ]);
      }
    } catch (err) {
      console.error('Error fetching arena feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = async (id) => {
    const ref = videoRefs.current[id];
    if (!ref) return;

    const isPlaying = playingStates[id];
    if (isPlaying) {
      await ref.pauseAsync();
      setPlayingStates((prev) => ({ ...prev, [id]: false }));
    } else {
      await ref.playAsync();
      setPlayingStates((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handlePlaybackStatusUpdate = (id, status) => {
    if (status.isLoaded) {
      const progress = status.positionMillis / (status.durationMillis || 1);
      setVideoProgress((prev) => ({ ...prev, [id]: progress }));
      setVideoDurations((prev) => ({ ...prev, [id]: status.durationMillis }));
      if (status.didJustFinish) {
        setPlayingStates((prev) => ({ ...prev, [id]: false }));
        videoRefs.current[id]?.setPositionAsync(0);
      }
    }
  };

  const handleSeek = async (id, progress) => {
    const ref = videoRefs.current[id];
    const duration = videoDurations[id] || 30000;
    if (ref) {
      await ref.setPositionAsync(progress * duration);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BAWAAL</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('AthleteDashboard')}>
            <Text style={styles.headerButtonText}>ME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerButtonText}>SET</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub-Header Arena Status */}
      <View style={styles.subHeader}>
        <Text style={styles.arenaLabel}>ARENA</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>TOKYO GLOBAL LIVE</Text>
        </View>
      </View>

      {/* Live sports score ticker */}
      <LiveScoreTicker onSelectMatch={setSelectedMatch} />

      <MatchDetailSheet
        match={selectedMatch}
        visible={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onStartBattle={handleStartBattleOnMatch}
      />

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {['ALL', 'CRICKET', 'FOOTBALL', 'GYM', 'KARATE'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF2A5F" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.feedScroll} showsVerticalScrollIndicator={false}>
          {feedBattles.map((item) => {
            const isPlaying = playingStates[item.id] || false;
            const progress = videoProgress[item.id] || 0;
            const duration = videoDurations[item.id] || 30000;

            return (
              <View key={item.id} style={styles.postCard}>
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>YOU</Text>
                    </View>
                    <Text style={styles.vsText}>VS @{item.profiles?.username || 'Yuki_Lift'}</Text>
                  </View>
                  <Text style={styles.timeText}>JUST NOW</Text>
                </View>

                {/* Video Container */}
                <View style={styles.videoContainer}>
                  <Video
                    ref={(ref) => (videoRefs.current[item.id] = ref)}
                    source={{ uri: item.video_url }}
                    style={styles.videoPlayer}
                    resizeMode={ResizeMode.COVER}
                    isLooping={false}
                    onPlaybackStatusUpdate={(status) => handlePlaybackStatusUpdate(item.id, status)}
                  />

                  {/* Play/Pause Overlay Button */}
                  <TouchableOpacity style={styles.playOverlayButton} onPress={() => togglePlay(item.id)}>
                    {!isPlaying && (
                      <View style={styles.playIconContainer}>
                        <View style={styles.playBar} />
                        <View style={styles.playBar} />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Interactive Scrub Bar */}
                  <InteractiveScrubBar
                    progress={progress}
                    duration={duration}
                    onSeek={(p) => handleSeek(item.id, p)}
                  />
                </View>

                {/* Target Metadata Banner */}
                <View style={styles.targetBanner}>
                  <Text style={styles.targetBannerText}>TARGET: 140 KG x 3 Reps</Text>
                </View>

                {/* Post Footer Action */}
                <View style={styles.postFooter}>
                  <TouchableOpacity style={styles.postedBadgeButton}>
                    <Text style={styles.postedBadgeText}>POSTED TO ARENA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ArenaFeed')}>
          <Text style={styles.navTextActive}>ARENA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabButton} onPress={() => navigation.navigate('ChallengeCam')}>
          <Text style={styles.fabPlus}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaderboardScreen')}>
          <Text style={styles.navText}>RANK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070A',
    paddingTop: 45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  headerButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tickerWrap: {
    marginBottom: 12,
  },
  tickerContent: {
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  scoreCard: {
    backgroundColor: '#090D12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A222D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 220,
    maxWidth: 280,
  },
  scoreCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreSport: {
    color: PLATINUM,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  scoreTier: {
    color: CRIMSON,
    fontWeight: '900',
  },
  scoreTierGold: {
    color: GOLD,
  },
  scoreTierDomestic: {
    color: '#7DD3FC',
  },
  scoreLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  scoreLiveText: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scoreLine: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#0A0E14',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1A222D',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3340',
    marginBottom: 14,
  },
  sheetLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetLiveText: {
    color: CRIMSON,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  sheetTierPill: {
    color: CRIMSON,
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 95, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sheetTierPillGold: {
    color: GOLD,
    borderColor: 'rgba(255, 215, 0, 0.45)',
  },
  sheetTitle: {
    color: PLATINUM,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  sheetScore: {
    color: CRIMSON,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  sheetDetail: {
    color: 'rgba(229, 228, 226, 0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  sheetVenue: {
    color: 'rgba(229, 228, 226, 0.45)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 18,
  },
  sheetCta: {
    backgroundColor: PLATINUM,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetCtaText: {
    color: '#05070A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sheetDismiss: {
    borderWidth: 1,
    borderColor: '#1A222D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetDismissText: {
    color: 'rgba(229, 228, 226, 0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  arenaLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2A5F',
    marginRight: 6,
  },
  liveText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    maxHeight: 45,
    marginBottom: 10,
  },
  tabItem: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0E131A',
    height: 36,
  },
  activeTabItem: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  tabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#000',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedScroll: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#0E131A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C232D',
    marginBottom: 20,
    overflow: 'hidden',
    padding: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A3444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  vsText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
  },
  videoContainer: {
    width: '100%',
    height: 340,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  playOverlayButton: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    borderRadius: 30,
  },
  playBar: {
    width: 6,
    height: 24,
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  scrubContainer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  scrubTrackContainer: {
    height: 20,
    justifyContent: 'center',
  },
  scrubTrackBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  scrubTrackFill: {
    height: '100%',
    backgroundColor: '#FF2A5F',
  },
  scrubThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    top: 4,
    marginLeft: -6,
  },
  scrubTimeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  scrubTimeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  targetBanner: {
    backgroundColor: '#141B24',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  targetBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  postFooter: {
    marginTop: 10,
  },
  postedBadgeButton: {
    backgroundColor: '#141B24',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  postedBadgeText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#0A0E14',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A222D',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  navTextActive: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  fabButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  fabPlus: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginTop: -2,
  },
});