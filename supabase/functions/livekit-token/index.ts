/**
 * BAWAAL LIVE — LiveKit access token (Supabase Edge Function / Deno).
 *
 * POST JSON: { roomName, participantName, isHost, inviteCode? }
 * Legacy aliases: matchId → roomName, role: 'host'|'viewer' → isHost
 * Returns: { token, url } (also `wsUrl` for older clients)
 *
 * Secrets:
 *   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
 * Runtime (auto):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy:
 *   supabase functions deploy livekit-token --project-ref petjdnyrjhgruvhzavmu
 */
import { AccessToken } from 'npm:livekit-server-sdk@2';
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

function cleanInviteCode(raw: unknown): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = String(Deno.env.get('LIVEKIT_API_KEY') || '').trim();
  const apiSecret = String(Deno.env.get('LIVEKIT_API_SECRET') || '').trim();
  const livekitUrl = String(Deno.env.get('LIVEKIT_URL') || '').trim();
  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').trim();
  const anonKey = String(Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  const serviceRoleKey = String(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  ).trim();

  if (!apiKey || !apiSecret || !livekitUrl) {
    return jsonResponse(
      {
        error:
          'LiveKit secrets not configured (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)',
      },
      500
    );
  }

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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const roomName = String(
    payload?.roomName || payload?.matchId || ''
  ).trim();
  const participantName = String(payload?.participantName || '')
    .trim()
    .replace(/^@/, '')
    .slice(0, 64);
  const roleRaw = String(payload?.role || '')
    .trim()
    .toLowerCase();
  const isHost =
    payload?.isHost === true ||
    payload?.isHost === 'true' ||
    roleRaw === 'host';
  const inviteCode = cleanInviteCode(payload?.inviteCode);

  if (!roomName || !participantName) {
    return jsonResponse(
      {
        error:
          'Body must include roomName (or matchId) and participantName',
      },
      400
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify match + invite access against public.live_matches when present.
  let match: {
    id?: string;
    host_id?: string | null;
    status?: string | null;
    visibility?: string | null;
    invite_code?: string | null;
  } | null = null;

  try {
    const { data, error } = await admin
      .from('live_matches')
      .select('id, host_id, status, visibility, invite_code')
      .eq('id', roomName)
      .maybeSingle();
    if (error) {
      // Soft: missing table / schema — still mint for local/dev rooms
      console.warn('[livekit-token] live_matches lookup:', error.message);
    } else {
      match = data;
    }
  } catch (err) {
    console.warn('[livekit-token] live_matches exception:', err);
  }

  if (match) {
    if (String(match.status || '') !== 'live') {
      return jsonResponse({ error: 'Match is not live' }, 403);
    }

    const hostId = String(match.host_id || '').trim();
    const userId = String(user.id);
    const isMatchHost = !!hostId && (hostId === userId || hostId === user.id);

    if (isHost) {
      if (!isMatchHost) {
        return jsonResponse(
          { error: 'Only the match host can publish to this room' },
          403
        );
      }
    } else {
      const visibility = String(match.visibility || 'public').toLowerCase();
      if (visibility === 'private' && !isMatchHost) {
        const matchInvite = cleanInviteCode(match.invite_code);
        let inviteOk = !!inviteCode && !!matchInvite && inviteCode === matchInvite;

        if (!inviteOk) {
          try {
            const { data: invites } = await admin
              .from('live_match_invites')
              .select('id')
              .eq('match_id', match.id)
              .or(
                `recipient_id.eq.${userId},recipient_handle.ilike.${participantName}`
              )
              .limit(1);
            inviteOk = Array.isArray(invites) && invites.length > 0;
          } catch {
            /* soft */
          }
        }

        if (!inviteOk) {
          return jsonResponse(
            {
              error:
                'Private match — provide a valid inviteCode or accept a direct invite',
            },
            403
          );
        }
      }
    }
  } else if (isHost) {
    // No DB row: allow host mint for local/dev rooms (identity still JWT-gated).
  }

  try {
    const identity = `${user.id}:${participantName}`.slice(0, 128);
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      ttl: '6h',
      metadata: JSON.stringify({
        userId: user.id,
        isHost,
        roomName,
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: isHost,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return jsonResponse({
      token,
      url: livekitUrl,
      wsUrl: livekitUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err || 'token failed');
    return jsonResponse({ error: message }, 500);
  }
});
