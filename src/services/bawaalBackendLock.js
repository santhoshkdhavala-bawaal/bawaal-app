/**
 * BAWAAL backend lock-down — setup hints + soft-fail re-exports.
 * Run `supabase/ENSURE_BAWAAL_BACKEND_LOCKDOWN.sql` once per Supabase project.
 */
export {
  BAWAAL_BACKEND_SETUP_HINT,
  isMissingRelationError,
  isTableDisabled,
  markTableMissing,
  resetMissingTableCircuit,
  softInsert,
  softSelect,
} from '../utils/supabaseSoftFail';

export const BAWAAL_LOCKED_TABLES = Object.freeze([
  'war_cry_matches',
  'sparks_josh_clips',
  'battle_bawaal_reels',
  'face_off_challenges',
  'reel_likes',
  'reel_banter',
]);

export const BAWAAL_BACKEND_SQL = Object.freeze({
  lockdown: 'supabase/ENSURE_BAWAAL_BACKEND_LOCKDOWN.sql',
  dashboard: 'supabase/ENSURE_ARENA_DASHBOARD.sql',
  reelSocial: 'supabase/ENSURE_REEL_SOCIAL.sql',
});
