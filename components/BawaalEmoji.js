/**
 * Centralized BAWAAL skeleton emoji — uniform 1:1 Image sizing for chat / banter / DM.
 *
 * Full registry: `SKELETON_EMOJIS` + `ALL_SKELETON_KEYS` (includes `love` → skel_love.png).
 */
import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  ALL_SKELETON_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
} from '../src/constants/bawaalEmojiAssets';

/** Heart-eyed skeleton — Vault key `love` → assets/skel_love.png */
const LOVE_ASSET = require('../assets/skel_love.png');

/**
 * Official full registry — every `skel_*.png` keyed by filename stem.
 * `love` is required explicitly so the Vault grid always shows skel_love.png.
 */
export const SKELETON_EMOJIS = {
  ...BAWAAL_EMOJI_ASSETS,
  love: LOVE_ASSET,
};

// Keep constants map in sync for getBawaalEmojiSource / hasBawaalEmoji
BAWAAL_EMOJI_ASSETS.love = LOVE_ASSET;

/**
 * Compact banter-tray shortcuts (aliases allowed).
 */
export const BANTER_QUICK_EMOJIS = {
  head_on_fire: require('../assets/skel_head_on_fire.png'),
  laughing1: require('../assets/skel_laughing1.png'),
  gym: require('../assets/skel_gym.png'),
  gold_cup: require('../assets/skel_gold_cup.png'),
  football: require('../assets/skel_football.png'),
  crown: require('../assets/skel_holding_skull_high_gold_crown.png'),
  love: LOVE_ASSET,
  loser: require('../assets/skel_loser.png'),
  kickboxing: require('../assets/skel_kickboxing_kick.png'),
};

export const BawaalEmoji = memo(function BawaalEmoji({ name, size = 28, style, ...rest }) {
  const dimension = typeof size === 'number' && size > 0 ? size : 28;
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^skel_/, '')
    .replace(/^:+|:+$/g, '')
    .replace(/\.png$/i, '');
  const source =
    (key === 'love' ? LOVE_ASSET : null) ||
    SKELETON_EMOJIS[key] ||
    getBawaalEmojiSource(name);

  return (
    <Image
      source={source}
      style={[{ width: dimension, height: dimension }, styles.emoji, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={name ? `Bawaal emoji ${name}` : 'Bawaal emoji'}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  emoji: {
    marginHorizontal: 0,
  },
});

export default BawaalEmoji;
export {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  ALL_SKELETON_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
};
