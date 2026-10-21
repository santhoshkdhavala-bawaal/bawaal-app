import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your project credentials.'
  );
}

/**
 * In-memory auth storage for Expo Go / environments without the
 * `@react-native-async-storage/async-storage` native module.
 * Avoids "Cannot find native module" crashes on import.
 */
const MemoryStorage = {
  getItem: (_key) => Promise.resolve(null),
  setItem: (_key, _value) => Promise.resolve(),
  removeItem: (_key) => Promise.resolve(),
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: MemoryStorage,
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('placeholder') &&
      supabaseAnonKey !== 'placeholder-anon-key'
  );
}
