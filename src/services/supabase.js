/**
 * Shared Supabase client for Expo / React Native.
 * Uses EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Persistent auth sessions via AsyncStorage when the native module is available.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Project URL for direct Storage REST calls (no session injection). */
export function getSupabaseUrl() {
  return typeof supabaseUrl === 'string' ? supabaseUrl.replace(/\/$/, '') : '';
}

/** Anon / publishable key used only as `apikey` for anonymous Storage uploads. */
export function getSupabaseAnonKey() {
  return typeof supabaseAnonKey === 'string' ? supabaseAnonKey.trim() : '';
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your project credentials.'
  );
}

/**
 * In-memory auth storage fallback when AsyncStorage is unavailable
 * (broken native link / rare Expo Go edge cases).
 */
const MemoryStorage = {
  getItem: (_key) => Promise.resolve(null),
  setItem: (_key, _value) => Promise.resolve(),
  removeItem: (_key) => Promise.resolve(),
};

/**
 * Prefer AsyncStorage for persistent sessions across app relaunches.
 * Falls back to MemoryStorage if the native module fails to load.
 */
function resolveAuthStorage() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    if (
      AsyncStorage &&
      typeof AsyncStorage.getItem === 'function' &&
      typeof AsyncStorage.setItem === 'function'
    ) {
      return AsyncStorage;
    }
  } catch (err) {
    console.warn(
      '[supabase] AsyncStorage unavailable — auth sessions will not persist:',
      err?.message || err
    );
  }
  return MemoryStorage;
}

const authStorage = resolveAuthStorage();
const persistSession = authStorage !== MemoryStorage;

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
      storage: authStorage,
      autoRefreshToken: persistSession,
      persistSession,
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
 * @deprecated Storage uploads no longer call this — public `bawaalvideos`
 * inserts use the anon/publishable key with no user session.
 * Kept as a no-op compatibility shim for any legacy callers.
 */
export async function canAttemptCloudUpload() {
  return isSupabaseConfigured();
}

export function isCloudAuthError(err) {
  const msg = String(err?.message || err?.error_description || err || '');
  return /jws|jwt|compact|invalid token|unauthorized|storage error|failed to fetch|network request failed/i.test(
    msg
  );
}
