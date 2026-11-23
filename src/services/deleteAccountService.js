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

    const accessToken = sessionData?.session?.access_token || null;
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: {},
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });

    if (error) {
      console.warn(
        '[deleteAccount] invoke failed:',
        error?.message || error
      );
      const msg = String(error?.message || error || '');
      const friendly = /not found|404|Failed to send/i.test(msg)
        ? 'Delete Account is not available yet. Deploy the delete-account Edge Function and try again.'
        : msg || 'Could not delete account. Check your connection and try again.';
      return { ok: false, mode: 'supabase', error: new Error(friendly) };
    }

    if (data && (data.ok === false || data.error)) {
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
