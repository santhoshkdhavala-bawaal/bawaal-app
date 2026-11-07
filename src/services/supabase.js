/**
 * Shared Supabase client for Expo / React Native (Expo Go + dev builds).
 * Env: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
 * Sessions persist via AsyncStorage when the native module is available.
 *
 * Never throws at import time — missing env is surfaced in App UI instead.
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl =
  typeof rawUrl === 'string' ? rawUrl.trim() : '';
const supabaseAnonKey =
  typeof rawKey === 'string' ? rawKey.trim() : '';

/** True when both public env vars are present and non-empty. */
export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Project URL for direct Storage REST calls (no session injection). */
export function getSupabaseUrl() {
  return supabaseUrl ? supabaseUrl.replace(/\/$/, '') : '';
}

/** Anon / publishable key used only as `apikey` for anonymous Storage uploads. */
export function getSupabaseAnonKey() {
  return supabaseAnonKey;
}

if (!hasSupabaseEnv()) {
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
 * Falls back to MemoryStorage if the module fails a smoke check.
 */
function resolveAuthStorage() {
  try {
    if (
      AsyncStorage &&
      typeof AsyncStorage.getItem === 'function' &&
      typeof AsyncStorage.setItem === 'function' &&
      typeof AsyncStorage.removeItem === 'function'
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
const persistSession = authStorage !== MemoryStorage && hasSupabaseEnv();

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

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.placeholder';

function createSafeClient() {
  try {
    const url = hasSupabaseEnv() ? supabaseUrl : PLACEHOLDER_URL;
    const key =
      hasSupabaseEnv() && isValidSupabaseKey(supabaseAnonKey)
        ? supabaseAnonKey
        : PLACEHOLDER_JWT;

    return createClient(url, key, {
      auth: {
        storage: authStorage,
        autoRefreshToken: persistSession,
        persistSession,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.warn(
      '[supabase] createClient failed — using inert placeholder client:',
      err?.message || err
    );
    return createClient(PLACEHOLDER_URL, PLACEHOLDER_JWT, {
      auth: {
        storage: MemoryStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
}

export const supabase = createSafeClient();

export function isSupabaseConfigured() {
  return Boolean(
    hasSupabaseEnv() &&
      !supabaseUrl.includes('placeholder') &&
      isValidSupabaseKey(supabaseAnonKey)
  );
}

/**
 * @deprecated Storage uploads no longer call this — public video buckets
 * use the anon/publishable key with no user session.
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

/** Canonical public video bucket (new architecture). Legacy uploads still use `bawaalvideos`. */
export const BAWAAL_VIDEOS_BUCKET = 'bawaal-videos';
/** Public avatar / passport photo bucket. */
export const BAWAAL_AVATARS_BUCKET = 'avatars';
