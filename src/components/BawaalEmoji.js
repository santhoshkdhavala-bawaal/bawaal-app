/**
 * Centralized BAWAAL skeleton emoji — uniform 1:1 Image sizing for chat / banter / DM.
 *
 * @example
 *   <BawaalEmoji name="football" />
 *   <BawaalEmoji name="gold_cup" size={48} />
 *   <BawaalEmoji name="laughing" size={28} />
 */
import React, { memo } from 'react';
import { Image } from 'react-native';
import { getBawaalEmojiSource } from '../constants/bawaalEmojiAssets';

function BawaalEmoji({ name, size = 32, style, ...rest }) {
  const dimension = typeof size === 'number' && size > 0 ? size : 32;
  const source = getBawaalEmojiSource(name);

  return (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={name ? `Bawaal emoji ${name}` : 'Bawaal emoji'}
      style={[{ width: dimension, height: dimension }, style]}
      {...rest}
    />
  );
}

export default memo(BawaalEmoji);
export { BAWAAL_EMOJI_ASSETS, BAWAAL_EMOJI_KEYS, getBawaalEmojiSource, hasBawaalEmoji } from '../constants/bawaalEmojiAssets';
