/**
 * Centralized BAWAAL skeleton emoji — uniform 1:1 Image sizing for chat / banter / DM.
 *
 * Full asset map lives in `src/constants/bawaalEmojiAssets.js`.
 *
 * @example
 *   <BawaalEmoji name="football" />
 *   <BawaalEmoji name="crown" size={32} />
 *   <BawaalEmoji name="laughing1" />
 */
import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
} from '../src/constants/bawaalEmojiAssets';

/** Convenience subset aliases used across chat / banter (full map still available). */
export const SKELETON_EMOJIS = {
  head_on_fire: BAWAAL_EMOJI_ASSETS.head_on_fire,
  laughing1: BAWAAL_EMOJI_ASSETS.laughing1,
  gym: BAWAAL_EMOJI_ASSETS.gym,
  gold_cup: BAWAAL_EMOJI_ASSETS.gold_cup,
  football: BAWAAL_EMOJI_ASSETS.football,
  crown: BAWAAL_EMOJI_ASSETS.holding_skull_high_gold_crown,
  love: BAWAAL_EMOJI_ASSETS.love,
  loser: BAWAAL_EMOJI_ASSETS.loser,
  kickboxing: BAWAAL_EMOJI_ASSETS.kickboxing_kick,
};

export const BawaalEmoji = memo(function BawaalEmoji({ name, size = 28, style, ...rest }) {
  const dimension = typeof size === 'number' && size > 0 ? size : 28;
  const source = getBawaalEmojiSource(name);

  return (
    <Image
      source={source}
      style={[styles.emoji, { width: dimension, height: dimension }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={name ? `Bawaal emoji ${name}` : 'Bawaal emoji'}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  emoji: {
    marginHorizontal: 2,
  },
});

export default BawaalEmoji;
export { BAWAAL_EMOJI_ASSETS, BAWAAL_EMOJI_KEYS, getBawaalEmojiSource, hasBawaalEmoji };
