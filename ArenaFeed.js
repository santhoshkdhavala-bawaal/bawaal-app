import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS } from './theme';

function PulsingCrimsonDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
  );
}

function GradientCard({ style, children, highlighted }) {
  return (
    <View style={[styles.reelCard, highlighted && styles.reelCardHighlight, style]}>
      <View pointerEvents="none" style={styles.cardGradientTop} />
      {children}
    </View>
  );
}

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

const SEED_POSTS = [
  {
    id: 'seed-yuki',
    uri: null,
    speedRate: 1,
    target: '140 KG x 3 Reps',
    timestamp: Date.now() - 1000 * 60 * 45,
    isMock: false,
    opponent: null,
    creator: 'Yuki_Lift',
    category: 'GYM',
    challengeOf: null,
    isSeed: true,
  },
];

function formatRelativeTime(ts) {
  const diff = Math.max(0, Date.now() - (ts || Date.now()));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Floating platinum play / pause — no circular chrome. */
function PlayIcon({ playing }) {
  if (playing) {
    return (
      <View style={styles.pauseIconRow}>
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </View>
    );
  }
  return <View style={styles.playTriangle} />;
}

/** Interactive seek bar — tap or drag to scrub playback position. */
function InteractiveScrubBar({ progress, duration, onSeek, onSeekStart, onSeekEnd }) {
  const trackRef = useRef(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const localProgressRef = useRef(progress);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const onSeekStartRef = useRef(onSeekStart);
  const onSeekEndRef = useRef(onSeekEnd);
  const [dragging, setDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const displayProgress = dragging ? localProgress : progress;

  durationRef.current = duration;
  onSeekRef.current = onSeek;
  onSeekStartRef.current = onSeekStart;
  onSeekEndRef.current = onSeekEnd;

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
        trackRef.current?.measureInWindow?.((x, _y, width) => {
          trackPageXRef.current = x;
          trackWidthRef.current = width;
        });
        setDragging(true);
        onSeekStartRef.current?.();
        const w = trackWidthRef.current || 1;
        const next = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackPageXRef.current) / w));
        localProgressRef.current = next;
        setLocalProgress(next);
        onSeekRef.current?.(next * durationRef.current);
      },
      onPanResponderMove: (evt) => {
        const w = trackWidthRef.current || 1;
        const next = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackPageXRef.current) / w));
        localProgressRef.current = next;
        setLocalProgress(next);
        onSeekRef.current?.(next * durationRef.current);
      },
      onPanResponderRelease: (evt) => {
        const w = trackWidthRef.current || 1;
        const next = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - trackPageXRef.current) / w));
        localProgressRef.current = next;
        setLocalProgress(next);
        onSeekRef.current?.(next * durationRef.current);
        setDragging(false);
        onSeekEndRef.current?.(next * durationRef.current);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        onSeekEndRef.current?.(localProgressRef.current * durationRef.current);
      },
    })
  ).current;

  return (
    <View
      ref={trackRef}
      style={styles.scrubHitArea}
      hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        trackRef.current?.measureInWindow?.((x, _y, width) => {
          trackPageXRef.current = x;
          if (width) trackWidthRef.current = width;
        });
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }]} />
        <View
          pointerEvents="none"
          style={[
            styles.scrubThumb,
            { left: `${displayProgress * 100}%` },
            dragging && styles.scrubThumbActive,
          ]}
        />
      </View>
    </View>
  );
}

function LocalChallengeReel({ post, highlighted, onChallenge }) {
  const duration = Math.max(1, post.durationSec || 60);
  const speed = post.speedRate || 1;
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const tickRef = useRef(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (!playing || scrubbing) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    tickRef.current = setInterval(() => {
      setPosition((prev) => {
        const next = prev + speed * 0.25;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [playing, scrubbing, speed, duration]);

  useEffect(() => {
    if (highlighted) {
      setPlaying(true);
      setPosition(0);
    }
  }, [highlighted, post.id]);

  const progress = Math.min(1, position / duration);
  const isLocalResponse = !!post.uri || post.creator === 'You';

  const handleSeek = useCallback((seconds) => {
    setPosition(Math.max(0, Math.min(duration, seconds)));
  }, [duration]);

  const handleSeekStart = useCallback(() => {
    wasPlayingRef.current = playing;
    setScrubbing(true);
    setPlaying(false);
  }, [playing]);

  const handleSeekEnd = useCallback(() => {
    setScrubbing(false);
    if (wasPlayingRef.current) setPlaying(true);
  }, []);

  return (
    <GradientCard highlighted={highlighted}>
      <View style={styles.reelHeader}>
        <View>
          <Text style={styles.reelCreator}>
            {isLocalResponse ? 'YOU' : `@${post.creator || 'athlete'}`}
          </Text>
          {!!post.challengeOf && (
            <Text style={styles.reelVersus}>VS @{post.challengeOf}</Text>
          )}
        </View>
        <Text style={styles.reelTime}>{formatRelativeTime(post.timestamp)}</Text>
      </View>

      <TouchableOpacity
        style={styles.playerStage}
        activeOpacity={0.95}
        onPress={() => setPlaying((p) => !p)}
      >
        <Text style={styles.playerStatus}>
          {post.isMock
            ? 'LOCAL FALLBACK CLIP'
            : post.uri
              ? 'LOCAL BATTLE RESPONSE'
              : 'ARENA REEL'}
        </Text>
        <View style={styles.playOverlay} pointerEvents="none">
          <PlayIcon playing={playing} />
        </View>
      </TouchableOpacity>

      <View style={styles.scrubRow}>
        <InteractiveScrubBar
          progress={progress}
          duration={duration}
          onSeek={handleSeek}
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
        />
        <Text style={styles.playerClock}>
          {formatClock(position)} / {formatClock(duration)} · {speed}x
        </Text>
      </View>

      <View style={styles.targetPill}>
        <Text style={styles.targetPillText}>TARGET: {post.target}</Text>
      </View>

      {!isLocalResponse && (
        <TouchableOpacity style={styles.challengeButton} activeOpacity={0.85} onPress={onChallenge}>
          <Text style={styles.challengeButtonText}>CHALLENGE THIS ⚡</Text>
        </TouchableOpacity>
      )}

      {isLocalResponse && (
        <View style={styles.postedBadge}>
          <Text style={styles.postedBadgeText}>POSTED TO ARENA</Text>
        </View>
      )}
    </GradientCard>
  );
}

export default function ArenaFeed({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [localPosts, setLocalPosts] = useState(SEED_POSTS);
  const [highlightId, setHighlightId] = useState(null);
  const feedScrollRef = useRef(null);
  const consumedPostId = useRef(null);

  const ingestArenaPost = useCallback(
    (newArenaPost) => {
      if (!newArenaPost?.id) return;
      if (consumedPostId.current === newArenaPost.id) return;
      consumedPostId.current = newArenaPost.id;

      setLocalPosts((prev) => {
        if (prev.some((p) => p.id === newArenaPost.id)) return prev;
        return [newArenaPost, ...prev];
      });
      setHighlightId(newArenaPost.id);
      setActiveCategory('ALL');

      requestAnimationFrame(() => {
        feedScrollRef.current?.scrollTo?.({ y: 0, animated: true });
      });

      try {
        navigation?.setParams?.({ newArenaPost: undefined });
      } catch (_) {
        /* ignore */
      }
    },
    [navigation]
  );

  useEffect(() => {
    const incoming = route?.params?.newArenaPost;
    if (incoming) ingestArenaPost(incoming);
  }, [route?.params?.newArenaPost, ingestArenaPost]);

  const openChallenge = (fromPost) => {
    navigation?.navigate('Challenge', {
      reel: {
        creator: fromPost?.creator || 'Yuki_Lift',
        statSticker: fromPost?.target || '140 KG x 3 Reps',
        category: fromPost?.category || 'GYM',
      },
    });
  };

  const visiblePosts = localPosts.filter((post) => {
    if (activeCategory === 'ALL') return true;
    return (post.category || 'GYM') === activeCategory;
  });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BACKGROUND_OBSIDIAN} />
      <View style={styles.container}>
        <View style={[styles.headerBlock, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
          {/* ROW 1 — Brand + profile actions */}
          <View style={styles.headerRow1}>
            <Text style={styles.brandName}>BAWAAL</Text>
            <View style={styles.headerActionGroup}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate?.('Profile')}
              >
                <Text style={styles.headerActionText}>ME</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionBtn}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate?.('Profile', { section: 'settings' })}
              >
                <Text style={styles.headerActionText}>SET</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ROW 2 — Section + live badge */}
          <View style={styles.headerRow2}>
            <Text style={styles.sectionLabel}>ARENA</Text>
            <View style={styles.liveBadge}>
              <PulsingCrimsonDot />
              <Text style={styles.liveText}>TOKYO GLOBAL LIVE</Text>
            </View>
          </View>
        </View>

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
                  activeOpacity={0.75}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          ref={feedScrollRef}
          style={styles.feedScroll}
          contentContainerStyle={[styles.feedContent, { paddingBottom: 96 + insets.bottom }]}
        >
          {visiblePosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>NO POSTS IN {activeCategory}</Text>
              <Text style={styles.emptyBody}>Switch category or post a battle response.</Text>
            </View>
          ) : (
            visiblePosts.map((post) => (
              <LocalChallengeReel
                key={post.id}
                post={post}
                highlighted={highlightId === post.id}
                onChallenge={() => openChallenge(post)}
              />
            ))
          )}
        </ScrollView>

        {/* Bottom charcoal glass nav + platinum FAB */}
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.navItem} activeOpacity={0.75}>
            <Text style={styles.navItemActive}>ARENA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.9}
            onPress={() => openChallenge(SEED_POSTS[0])}
            accessibilityLabel="Create challenge"
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate?.('Leaderboard')}
          >
            <Text style={styles.navItemText}>RANK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
  },
  headerBlock: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sectionLabel: {
    color: '#9EA3B0',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.GLASS_OVERLAY,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.ELECTRIC_CRIMSON,
    marginRight: 6,
  },
  liveText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  categoryBarContainer: {
    paddingVertical: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryPill: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryPillActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.PLATINUM_BASE,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.TEXT_MUTED,
  },
  categoryTextActive: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '900',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
  },
  reelCard: {
    backgroundColor: COLORS.CARD_BOTTOM,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    overflow: 'hidden',
  },
  cardGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: COLORS.CARD_TOP,
    opacity: 0.92,
  },
  reelCardHighlight: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  reelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    zIndex: 1,
  },
  reelCreator: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  reelVersus: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  reelTime: {
    color: COLORS.TEXT_DIM,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  playerStage: {
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
    borderRadius: 10,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    zIndex: 1,
    overflow: 'hidden',
  },
  playerStatus: {
    position: 'absolute',
    top: 12,
    left: 12,
    color: COLORS.TEXT_DIM,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playOverlay: {
    width: 56,
    height: 56,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 24,
    borderBottomWidth: 24,
    borderLeftWidth: 40,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#E5E4E2',
    // Soft visibility over bright frames
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 6,
  },
  pauseIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pauseBar: {
    width: 10,
    height: 40,
    borderRadius: 2,
    backgroundColor: '#E5E4E2',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 6,
  },
  scrubRow: {
    marginTop: 10,
    marginBottom: 12,
    zIndex: 1,
  },
  scrubHitArea: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#E5E4E2',
    borderRadius: 2,
  },
  scrubThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E4E2',
    marginLeft: -6,
    top: -4.5,
    opacity: 0.85,
  },
  scrubThumbActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  playerClock: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  targetPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginBottom: 12,
    zIndex: 1,
  },
  targetPillText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  challengeButton: {
    backgroundColor: COLORS.PLATINUM_BASE,
    paddingVertical: 14,
    borderRadius: RADIUS.cta,
    alignItems: 'center',
    zIndex: 1,
  },
  challengeButtonText: {
    color: COLORS.INK,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  postedBadge: {
    backgroundColor: COLORS.GLASS_OVERLAY,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    borderRadius: RADIUS.chip,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  postedBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyBody: {
    color: COLORS.TEXT_DIM,
    fontSize: 12,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.NAV_BAR,
    borderTopWidth: 1,
    borderTopColor: COLORS.CARD_BORDER,
    paddingTop: 10,
    paddingHorizontal: 28,
  },
  navItem: {
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  navItemActive: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PLATINUM_BASE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 4,
    borderColor: COLORS.NAV_BAR,
  },
  fabIcon: {
    color: COLORS.INK,
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});
