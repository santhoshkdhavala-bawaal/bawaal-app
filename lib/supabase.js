/**
 * Canonical Supabase client entry (lib/supabase).
 * Re-exports the shared Expo-safe client from src/services/supabase.
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
