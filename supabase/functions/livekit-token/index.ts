/**
 * BAWAAL LIVE — LiveKit access token (Supabase Edge Function / Deno).
 *
 * POST JSON: { matchId, participantName, role: 'host' | 'viewer' }
 * Returns: { token, wsUrl }
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
 */
import { AccessToken } from 'npm:livekit-server-sdk@2';

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

  const apiKey = String(Deno.env.get('LIVEKIT_API_KEY') || '').trim();
  const apiSecret = String(Deno.env.get('LIVEKIT_API_SECRET') || '').trim();
  const wsUrl = String(Deno.env.get('LIVEKIT_URL') || '').trim();

  if (!apiKey || !apiSecret || !wsUrl) {
    return jsonResponse(
      {
        error:
          'LiveKit secrets not configured (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)',
      },
      503
    );
  }

  let payload: {
    matchId?: unknown;
    participantName?: unknown;
    role?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const matchId = String(payload?.matchId || '').trim();
  const participantName = String(payload?.participantName || '')
    .trim()
    .replace(/^@/, '')
    .slice(0, 64);
  const roleRaw = String(payload?.role || '')
    .trim()
    .toLowerCase();
  const role = roleRaw === 'host' ? 'host' : roleRaw === 'viewer' ? 'viewer' : '';

  if (!matchId || !participantName || !role) {
    return jsonResponse(
      {
        error:
          "Body must include matchId, participantName, and role ('host' | 'viewer')",
      },
      400
    );
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '6h',
    });
    at.addGrant({
      roomJoin: true,
      room: matchId,
      canPublish: role === 'host',
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return jsonResponse({ token, wsUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || 'token failed');
    return jsonResponse({ error: message }, 500);
  }
});
