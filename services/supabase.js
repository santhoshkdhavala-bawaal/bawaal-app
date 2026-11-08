/**
 * Convenience entry for `services/supabase.js` imports.
 * Canonical client lives in `lib/supabase.js` (lazy singleton).
 */
export {
  supabase,
  getSupabase,
  hasSupabaseEnv,
  isSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
  looksLikeJwt,
  isValidSupabaseKey,
  isCloudAuthError,
  canAttemptCloudUpload,
  BAWAAL_VIDEOS_BUCKET,
  BAWAAL_AVATARS_BUCKET,
} from '../lib/supabase';
