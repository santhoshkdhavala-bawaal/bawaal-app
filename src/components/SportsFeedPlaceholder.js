/**
 * Sleek #121212 dark-mode feed / live placeholder for Expo Go.
 * LOCKED: feed variant must NOT show sport category pills on the media surface.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { canonicalizeSport } from '../utils/sportCategory';
import { isExpoGo } from '../utils/runtimeEnv';

const MOCK_TAGS = [
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABADDI',
  'COMBAT',
  'THROTTLE',
  'COURT KINGS',
];

function pickMockTags(sport, seed = 0) {
  const canon = canonicalizeSport(sport);
  const primary =
    canon && canon !== 'ALL' ? canon : MOCK_TAGS[seed % MOCK_TAGS.length];
  const secondary = MOCK_TAGS[(seed + 3) % MOCK_TAGS.length];
  const tertiary = MOCK_TAGS[(seed + 5) % MOCK_TAGS.length];
  return Array.from(new Set([primary, secondary, tertiary])).slice(0, 3);
}

/**
 * @param {object} props
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.sport]
 * @param {string} [props.label]
 * @param {string} [props.handle]
 * @param {string} [props.subtitle]
 * @param {'feed'|'live'|'battle'} [props.variant]
 * @param {number} [props.seed]
 * @param {boolean} [props.showExpoBadge]
 */
function SportsFeedPlaceholder({
  style,
  sport,
  label = 'BAWAAL CLIP',
  handle,
  subtitle,
  variant = 'feed',
  seed = 0,
  showExpoBadge = isExpoGo,
}) {
  const tags = useMemo(() => pickMockTags(sport, seed), [sport, seed]);
  const headline =
    variant === 'live' || variant === 'battle'
      ? label || 'LIVE ARENA'
      : label || 'BAWAAL CLIP';
  const sub =
    subtitle ||
    (variant === 'battle'
      ? 'Native RTC preview · Expo Go'
      : variant === 'live'
        ? 'Camera / Agora offline in Expo Go'
        : 'Mock feed surface · UI safe');

  return (
    <View style={[styles.shell, style]} pointerEvents="none">
      <View style={styles.grain} />
      <View style={styles.vignette} />

      <View style={styles.topRow}>
        {showExpoBadge ? (
          <View style={styles.expoBadge}>
            <Text style={styles.expoBadgeText}>EXPO GO</Text>
          </View>
        ) : null}
        {variant === 'live' || variant === 'battle' ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>PREVIEW</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.center}>
        <Text style={styles.brand}>BAWAAL</Text>
        <Text style={styles.headline}>{headline}</Text>
        {!!handle && (
          <Text style={styles.handle} numberOfLines={1}>
            {handle}
          </Text>
        )}
        <Text style={styles.sub}>{sub}</Text>
      </View>

      {/* Feed surface stays clean — no sport category pills on the media */}
      {variant === 'feed' ? (
        <View style={styles.bottomMeta}>
          <Text style={styles.metaRight}>JS FALLBACK</Text>
        </View>
      ) : (
        <>
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.bottomMeta}>
            <Text style={styles.metaLeft}>#{tags[0] || 'ARENA'}</Text>
            <Text style={styles.metaRight}>JS FALLBACK</Text>
          </View>
        </>
      )}
    </View>
  );
}

export default memo(SportsFeedPlaceholder);

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.SURFACE,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 14,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(232,236,233,0.08)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  expoBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(232,236,233,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expoBadgeText: {
    color: COLORS.OFF_WHITE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,87,34,0.18)',
    borderColor: 'rgba(255,87,34,0.55)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ACCENT,
  },
  livePillText: {
    color: COLORS.ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 12,
  },
  brand: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 8,
  },
  headline: {
    color: COLORS.OFF_WHITE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  handle: {
    marginTop: 8,
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    marginTop: 8,
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 2,
  },
  tag: {
    backgroundColor: 'rgba(255,87,34,0.12)',
    borderColor: 'rgba(255,87,34,0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    color: COLORS.ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  metaLeft: {
    color: 'rgba(232,236,233,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metaRight: {
    color: 'rgba(232,236,233,0.35)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
