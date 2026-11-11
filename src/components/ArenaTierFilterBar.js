/**
 * Horizontal Arena destination-tier pills under the main feed header.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ARENA_FEED_TIERS } from '../constants/arenaFeedTiers';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ORANGE = '#FF5500';

function ArenaTierFilterBar({
  tiers = ARENA_FEED_TIERS,
  selectedId = 'all',
  onSelect,
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {tiers.map((tier) => {
          const active = String(selectedId) === String(tier.id);
          return (
            <TouchableOpacity
              key={tier.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelect?.(tier.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter ${tier.label}`}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {tier.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    paddingBottom: 10,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillActive: {
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,85,0,0.12)',
    shadowColor: ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pillText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pillTextActive: {
    color: WHITE,
  },
});

export default memo(ArenaTierFilterBar);
