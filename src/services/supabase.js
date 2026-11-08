/**
 * Shared Supabase client for Expo / React Native.
 * Implementation lives in `lib/supabase.js` (lazy singleton — no createClient at import).
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
} from '../../lib/supabase';
