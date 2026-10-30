/**
 * Floating in-feed alert ticker for open callouts + live battle accepts.
 * Tap deep-links into FACEOFF.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const WHITE = '#FFFFFF';
const SURFACE = 'rgba(18, 18, 18, 0.94)';
const BORDER = 'rgba(232,236,233,0.32)';
const FLAME = '#FF5722';

const ROTATE_MS = 4200;

/**
 * Build speakable alert lines from open / live battle cards.
 * @param {Array<object>} challenges
 * @returns {Array<{ id: string, emoji: string, text: string, challengeId: string }>}
 */
export function buildArenaAlertLines(challenges) {
  const list = Array.isArray(challenges) ? challenges : [];
  const lines = [];
  for (const item of list) {
    if (!item?.id) continue;
    const status = String(item.status || '').toUpperCase();
    const target = String(item.target || item.statSticker || '').trim();
    const a = String(item.opponent || item.host || 'Athlete')
      .replace(/^@/, '')
      .trim();
    const b = String(
      item.challengerLabel || item.leaderLabel || item.responses?.[0]?.creator || ''
    )
      .replace(/^@/, '')
      .trim();
    const isLive =
      status === 'LIVE BATTLE' ||
      status === 'BATTLE' ||
      status === 'HOT' ||
      Boolean(item.responses?.length);

    if (isLive && a) {
      const vs = b && b.toUpperCase() !== 'YOU' ? b : 'Challenger';
      lines.push({
        id: `live-${item.id}`,
        emoji: '🥊',
        text: `BATTLE LIVE: ${a} vs ${vs}`,
        challengeId: String(item.id),
      });
    }
    if (target) {
      lines.push({
        id: `open-${item.id}`,
        emoji: '⚡',
        text: `OPEN: ${target}`,
        challengeId: String(item.id),
      });
    }
  }
  return lines;
}

function ArenaLiveAlertTicker({ alerts = [], onPress, style }) {
  const lines = useMemo(
    () => (Array.isArray(alerts) ? alerts.filter((a) => a?.text) : []),
    [alerts]
  );
  const [index, setIndex] = useState(0);
  const [opacity] = useState(() => new Animated.Value(1));
  const safeIndex = lines.length > 0 ? index % lines.length : 0;

  useEffect(() => {
    if (lines.length <= 1) return undefined;
    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => i + 1);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [lines.length, opacity]);

  if (lines.length === 0) return null;

  const current = lines[safeIndex];

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <Pressable
        onPress={() => onPress?.(current)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Alert: ${current.text}. Open FACEOFF`}
      >
        <Animated.View style={[styles.row, { opacity }]}>
          <Text style={styles.emoji}>{current.emoji || '⚡'}</Text>
          <Text style={styles.text} numberOfLines={1}>
            {current.text}
          </Text>
          <Text style={styles.cta}>FACEOFF</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 118,
    zIndex: 40,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardPressed: {
    opacity: 0.88,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: WHITE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cta: {
    color: FLAME,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default memo(ArenaLiveAlertTicker);
