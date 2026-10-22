/**
 * Live1v1BattleScreen — production spectator stage for BAWAAL cross-border live battles.
 *
 * Layout (frozen):
 *  - 50/50 vertical stack: Host (top) / Challenger (bottom)
 *  - Center VS seam badge at 50%
 *  - Overlay badges: flag+handle top-left, REPS top-right (per pane)
 *
 * Interaction engine (locked):
 *  - Floating emoji reactions over the camera canvas
 *  - Hype / Banter / Host vote / Rival vote / Share handlers
 *  - Live crowd poll percentages
 *
 * Ready for WebSocket sync via optional callbacks:
 *  onVoteHost | onVoteChallenger | onHype | onBanter | onShare
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  Easing,
  Share,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

const BG = '#000000';
const SURFACE = '#121212';
const BORDER = '#1F2937';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const ORANGE = '#FF5722';
const CYAN = '#00E5FF';

const DEFAULT_MATCH = Object.freeze({
  category: '[COMBAT] 3-ROUND SPAR',
  timerLabel: '01:32',
  spectatorsLabel: '4.2K LIVE',
  host: Object.freeze({
    handle: '@MUMBAI_STRIKER',
    flag: '🇮🇳',
    label: 'INDIA',
    reps: 43,
  }),
  challenger: Object.freeze({
    handle: '@NYC_LIFT',
    flag: '🇺🇸',
    label: 'USA',
    reps: 41,
  }),
  initialHostVotes: 1240,
  initialChallengerVotes: 1060,
  initialHype: 88,
});

let reactionSeq = 0;

function FloatingReactionLayer({ reactions }) {
  return (
    <View style={styles.floatingLayer} pointerEvents="none">
      {reactions.map((rx) => (
        <Animated.View
          key={rx.id}
          style={[
            styles.floatingItem,
            rx.text ? styles.floatingPill : null,
            {
              left: rx.left,
              opacity: rx.opacity,
              transform: [{ translateY: rx.translateY }],
            },
          ]}
        >
          <Text style={rx.text ? styles.floatingPillEmoji : styles.floatingEmoji}>
            {rx.emoji}
          </Text>
          {!!rx.text && <Text style={styles.floatingPillText}>{rx.text}</Text>}
        </Animated.View>
      ))}
    </View>
  );
}

function AthletePane({ athlete, reps, repsVariant }) {
  const isHost = repsVariant === 'host';
  return (
    <View style={styles.athletePane}>
      <View style={styles.cameraPlaceholder} />
      <View style={styles.overlayRow}>
        <View style={styles.handleBadge}>
          <Text style={styles.flagText}>{athlete.flag}</Text>
          <Text style={styles.handleText} numberOfLines={1}>
            {athlete.handle}
          </Text>
        </View>
        <View style={isHost ? styles.hostRepsBadge : styles.challengerRepsBadge}>
          <Text style={styles.repsLabel}>REPS</Text>
          <Text style={isHost ? styles.repsCountHost : styles.repsCountChallenger}>
            {reps}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} [props.navigation]
 * @param {object} [props.route] — route.params.match overrides DEFAULT_MATCH
 * @param {(side: 'host'|'challenger') => void} [props.onVote]
 * @param {() => void} [props.onHype]
 * @param {(text: string) => void} [props.onBanter]
 * @param {() => void} [props.onShare]
 */
export default function Live1v1BattleScreen({
  navigation,
  route,
  onVote,
  onHype,
  onBanter,
  onShare,
}) {
  const insets = useSafeAreaInsets();
  const match = useMemo(
    () => ({
      ...DEFAULT_MATCH,
      ...(route?.params?.match || {}),
      host: { ...DEFAULT_MATCH.host, ...(route?.params?.match?.host || {}) },
      challenger: {
        ...DEFAULT_MATCH.challenger,
        ...(route?.params?.match?.challenger || {}),
      },
    }),
    [route?.params?.match]
  );

  const [hostVotes, setHostVotes] = useState(match.initialHostVotes);
  const [challengerVotes, setChallengerVotes] = useState(match.initialChallengerVotes);
  const [hypeCount, setHypeCount] = useState(match.initialHype);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterDraft, setBanterDraft] = useState('');

  const totalVotes = Math.max(1, hostVotes + challengerVotes);
  const hostPercent = Math.round((hostVotes / totalVotes) * 100);
  const challengerPercent = 100 - hostPercent;

  const trayBottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 4;

  const spawnFloatingReaction = useCallback((emoji, options = {}) => {
    const id = `rx-${Date.now()}-${reactionSeq++}`;
    const left = options.left ?? Math.max(12, Math.random() * (SCREEN_W - 56));
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(0);

    setFloatingReactions((prev) => [
      ...prev.slice(-18),
      { id, emoji, left, text: options.text || null, opacity, translateY },
    ]);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: -150,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  const handleHype = useCallback(() => {
    setHypeCount((n) => n + 1);
    onHype?.();
    for (let i = 0; i < 3; i += 1) {
      setTimeout(() => {
        spawnFloatingReaction('🔥', {
          left: 24 + Math.random() * (SCREEN_W - 72),
        });
      }, i * 80);
    }
  }, [onHype, spawnFloatingReaction]);

  const submitBanter = useCallback(() => {
    const text = banterDraft.trim() || "Let's go Mumbai! 🔥";
    setBanterOpen(false);
    setBanterDraft('');
    onBanter?.(text);
    spawnFloatingReaction('💬', {
      left: 20 + Math.random() * Math.max(40, SCREEN_W - 220),
      text: `@You: ${text}`,
    });
  }, [banterDraft, onBanter, spawnFloatingReaction]);

  const handleVoteHost = useCallback(() => {
    setHostVotes((n) => n + 1);
    onVote?.('host');
    spawnFloatingReaction('🥊', { left: SCREEN_W * 0.18, text: 'VOTED INDIA' });
  }, [onVote, spawnFloatingReaction]);

  const handleVoteChallenger = useCallback(() => {
    setChallengerVotes((n) => n + 1);
    onVote?.('challenger');
    spawnFloatingReaction('🥊', { left: SCREEN_W * 0.55, text: 'VOTED USA' });
  }, [onVote, spawnFloatingReaction]);

  const handleShare = useCallback(async () => {
    onShare?.();
    try {
      await Share.share({
        message: `Watch live 1v1 battle ${match.host.label} vs ${match.challenger.label} on BAWAAL!`,
        title: 'BAWAAL Live 1v1',
      });
    } catch (_) {
      /* dismissed */
    }
  }, [match.challenger.label, match.host.label, onShare]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else navigation?.navigate?.('Main', { tab: 'Battles' });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.brandTitle}>BAWAAL</Text>
          <Text style={styles.brandSubtitle}>LIVE 1v1 BATTLE</Text>
        </TouchableOpacity>

        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{match.timerLabel}</Text>
          <Text style={styles.categoryText}>{match.category}</Text>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{match.spectatorsLabel}</Text>
        </View>
      </View>

      {/* Frozen 50/50 vertical stage */}
      <View style={styles.stageContainer}>
        <AthletePane athlete={match.host} reps={match.host.reps} repsVariant="host" />

        <View style={styles.vsCenterSeam} pointerEvents="none">
          <View style={styles.vsLine} />
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.vsLine} />
        </View>

        <AthletePane
          athlete={match.challenger}
          reps={match.challenger.reps}
          repsVariant="challenger"
        />

        <FloatingReactionLayer reactions={floatingReactions} />
      </View>

      <View style={styles.pollSection}>
        <View style={styles.pollLabelRow}>
          <Text style={styles.pollHostText}>
            {match.host.label} {hostPercent}%
          </Text>
          <Text style={styles.thunderIcon}>⚡</Text>
          <Text style={styles.pollChallengerText}>
            {challengerPercent}% {match.challenger.label}
          </Text>
        </View>
        <View style={styles.pollBarTrack}>
          <View style={[styles.pollBarHost, { width: `${hostPercent}%` }]} />
          <View style={[styles.pollBarChallenger, { width: `${challengerPercent}%` }]} />
        </View>
        <Text style={styles.tapToVoteText}>TAP BELOW TO CAST YOUR VOTE</Text>
      </View>

      <View style={[styles.actionTray, { paddingBottom: trayBottomPad }]}>
        <TouchableOpacity style={styles.actionButton} onPress={handleHype} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>🔥</Text>
          <Text style={styles.actionLabel}>HYPE ({hypeCount})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setBanterOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>BANTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleVoteHost}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>🥊</Text>
          <Text style={[styles.actionLabel, styles.actionLabelHost]}>HOST</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleVoteChallenger}
          activeOpacity={0.85}
        >
          <Text style={styles.actionIcon}>🥊</Text>
          <Text style={[styles.actionLabel, styles.actionLabelRival]}>RIVAL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>🚀</Text>
          <Text style={styles.actionLabel}>SHARE</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={banterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBanterOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.banterOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.banterBackdrop} onPress={() => setBanterOpen(false)} />
          <View style={[styles.banterSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.banterHandle} />
            <Text style={styles.banterTitle}>DROP BANTER</Text>
            <TextInput
              style={styles.banterInput}
              placeholder="Let's go Mumbai! 🔥"
              placeholderTextColor="#666666"
              value={banterDraft}
              onChangeText={setBanterDraft}
              autoFocus
              onSubmitEditing={submitBanter}
              returnKeyType="send"
            />
            <View style={styles.banterActions}>
              <TouchableOpacity
                style={styles.banterQuick}
                onPress={() => setBanterDraft("Let's go Mumbai! 🔥")}
              >
                <Text style={styles.banterQuickText}>{"Quick: Let's go Mumbai! 🔥"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.banterSend} onPress={submitBanter}>
                <Text style={styles.banterSendText}>SEND</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE,
  },
  brandTitle: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerText: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 18,
  },
  categoryText: {
    color: '#CCCCCC',
    fontSize: 8,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF0000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF0000',
    marginRight: 6,
  },
  liveText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 10,
  },
  stageContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  athletePane: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#080808',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SURFACE,
  },
  overlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 5,
  },
  handleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '62%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  flagText: {
    fontSize: 14,
    marginRight: 6,
  },
  handleText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 13,
    flexShrink: 1,
  },
  hostRepsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  challengerRepsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1.5,
    borderColor: CYAN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  repsLabel: {
    color: MUTED,
    fontSize: 8,
    fontWeight: '800',
  },
  repsCountHost: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '900',
  },
  repsCountChallenger: {
    color: CYAN,
    fontSize: 22,
    fontWeight: '900',
  },
  vsCenterSeam: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 48,
    marginTop: -24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  vsLine: {
    flex: 1,
    height: 2,
    backgroundColor: ORANGE,
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginHorizontal: 10,
    backgroundColor: BG,
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  vsText: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 14,
  },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  floatingItem: {
    position: 'absolute',
    bottom: 40,
  },
  floatingEmoji: {
    fontSize: 34,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,18,18,0.88)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
  },
  floatingPillEmoji: {
    fontSize: 16,
  },
  floatingPillText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  pollSection: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: SURFACE,
  },
  pollLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  pollHostText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
  },
  thunderIcon: {
    color: ORANGE,
    marginHorizontal: 8,
    fontSize: 12,
  },
  pollChallengerText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
  },
  pollBarTrack: {
    height: 12,
    width: '100%',
    backgroundColor: SURFACE,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pollBarHost: {
    height: '100%',
    backgroundColor: ORANGE,
  },
  pollBarChallenger: {
    height: '100%',
    backgroundColor: CYAN,
  },
  tapToVoteText: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  actionTray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: BG,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SURFACE,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  actionLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
  },
  actionLabelHost: { color: ORANGE },
  actionLabelRival: { color: CYAN },
  banterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  banterBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  banterSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  banterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555555',
    marginBottom: 12,
  },
  banterTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  banterInput: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  banterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  banterQuick: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  banterQuickText: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '700',
  },
  banterSend: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  banterSendText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
});
