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
} from '../src/services/supabase';
