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

/** Classic Supabase anon keys are JWTs (header.payload.sig). */
export function looksLikeJwt(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** Accept classic JWT anon keys or newer sb_publishable_ / sb_secret_ keys. */
export function isValidSupabaseKey(token) {
  if (!token || typeof token !== 'string') return false;
  const t = token.trim();
  if (looksLikeJwt(t)) return true;
  if (t.startsWith('sb_publishable_') || t.startsWith('sb_secret_')) return true;
  return false;
}

const PLACEHOLDER_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.placeholder';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  isValidSupabaseKey(supabaseAnonKey) ? supabaseAnonKey.trim() : PLACEHOLDER_JWT,
  {
    auth: {
      storage: MemoryStorage,
      autoRefreshToken: false,
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
      isValidSupabaseKey(supabaseAnonKey)
  );
}

/**
 * True only when we have a usable key and (optionally) a live auth session.
 * Missing/offline session is OK for public bucket uploads with a valid anon key.
 */
export async function canAttemptCloudUpload() {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      const msg = String(error?.message || error);
      if (/jws|jwt|compact|invalid token|unauthorized/i.test(msg)) {
        console.warn('[supabase] Auth token unusable — local clip fallback:', msg);
        return false;
      }
    }
    void data;
    return true;
  } catch (err) {
    const msg = String(err?.message || err);
    console.warn('[supabase] Session check failed — local clip fallback:', msg);
    return false;
  }
}

export function isCloudAuthError(err) {
  const msg = String(err?.message || err?.error_description || err || '');
  return /jws|jwt|compact|invalid token|unauthorized|storage error|failed to fetch|network request failed/i.test(
    msg
  );
}
