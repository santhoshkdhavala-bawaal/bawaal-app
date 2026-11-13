/**
 * Local placeholders when remote Supabase / CDN media 404s or fails to load.
 * Keeps Image onError quiet — no console spam, no broken chrome.
 */
/* eslint-disable global-require */

/** Default athlete / profile avatar mark. */
export const DEFAULT_AVATAR_ASSET = require('../../assets/BAWAAL_B_solo.png');

/** Generic remote media / poster fallback (same brand mark). */
export const DEFAULT_MEDIA_PLACEHOLDER = require('../../assets/BAWAAL_B_solo.png');
