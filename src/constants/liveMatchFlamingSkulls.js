/**
 * Live Match Telecast — skull reaction vibes (static Metro requires).
 * Paths relative to src/constants/ → ../../assets/
 * emojiKey must match skullEmojiRegistry for BawaalEmoji / bursts.
 */
export const SKULL_FIRE = require('../../assets/skull_fire.png');
export const SKULL_DEVIL = require('../../assets/skull_devil.png');
export const SKULL_WINNING = require('../../assets/skull_champion.png');
export const SKULL_CRYING = require('../../assets/skull_crying.png');
export const SKULL_SCREAMING = require('../../assets/skull_screaming.png');

/** @deprecated Prefer SKULL_FIRE as banter-tray trigger icon */
export const SKULL_SILVER = require('../../assets/skull_silver.png');

/**
 * Compact skull-picker vibes: Fire · Devil · Winning · Crying/Sad · Screaming.
 */
export const LIVE_MATCH_FLAMING_SKULLS = Object.freeze([
  {
    id: 'fire',
    label: 'FIRE',
    emojiKey: 'skull_fire',
    source: SKULL_FIRE,
  },
  {
    id: 'devil',
    label: 'DEVIL',
    emojiKey: 'skull_devil',
    source: SKULL_DEVIL,
  },
  {
    id: 'winning',
    label: 'WIN',
    emojiKey: 'skull_champion',
    source: SKULL_WINNING,
  },
  {
    id: 'crying',
    label: 'SAD',
    emojiKey: 'skull_crying',
    source: SKULL_CRYING,
  },
  {
    id: 'screaming',
    label: 'SCREAM',
    emojiKey: 'skull_screaming',
    source: SKULL_SCREAMING,
  },
]);
