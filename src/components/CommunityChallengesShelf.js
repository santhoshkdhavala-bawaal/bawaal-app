/**
 * Inline Arena feed shelf — horizontal LIVE COMMUNITY CHALLENGES scroller.
 * Cards deep-link into BATTLES Open Callouts (no floating overlays).
 */
import React, { memo, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CALLOUT_KIND_TIP,
  resolveCalloutKind,
} from '../utils/faceoffCallout';

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const SURFACE = '#121212';
const BORDER = 'rgba(232,236,233,0.28)';
const MUTED = '#A0A0A0';
const CRIMSON = '#FF0033';
const TIP_BLUE = '#3B82F6';

const CARD_WIDTH = 196;

function ShelfCard({ item, onPress }) {
  const kind = resolveCalloutKind(item);
  const isTip = kind === CALLOUT_KIND_TIP;
  const accent = isTip ? TIP_BLUE : CRIMSON;
  const handle = String(item.host || item.opponent || 'Athlete').replace(
    /^@/,
    ''
  );
  const title =
    item.target ||
    item.description ||
    item.statSticker ||
    (isTip ? 'Tip request' : 'Open challenge');
  const cta = isTip ? 'TEACH' : 'RESPOND';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${cta} ${title}`}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.kindPill,
            { borderColor: accent, backgroundColor: `${accent}22` },
          ]}
        >
          <Text style={[styles.kindPillText, { color: accent }]}>
            {isTip ? 'TIP' : 'OPEN'}
          </Text>
        </View>
        <Text style={styles.sportTag} numberOfLines={1}>
          {item.sport || 'ALL'}
        </Text>
      </View>
      <Text style={styles.handle} numberOfLines={1}>
        @{handle}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{cta}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CommunityChallengesShelf({ callouts = [], onOpenCallout }) {
  const data = Array.isArray(callouts) ? callouts : [];

  const keyExtractor = useCallback(
    (item, index) => (item?.id != null ? String(item.id) : `shelf-${index}`),
    []
  );

  const renderItem = useCallback(
    ({ item }) => <ShelfCard item={item} onPress={onOpenCallout} />,
    [onOpenCallout]
  );

  if (data.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>🔥 LIVE COMMUNITY CHALLENGES</Text>
      <Text style={styles.sub}>
        Open challenges & tips — tap to open in Battles
      </Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.row}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: DARK_BG,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  header: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sub: {
    color: MUTED,
    fontSize: 11,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kindPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  kindPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sportTag: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    maxWidth: 88,
  },
  handle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  title: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 34,
    marginBottom: 12,
  },
  cta: {
    backgroundColor: WHITE,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  ctaText: {
    color: DARK_BG,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default memo(CommunityChallengesShelf);
