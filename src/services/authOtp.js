/**
 * Phone OTP send / verify for Landing auth.
 * Dev bypass: allowlisted phones + OTP `1234` grant session without Supabase SMS.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { OTP_LENGTH } from '../../OTPInput';

export const DEV_OTP = '1234';

/** Phones that accept DEV_OTP without calling verifyOtp. */
export const DEV_OTP_PHONES = Object.freeze([
  '+917993992315',
  '+919876543210',
]);

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

export function isDevOtpPhone(phone) {
  const normalized = normalizePhoneE164(phone);
  return DEV_OTP_PHONES.includes(normalized);
}

export function isDevOtpMatch(phone, token) {
  return isDevOtpPhone(phone) && String(token || '').trim() === DEV_OTP;
}

/**
 * Request SMS OTP (no-op for allowlisted dev phones).
 * @param {string} phone
 */
export async function sendPhoneOtp(phone) {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    return { ok: false, error: new Error('Missing phone number') };
  }

  if (isDevOtpPhone(normalized)) {
    return {
      ok: true,
      mode: 'dev',
      phone: normalized,
      message: `Dev phone — use OTP ${DEV_OTP}`,
      error: null,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'local',
      phone: normalized,
      error: new Error('Supabase is not configured'),
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });
    if (error) throw error;
    return { ok: true, mode: 'supabase', phone: normalized, data, error: null };
  } catch (error) {
    console.warn('[authOtp] sendPhoneOtp:', error?.message || error);
    return { ok: false, mode: 'supabase', phone: normalized, error };
  }
}

/**
 * Verify OTP. Dev phones + `1234` succeed immediately; otherwise supabase.auth.verifyOtp.
 * @param {{ phone: string, token: string }} args
 */
export async function verifyPhoneOtp({ phone, token }) {
  const normalized = normalizePhoneE164(phone);
  const code = String(token || '').trim();

  if (!normalized) {
    return { ok: false, mode: 'error', error: new Error('Missing phone number') };
  }
  if (code.length < OTP_LENGTH) {
    return {
      ok: false,
      mode: 'error',
      error: new Error(`Enter the complete ${OTP_LENGTH}-digit code`),
    };
  }

  if (isDevOtpMatch(normalized, code)) {
    return {
      ok: true,
      mode: 'dev',
      phone: normalized,
      session: { user: { phone: normalized }, access_token: 'dev-bypass' },
      error: null,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'local',
      phone: normalized,
      error: new Error('Supabase is not configured for OTP verify'),
    };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code,
      type: 'sms',
    });
    if (error) throw error;
    return {
      ok: true,
      mode: 'supabase',
      phone: normalized,
      session: data?.session || null,
      user: data?.user || null,
      data,
      error: null,
    };
  } catch (error) {
    console.warn('[authOtp] verifyPhoneOtp:', error?.message || error);
    return { ok: false, mode: 'supabase', phone: normalized, error };
  }
}
