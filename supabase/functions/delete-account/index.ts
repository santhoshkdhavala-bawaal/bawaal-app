/**
 * BAWAAL — permanent account deletion (App Store / Play compliant).
 *
 * POST (authenticated): verifies the caller's JWT via anon client, runs
 * `public.delete_account_cascade(user_id)` with the service role, then
 * `auth.admin.deleteUser(user.id)`.
 *
 * Deploy:
 *   supabase functions deploy delete-account --project-ref petjdnyrjhgruvhzavmu
 *
 * Runtime env (auto on hosted Edge Functions):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * SQL: supabase/ENSURE_DELETE_ACCOUNT.sql (defines delete_account_cascade)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').trim();
  const anonKey = String(Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const serviceRoleKey = String(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  ).trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          'Supabase env not configured (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)',
      },
      500
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Missing Authorization bearer token' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.id) {
    return jsonResponse(
      { error: userError?.message || 'Invalid or expired session' },
      401
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer RPC cleanup; soft-fail to direct profile delete if RPC missing.
  try {
    const { error: cascadeError } = await admin.rpc('delete_account_cascade', {
      p_user_id: user.id,
    });
    if (cascadeError) {
      console.warn(
        '[delete-account] delete_account_cascade:',
        cascadeError.message
      );
      try {
        await admin.from('profiles').delete().eq('id', user.id);
      } catch {
        /* soft */
      }
    }
  } catch (err) {
    console.warn('[delete-account] cascade exception:', err);
    try {
      await admin.from('profiles').delete().eq('id', user.id);
    } catch {
      /* soft */
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse(
      { error: deleteError.message || 'Failed to delete auth user' },
      500
    );
  }

  return jsonResponse({
    ok: true,
    deletedUserId: user.id,
    message: 'Account deleted',
  });
});
