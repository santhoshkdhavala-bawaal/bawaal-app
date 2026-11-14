/**
 * Lightweight BAWAAL skull emoji — name + size → local PNG with safe fallback.
 * Full vault still uses `BawaalEmoji`; this is the skull-only surface for reactions.
 */
import React, { memo } from 'react';
import { Image, StyleSheet } from 'react-native';
import {
  SKULL_EMOJIS,
  getSkullEmojiSource,
  hasSkullEmoji,
  DEFAULT_SKULL_EMOJI_KEY,
} from '../src/constants/skullEmojiRegistry';

export const SkullEmoji = memo(function SkullEmoji({ name, size = 28, style, ...rest }) {
  const dimension = typeof size === 'number' && size > 0 ? size : 28;
  const source = getSkullEmojiSource(name) || SKULL_EMOJIS[DEFAULT_SKULL_EMOJI_KEY];
  const box = { width: dimension, height: dimension };

  return (
    <Image
      source={source}
      width={dimension}
      height={dimension}
      style={[box, styles.emoji, style]}
      resizeMode="contain"
      fadeDuration={0}
      onError={() => {
        /* local vault assets — swallow decode errors silently */
      }}
      accessibilityRole="image"
      accessibilityLabel={name ? `Skull emoji ${name}` : 'Skull emoji'}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  emoji: {
    marginHorizontal: 0,
  },
});

export default SkullEmoji;
export { SKULL_EMOJIS, getSkullEmojiSource, hasSkullEmoji, DEFAULT_SKULL_EMOJI_KEY };
