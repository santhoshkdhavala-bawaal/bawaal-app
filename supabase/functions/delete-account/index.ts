/**
 * BAWAAL — permanent account deletion (App Store / Play compliant).
 *
 * POST (authenticated): verifies the caller's JWT, then deletes the auth user
 * via the service role (`auth.admin.deleteUser`). `public.profiles` rows cascade
 * on `auth.users` delete when FK is configured (see ENSURE_PROFILES_SPORTS_HUBS).
 *
 * Deploy:
 *   supabase functions deploy delete-account
 *
 * Runtime env (auto on hosted Edge Functions):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
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
      503
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

  // Best-effort profile wipe before auth delete (FK cascade also covers this).
  try {
    await admin.from('profiles').delete().eq('id', user.id);
  } catch {
    /* soft — cascade / missing table */
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
