/**
 * LOCKED Arena reel overlay geometry.
 * Do not shift these tokens without an explicit unlock of bawaal-v2-arena-ui-locked.
 */

export const BAWAAL_ORANGE = '#FF5500';

/** Top-right flat mute / unmute */
export const REEL_MUTE = {
  top: 16,
  right: 16,
  width: 36,
  height: 36,
  zIndex: 99,
  iconSize: 28,
};

/**
 * Vertical action stack — anchors on the right rail below mute.
 * Mute occupies y=[16, 52]; stack top clears that + gap.
 */
export const REEL_ACTION_STACK = {
  right: 16,
  bottom: 100,
  top: 64,
  zIndex: 20,
  iconSize: 28,
  itemGap: 10,
};

/** Bottom-right ⋮ trigger */
export const REEL_MORE = {
  right: 16,
  bottom: 24,
  width: 40,
  height: 40,
  zIndex: 40,
};
