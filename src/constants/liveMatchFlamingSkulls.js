/**
 * Live Match Telecast — flaming skull reaction assets (static Metro requires).
 * Paths relative to src/constants/ → ../../assets/
 */
export const SKULL_SILVER = require('../../assets/skull_silver.png');
export const SKULL_BLACK = require('../../assets/skull_black.png');
export const SKULL_BRONZE = require('../../assets/skull_bronze.png');
export const SKULL_PURPLE = require('../../assets/skull_purple.png');
export const SKULL_YELLOW = require('../../assets/skull_yellow.png');

/**
 * Compact quick-tap strip order for Live Match banter / reaction bursts.
 * emojiKey must match skullEmojiRegistry keys for FloatingEmojiBurst.
 */
export const LIVE_MATCH_FLAMING_SKULLS = Object.freeze([
  { id: 'silver', emojiKey: 'skull_silver', source: SKULL_SILVER },
  { id: 'black', emojiKey: 'skull_black', source: SKULL_BLACK },
  { id: 'bronze', emojiKey: 'skull_bronze', source: SKULL_BRONZE },
  { id: 'purple', emojiKey: 'skull_purple', source: SKULL_PURPLE },
  { id: 'yellow', emojiKey: 'skull_yellow', source: SKULL_YELLOW },
]);
