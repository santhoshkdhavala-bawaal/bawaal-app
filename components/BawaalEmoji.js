/**
 * Centralized BAWAAL skeleton emoji — uniform 1:1 Image sizing for chat / banter / DM.
 *
 * Full registry: `SKELETON_EMOJIS` + `ALL_SKELETON_KEYS` (includes `love` → skel_love.png).
 * Images always use fixed width/height to prevent scroll layout shift.
 */
import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  BAWAAL_EMOJI_ASSETS,
  BAWAAL_EMOJI_KEYS,
  ALL_SKELETON_KEYS,
  SKULL_EMOJI_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
} from '../src/constants/bawaalEmojiAssets';

/**
 * MASTER LOCK: heart-eyed skeleton must stay registered for Vault + Banter.
 * love: require('../assets/skel_love.png')
 */
const LOVE_ASSET = require('../assets/skel_love.png');

/**
 * New skull expression set — exact requires for Vault + `:skull_*: ` shortcodes.
 */
export const SKULL_EMOJIS = {
  skull_angry: require('../assets/skull_angry.png'),
  skull_cool: require('../assets/skull_cool.png'),
  skull_crying: require('../assets/skull_crying.png'),
  skull_doubt: require('../assets/skull_doubt.png'),
  skull_laugh: require('../assets/skull_laugh.png'),
  skull_love_red_hearts: require('../assets/skull_love_red_hearts.png'),
  skull_mindblown_fire_v2: require('../assets/skull_mindblown_fire_v2.png'),
  skull_sad: require('../assets/skull_sad.png'),
  skull_scared: require('../assets/skull_scared.png'),
  skull_shame: require('../assets/skull_shame.png'),
  skull_shouting: require('../assets/skull_shouting.png'),
  skull_surprised: require('../assets/skull_surprised.png'),
  skull_very_happy: require('../assets/skull_very_happy.png'),
  skull_wink: require('../assets/skull_wink.png'),
  skull_worried: require('../assets/skull_worried.png'),
};

/**
 * Official full registry — every `skel_*.png` + skull expression set.
 * `love` is required explicitly so the Vault grid always shows skel_love.png.
 */
export const SKELETON_EMOJIS = {
  ...BAWAAL_EMOJI_ASSETS,
  ...SKULL_EMOJIS,
  love: LOVE_ASSET, // skel_love.png — do not remove
};

// Keep constants map in sync for getBawaalEmojiSource / hasBawaalEmoji / shortcodes
BAWAAL_EMOJI_ASSETS.love = LOVE_ASSET;
Object.assign(BAWAAL_EMOJI_ASSETS, SKULL_EMOJIS);

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

  // Fixed box every time — prevents scroll jitter / CLS in chat feeds
  const box = { width: dimension, height: dimension };

  return (
    <Image
      source={source}
      width={dimension}
      height={dimension}
      style={[box, styles.emoji, style]}
      resizeMode="contain"
      fadeDuration={0}
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
  SKULL_EMOJI_KEYS,
  getBawaalEmojiSource,
  hasBawaalEmoji,
};
