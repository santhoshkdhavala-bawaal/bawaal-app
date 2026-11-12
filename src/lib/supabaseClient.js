/**
 * Supabase client entry for BAWAAL (Expo).
 *
 * Configure via `.env`:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Canonical singleton lives in `lib/supabase.js` (AsyncStorage sessions).
 * Prefer this module or `src/services/supabase.js` from app code.
 */
export {
  supabase,
  getSupabase,
  hasSupabaseEnv,
  isSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from '../../lib/supabase';
