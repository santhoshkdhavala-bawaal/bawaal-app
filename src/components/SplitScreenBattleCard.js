/**
 * Minimalist 1v1 gateway card — Player A | VS | Player B.
 * No vote chrome / power bars. Entire card (and each pane) opens the battle.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';

const ORANGE = '#FF5A00';
const WHITE = '#FFFFFF';
const PANEL_A = '#090D16';
const PANEL_B = '#121826';
const SPLIT_WIDE_MIN = 520;

function resolveHandle(raw, fallback) {
  const s = String(raw || fallback || 'athlete').trim();
  if (!s) return '@athlete';
  return s.startsWith('@') ? s : `@${s.replace(/^@/, '')}`;
}

function SplitScreenBattleCard({
  item = null,
  playerA: playerAProp = null,
  playerB: playerBProp = null,
  title = '1v1 LIVE CHALLENGE',
  onPress = null,
  style = null,
}) {
  const [splitWide, setSplitWide] = useState(
    () => Dimensions.get('window').width >= SPLIT_WIDE_MIN
  );

  const responses = Array.isArray(item?.responses) ? item.responses : [];
  const rival = responses[0] || null;

  const playerA = useMemo(
    () => ({
      handle: resolveHandle(
        playerAProp?.handle ||
          playerAProp?.label ||
          item?.challengerLabel ||
          item?.opponent ||
          item?.author ||
          item?.host,
        'player_a'
      ),
      sport: playerAProp?.sport || item?.sport || item?.category || 'ARENA',
      posterUri:
        playerAProp?.posterUri ||
        item?.openerPoster ||
        item?.thumbnail_url ||
        item?.posterUrl ||
        null,
    }),
    [playerAProp, item]
  );

  const playerB = useMemo(
    () => ({
      handle: resolveHandle(
        playerBProp?.handle ||
          playerBProp?.label ||
          item?.leaderLabel ||
          rival?.creator ||
          item?.rival,
        'player_b'
      ),
      sport: playerBProp?.sport || item?.sport || item?.category || 'ARENA',
      posterUri:
        playerBProp?.posterUri ||
        rival?.thumbnail_url ||
        rival?.posterUrl ||
        null,
    }),
    [playerBProp, item, rival]
  );

  const onSplitLayout = useCallback((e) => {
    const w = e?.nativeEvent?.layout?.width || 0;
    if (w > 0) setSplitWide(w >= SPLIT_WIDE_MIN);
  }, []);

  const enterBattle = useCallback(
    (side) => {
      onPress?.({ side, item, playerA, playerB });
    },
    [onPress, item, playerA, playerB]
  );

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => enterBattle('card')}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Enter live battle`}
    >
      <View style={styles.cardHeader} pointerEvents="none">
        <Text style={styles.liveEyebrow}>1v1 LIVE</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View
        style={[
          styles.splitRow,
          splitWide ? styles.splitRowWide : styles.splitRowStack,
        ]}
        onLayout={onSplitLayout}
      >
        <Pressable
          style={[styles.pane, styles.paneA]}
          onPress={() => enterBattle('A')}
          accessibilityRole="button"
          accessibilityLabel={`${playerA.handle}, Player A. Enter battle`}
        >
          {playerA.posterUri ? (
            <Image
              source={{ uri: playerA.posterUri }}
              style={styles.panePoster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.paneFallback}>
              <Text style={styles.paneFallbackMark}>A</Text>
            </View>
          )}
          <View style={styles.paneScrim} pointerEvents="none" />
          <View style={styles.paneMeta} pointerEvents="none">
            <Text style={styles.paneRole}>PLAYER A</Text>
            <Text style={styles.paneHandle} numberOfLines={1}>
              {playerA.handle}
            </Text>
            <Text style={styles.paneSport} numberOfLines={1}>
              {String(playerA.sport).toUpperCase()}
            </Text>
          </View>
        </Pressable>

        <View
          style={[styles.divider, !splitWide && styles.dividerHorizontal]}
          pointerEvents="none"
        >
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>

        <Pressable
          style={[styles.pane, styles.paneB]}
          onPress={() => enterBattle('B')}
          accessibilityRole="button"
          accessibilityLabel={`${playerB.handle}, Player B. Enter battle`}
        >
          {playerB.posterUri ? (
            <Image
              source={{ uri: playerB.posterUri }}
              style={styles.panePoster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.paneFallback, styles.paneFallbackB]}>
              <Text style={styles.paneFallbackMark}>B</Text>
            </View>
          )}
          <View style={styles.paneScrim} pointerEvents="none" />
          <View style={styles.paneMeta} pointerEvents="none">
            <Text style={styles.paneRole}>PLAYER B</Text>
            <Text style={styles.paneHandle} numberOfLines={1}>
              {playerB.handle}
            </Text>
            <Text style={styles.paneSport} numberOfLines={1}>
              {String(playerB.sport).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.tapHint} pointerEvents="none">
        TAP TO ENTER BATTLE
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.5)',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  liveEyebrow: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  splitRow: {
    width: '100%',
    minHeight: 200,
  },
  splitRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitRowStack: {
    flexDirection: 'column',
  },
  pane: {
    flex: 1,
    minHeight: 190,
    position: 'relative',
    overflow: 'hidden',
  },
  paneA: {
    backgroundColor: PANEL_A,
  },
  paneB: {
    backgroundColor: PANEL_B,
  },
  panePoster: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  paneFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111820',
  },
  paneFallbackB: {
    backgroundColor: '#151C28',
  },
  paneFallbackMark: {
    color: 'rgba(255,90,0,0.28)',
    fontSize: 72,
    fontWeight: '900',
  },
  paneScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  paneMeta: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    zIndex: 2,
  },
  paneRole: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  paneHandle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  paneSport: {
    color: '#9AA3B2',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  divider: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    zIndex: 4,
  },
  dividerHorizontal: {
    width: '100%',
    height: 32,
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tapHint: {
    textAlign: 'center',
    color: '#666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    paddingVertical: 12,
  },
});

export default memo(SplitScreenBattleCard);
