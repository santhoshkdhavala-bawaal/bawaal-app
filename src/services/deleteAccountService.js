/**
 * Permanent account deletion via Edge Function `delete-account`.
 * Verifies JWT server-side, then service-role `auth.admin.deleteUser`.
 */
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Delete the currently authenticated account (remote + returns ok for local wipe).
 * @returns {Promise<{ ok: boolean, mode: string, error?: Error|null, data?: unknown }>}
 */
export async function deleteCurrentAccount() {
  if (!isSupabaseConfigured()) {
    return { ok: true, mode: 'local', error: null };
  }

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) {
      return { ok: false, mode: 'supabase', error: sessionError };
    }

    const userId = sessionData?.session?.user?.id || null;
    if (!userId) {
      // No remote auth user — treat as local-only account wipe
      return { ok: true, mode: 'local', error: null };
    }

    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: {},
    });

    if (error) {
      console.warn(
        '[deleteAccount] invoke failed:',
        error?.message || error
      );
      return { ok: false, mode: 'supabase', error };
    }

    if (data && data.ok === false) {
      return {
        ok: false,
        mode: 'supabase',
        error: new Error(data.error || 'Account deletion failed'),
        data,
      };
    }

    // Session is dead after admin delete — soft sign-out
    try {
      await supabase.auth.signOut();
    } catch (_) {
      /* soft */
    }

    return { ok: true, mode: 'supabase', data, error: null };
  } catch (error) {
    console.warn('[deleteAccount]', error?.message || error);
    return { ok: false, mode: 'error', error };
  }
}
