/**
 * Centralized BAWAAL skeleton emoji — uniform 1:1 Image sizing for chat / banter / DM.
 *
 * Full 106-asset registry: `SKELETON_EMOJIS` / `BAWAAL_EMOJI_ASSETS`
 * (keys match `skel_<key>.png` in `assets/`).
 *
 * @example
 *   <BawaalEmoji name="love" />
 *   <BawaalEmoji name="football" size={32} />
 *   <BawaalEmoji name="crown" size={28} />
 */
import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
} from '../src/constants/bawaalEmojiAssets';

/**
 * Official full registry — every `skel_*.png` keyed by filename stem
 * (e.g. love → skel_love.png). Same object as `BAWAAL_EMOJI_ASSETS`.
 */
export const SKELETON_EMOJIS = BAWAAL_EMOJI_ASSETS;

/**
 * Compact banter-tray shortcuts (aliases allowed). Full vault still uses
 * `SKELETON_EMOJIS` / `BAWAAL_EMOJI_KEYS` (~106).
 */
export const BANTER_QUICK_EMOJIS = {
  head_on_fire: require('../assets/skel_head_on_fire.png'),
  laughing1: require('../assets/skel_laughing1.png'),
  gym: require('../assets/skel_gym.png'),
  gold_cup: require('../assets/skel_gold_cup.png'),
  football: require('../assets/skel_football.png'),
  crown: require('../assets/skel_holding_skull_high_gold_crown.png'),
  love: require('../assets/skel_love.png'),
  loser: require('../assets/skel_loser.png'),
  kickboxing: require('../assets/skel_kickboxing_kick.png'),
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
export {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
};
