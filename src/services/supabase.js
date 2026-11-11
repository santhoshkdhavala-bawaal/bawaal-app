/**
 * Shared Supabase client for Expo / React Native (V1).
 *
 * Env (required for live auth / profiles):
 *   - process.env.EXPO_PUBLIC_SUPABASE_URL
 *   - process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Session persistence uses AsyncStorage via the lazy singleton in
 * `lib/supabase.js` (`auth.storage`, `persistSession`, `autoRefreshToken`).
 * Prefer `getSupabase()` after app mount; the Proxy `supabase` export is
 * backward-compatible for existing call sites.
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
