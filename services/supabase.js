/**
 * Convenience entry for `services/supabase.js` imports.
 * Canonical client lives in `src/services/supabase.js`.
 */
export {
  supabase,
  isSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
  isValidSupabaseKey,
  isCloudAuthError,
  canAttemptCloudUpload,
  BAWAAL_VIDEOS_BUCKET,
  BAWAAL_AVATARS_BUCKET,
} from '../src/services/supabase';
