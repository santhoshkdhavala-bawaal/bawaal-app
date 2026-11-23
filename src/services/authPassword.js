/**
 * Email + password auth for Landing (replaces SMS OTP).
 * Sign up → `supabase.auth.signUp({ email, password, options: { data: { phone } } })`
 * Sign in → `supabase.auth.signInWithPassword({ email, password })`
 * Forgot → `supabase.auth.resetPasswordForEmail(email)`
 * Set new → `supabase.auth.updateUser({ password })` (PASSWORD_RECOVERY session)
 *
 * Phone stays in user_metadata + profiles for friend lookup / invites.
 */
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from './supabase';

export const MIN_PASSWORD_LENGTH = 6;

/**
 * Normalize user-entered mobile to E.164-ish `+91…` when possible.
 * @param {string} raw
 * @returns {string}
 */
export function normalizePhoneE164(raw) {
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  // India 10-digit local → +91
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  // Already includes country code without +
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  // Practical client-side check — server still validates
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(raw) {
  return String(raw || '').length >= MIN_PASSWORD_LENGTH;
}

/** Deep-link / web redirect used by password-reset emails. */
export function getPasswordResetRedirectTo() {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/`;
      }
    } catch (_) {
      /* soft */
    }
  }
  return 'bawaal://auth/reset-password';
}

/**
 * Create account with email + password; store phone in user_metadata.
 * @param {{ email: string, password: string, phone?: string }} args
 */
export async function signUpWithEmailPassword({ email, password, phone }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhoneE164(phone);
  const pwd = String(password || '');

  if (!normalizedEmail) {
    return { ok: false, mode: 'error', error: new Error('Email is required') };
  }
  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      mode: 'error',
      error: new Error(
        'Please enter a valid email address (e.g., name@gmail.com).'
      ),
    };
  }
  if (!isValidPassword(pwd)) {
    return {
      ok: false,
      mode: 'error',
      error: new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    };
  }
  if (!normalizedPhone) {
    return { ok: false, mode: 'error', error: new Error('Phone number is required') };
  }

  if (!isSupabaseConfigured()) {
    // Soft local account when cloud auth is unavailable
    return {
      ok: true,
      mode: 'local',
      email: normalizedEmail,
      phone: normalizedPhone,
      session: {
        user: {
          email: normalizedEmail,
          user_metadata: { phone: normalizedPhone },
        },
        access_token: 'local-bypass',
      },
      user: {
        email: normalizedEmail,
        user_metadata: { phone: normalizedPhone },
      },
      error: null,
      needsEmailConfirmation: false,
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pwd,
      options: {
        data: { phone: normalizedPhone },
      },
    });
    if (error) throw error;

    let user = data?.user || data?.session?.user || null;
    if (!user?.id && data?.session) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        user = userData?.user || user;
      } catch {
        /* soft */
      }
    }

    const needsEmailConfirmation = Boolean(user?.id && !data?.session);

    return {
      ok: true,
      mode: 'supabase',
      email: normalizedEmail,
      phone: normalizedPhone,
      session: data?.session || null,
      user,
      data,
      needsEmailConfirmation,
      error: null,
    };
  } catch (error) {
    console.warn('[authPassword] signUp:', error?.message || error);
    const rawMsg = String(error?.message || '');
    const friendlyError = /is invalid|invalid.*email|email.*invalid/i.test(
      rawMsg
    )
      ? new Error(
          'Please enter a valid email address (e.g., name@gmail.com).'
        )
      : error;
    return {
      ok: false,
      mode: 'supabase',
      email: normalizedEmail,
      phone: normalizedPhone,
      error: friendlyError,
    };
  }
}

/**
 * Sign in returning users with email + password.
 * @param {{ email: string, password: string }} args
 */
export async function signInWithEmailPassword({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const pwd = String(password || '');

  if (!normalizedEmail) {
    return { ok: false, mode: 'error', error: new Error('Email is required') };
  }
  if (!pwd) {
    return { ok: false, mode: 'error', error: new Error('Password is required') };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'local',
      email: normalizedEmail,
      error: new Error('Supabase is not configured for sign-in'),
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pwd,
    });
    if (error) throw error;

    let user = data?.user || data?.session?.user || null;
    if (!user?.id) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        user = userData?.user || user;
      } catch {
        /* soft */
      }
    }

    const metaPhone =
      user?.user_metadata?.phone ||
      user?.phone ||
      null;

    return {
      ok: true,
      mode: 'supabase',
      email: normalizedEmail,
      phone: metaPhone ? normalizePhoneE164(metaPhone) : null,
      session: data?.session || null,
      user,
      data,
      error: null,
    };
  } catch (error) {
    console.warn('[authPassword] signIn:', error?.message || error);
    return {
      ok: false,
      mode: 'supabase',
      email: normalizedEmail,
      error,
    };
  }
}

/**
 * Send password-reset email (cost-free via Supabase Auth email).
 * @param {string} email
 */
export async function sendPasswordResetEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, mode: 'error', error: new Error('Email is required') };
  }
  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      mode: 'error',
      error: new Error(
        'Please enter a valid email address (e.g., name@gmail.com).'
      ),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'local',
      email: normalizedEmail,
      error: new Error('Supabase is not configured for password reset'),
    };
  }

  try {
    const redirectTo = getPasswordResetRedirectTo();
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo }
    );
    if (error) throw error;
    return {
      ok: true,
      mode: 'supabase',
      email: normalizedEmail,
      data,
      error: null,
      message:
        'If an account exists for that email, a reset link has been sent. Check your inbox.',
    };
  } catch (error) {
    console.warn('[authPassword] resetPassword:', error?.message || error);
    return {
      ok: false,
      mode: 'supabase',
      email: normalizedEmail,
      error,
    };
  }
}

/**
 * Set a new password while in a PASSWORD_RECOVERY session.
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  const pwd = String(newPassword || '');
  if (!isValidPassword(pwd)) {
    return {
      ok: false,
      mode: 'error',
      error: new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'local',
      error: new Error('Supabase is not configured for password update'),
    };
  }

  try {
    const { data, error } = await supabase.auth.updateUser({ password: pwd });
    if (error) throw error;
    return {
      ok: true,
      mode: 'supabase',
      user: data?.user || null,
      data,
      error: null,
    };
  } catch (error) {
    console.warn('[authPassword] updatePassword:', error?.message || error);
    return { ok: false, mode: 'supabase', error };
  }
}
