/**
 * Live Arena Hub — list live matches + GO LIVE NOW entry.
 * Theme: #08120F / #FF5A1F / #E53935
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  listLiveMatches,
  subscribeLiveMatchList,
} from '../services/liveMatchService';

const BG = '#08120F';
const CARD = '#0F1A16';
const ORANGE = '#FF5A1F';
const CRIMSON = '#E53935';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';

function MatchCard({ item, onPress }) {
  const watching = Math.max(0, Number(item.watching) || 0);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${item.team_a_name} versus ${item.team_b_name}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>{item.sport || 'LIVE'}</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.vsTitle} numberOfLines={1}>
        {item.team_a_name || 'TEAM A'} vs {item.team_b_name || 'TEAM B'}
      </Text>
      {item.title ? (
        <Text style={styles.matchTitle} numberOfLines={1}>
          {item.title}
        </Text>
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.scoreText}>
          {item.score_a ?? 0} — {item.score_b ?? 0}
        </Text>
        <View style={styles.watchRow}>
          <Ionicons name="eye-outline" size={14} color={MUTED} />
          <Text style={styles.watchText}>
            {watching > 0 ? watching : 'LIVE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function LiveArenaModal({ visible, onClose, onGoLive, onWatchMatch }) {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    setLoading(true);
    let alive = true;
    listLiveMatches()
      .then((list) => {
        if (alive) setMatches(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsub = subscribeLiveMatchList((list) => {
      if (alive) setMatches(Array.isArray(list) ? list : []);
    });
    return () => {
      alive = false;
      try {
        unsub?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [visible]);

  const handleGoLive = useCallback(() => {
    onClose?.();
    onGoLive?.();
  }, [onClose, onGoLive]);

  const handleWatch = useCallback(
    (match) => {
      onClose?.();
      onWatchMatch?.(match);
    },
    [onClose, onWatchMatch]
  );

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity
          style={styles.scrimHit}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close Live Arena Hub"
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              maxHeight: '88%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>LIVE ARENA</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={WHITE} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.goLiveBtn}
            onPress={handleGoLive}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Go live now"
          >
            <Text style={styles.goLiveText}>+ GO LIVE NOW</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>ACTIVE TELECASTS</Text>

          {loading && matches.length === 0 ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={matches}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <MatchCard item={item} onPress={handleWatch} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No live matches yet. Be the first — GO LIVE NOW.
                </Text>
              }
              windowSize={5}
              maxToRenderPerBatch={8}
              initialNumToRender={6}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  scrimHit: {
    flex: 1,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,90,31,0.35)',
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center', width: '100%' },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  goLiveBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE,
    marginBottom: 18,
  },
  goLiveText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 8,
    gap: 10,
  },
  emptyText: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,31,0.22)',
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sportBadge: {
    backgroundColor: 'rgba(255,90,31,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CRIMSON,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  liveChipText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
  },
  vsTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  matchTitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scoreText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  watchText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default memo(LiveArenaModal);
