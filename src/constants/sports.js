/**
 * Immutable BAWAAL sports taxonomy — single source of truth.
 * Do not reorder or rename. Consumers must import this (or re-exports
 * from `src/utils/sportCategory.js`) — never local sport arrays.
 * See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.
 */

export const BAWAAL_SPORTS = [
  'ALL',
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABADDI',
  'COMBAT',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
  'OTHERS',
];

/** Alias — historical name used across Arena / forms. */
export const BAWAAL_SPORT_TAXONOMY = BAWAAL_SPORTS;

/** Publish / picker options (excludes ALL). */
export const BAWAAL_SPORTS_WITHOUT_ALL = BAWAAL_SPORTS.filter((s) => s !== 'ALL');
