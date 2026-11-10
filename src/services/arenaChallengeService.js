/**
 * Arena OPEN challenges — Supabase `arena_challenges` + Storage opener upload.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  uploadVideoToSupabase,
} from './uploadService';
import { resolvePostSport } from '../utils/sportCategory';
import { newBattleId } from './battleSyncService';

export const ARENA_CHALLENGES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_ARENA_CHALLENGES.sql';

const TABLE = 'arena_challenges';

function resolveHost(overrides = {}) {
  const user = getActiveUser?.() || {};
  const handleRaw = String(
    overrides.hostUsername || overrides.host || user.handle || '@YOU'
  ).trim();
  const handle = handleRaw
    ? handleRaw.startsWith('@')
      ? handleRaw
      : `@${handleRaw.replace(/^@/, '')}`
    : '@YOU';
  return {
    userId: String(overrides.hostId || user.userId || user.id || 'host-local'),
    handle,
    flag: overrides.hostFlag || user.flag || '🇮🇳',
  };
}

function mapRowToCard(row, extras = {}) {
  if (!row) return null;
  const ts = row.created_at
    ? Date.parse(row.created_at) || Date.now()
    : Number(extras.createdAt) || Date.now();
  const sport = resolvePostSport(
    { sport: row.sport, category: row.sport },
    'COMBAT'
  );
  const host = row.host_username
    ? String(row.host_username).startsWith('@')
      ? String(row.host_username)
      : `@${String(row.host_username).replace(/^@/, '')}`
    : '@YOU';
  const opener =
    ensurePublicBawaalVideoUrl(row.opener_video_url) ||
    row.opener_video_url ||
    extras.localOpenerUri ||
    null;
  const id = String(row.id);
  const target = String(row.target_title || 'OPEN CHALLENGE');
  return {
    id,
    challengeId: id,
    battleId: id,
    type: 'battle_thread',
    isOpenChallenge: true,
    isBattle: true,
    status: String(row.status || 'OPEN').toUpperCase() === 'OPEN' ? 'OPEN' : row.status,
    sport,
    category: sport,
    target,
    title: target,
    targetDetails: row.target_details || extras.targetDetails || null,
    host,
    opponent: host,
    author: 'CHALLENGE',
    challengerLabel: '@YOU',
    leaderLabel: 'OPEN',
    challengeVideoUri: opener,
    openerVideoUri: opener,
    videoUri: opener,
    uri: opener,
    localVideoUri: extras.localOpenerUri || null,
    publicCloudUrl: isRemoteHttpsUri(opener) ? opener : null,
    responses: [],
    responseCount: Number(row.response_count) || 0,
    timestamp: ts,
    createdAt: ts,
    feedTarget: 'ARENA',
    source: 'ARENA_CHALLENGE',
    _freshPublish: !!extras._freshPublish,
    ...extras,
  };
}

/**
 * Fetch OPEN Arena challenges newest-first from `arena_challenges`.
 * Soft-fails to [] on schema/RLS/network errors (never throws).
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>} feed-ready challenge cards
 */
export async function fetchArenaChallenges(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 80);
  console.log('[arena_challenges] FETCH start', { table: TABLE, limit });

  if (!isSupabaseConfigured()) {
    console.warn(
      '[arena_challenges] FETCH skipped — Supabase not configured'
    );
    return [];
  }

  try {
    const { data, error, status, statusText } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[arena_challenges] FETCH error — schema/RLS mismatch?', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status,
        statusText,
        setupHint: ARENA_CHALLENGES_SETUP_HINT,
      });
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    console.log('[arena_challenges] FETCH ok', {
      count: rows.length,
      newestId: rows[0]?.id || null,
      newestCreatedAt: rows[0]?.created_at || null,
      sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
    });

    return rows.map((row) => mapRowToCard(row)).filter(Boolean);
  } catch (err) {
    console.error('[arena_challenges] FETCH crashed:', {
      message: err?.message || String(err),
      err,
    });
    return [];
  }
}

/**
 * Upload opener (if local) + insert OPEN row into `arena_challenges`.
 * Soft-falls back to a local feed card when cloud is offline / table missing.
 * On success, immediately re-queries `arena_challenges` (created_at desc).
 */
export async function publishArenaChallenge({
  id,
  sport = 'COMBAT',
  targetTitle,
  targetDetails = null,
  openerVideoUri = null,
  hostId,
  hostUsername,
  hostFlag,
  onUploadProgress,
} = {}) {
  const challengeId = id || newBattleId();
  const host = resolveHost({ hostId, hostUsername, hostFlag });
  const title = String(targetTitle || '').trim() || 'OPEN CHALLENGE';
  const details =
    targetDetails != null && String(targetDetails).trim()
      ? String(targetDetails).trim()
      : null;
  const category = resolvePostSport({ sport, category: sport }, 'COMBAT');
  const localOpener =
    typeof openerVideoUri === 'string' && openerVideoUri.trim()
      ? openerVideoUri.trim()
      : null;

  let publicOpenerUrl = null;
  if (localOpener) {
    if (isRemoteHttpsUri(localOpener)) {
      publicOpenerUrl = ensurePublicBawaalVideoUrl(localOpener) || localOpener;
    } else {
      try {
        console.log('[arena_challenges] UPLOAD opener start', {
          challengeId,
          localOpener: String(localOpener).slice(0, 120),
        });
        const uploaded = await uploadVideoToSupabase(
          localOpener,
          `arena-opener-${challengeId}.mp4`,
          { onProgress: onUploadProgress }
        );
        publicOpenerUrl = uploaded
          ? ensurePublicBawaalVideoUrl(uploaded) || uploaded
          : null;
        console.log('[arena_challenges] UPLOAD opener result', {
          challengeId,
          publicOpenerUrl,
        });
      } catch (err) {
        console.warn(
          '[arena_challenges] UPLOAD opener failed:',
          err?.message || err
        );
      }
    }
  }

  const localRow = {
    id: challengeId,
    host_id: host.userId,
    host_username: host.handle,
    host_flag: host.flag,
    sport: category,
    target_title: title,
    target_details: details,
    opener_video_url: publicOpenerUrl || null,
    status: 'OPEN',
    response_count: 0,
    created_at: new Date().toISOString(),
  };

  const cardExtras = {
    localOpenerUri: localOpener,
    targetDetails: details,
    _freshPublish: true,
  };

  if (!isSupabaseConfigured()) {
    console.warn(
      '[arena_challenges] INSERT skipped — Supabase not configured',
      { challengeId, payloadKeys: Object.keys(localRow) }
    );
    return {
      ok: true,
      skipped: true,
      reason: 'not-configured',
      challengeId,
      card: mapRowToCard(localRow, {
        ...cardExtras,
        // Prefer local file for instant playback when cloud is offline
        localOpenerUri: localOpener,
      }),
      localOnly: true,
      refreshed: [],
    };
  }

  console.log('[arena_challenges] INSERT payload', {
    table: TABLE,
    challengeId,
    payload: localRow,
    payloadKeys: Object.keys(localRow),
  });

  try {
    const { data, error, status, statusText } = await supabase
      .from(TABLE)
      .upsert(localRow, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error(
        '[arena_challenges] INSERT error — schema/payload mismatch?',
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status,
          statusText,
          payload: localRow,
          setupHint: ARENA_CHALLENGES_SETUP_HINT,
        }
      );
      throw error;
    }

    console.log('[arena_challenges] INSERT ok', {
      id: data?.id || challengeId,
      opener_video_url: data?.opener_video_url || localRow.opener_video_url,
      created_at: data?.created_at || localRow.created_at,
      rowKeys: data ? Object.keys(data) : [],
    });

    // Instant feed sync — re-query newest-first so Arena can paint the new reel
    const refreshed = await fetchArenaChallenges({ limit: 40 });
    console.log('[arena_challenges] REFRESH after insert', {
      count: refreshed.length,
      includesNew: refreshed.some((c) => String(c?.id) === String(challengeId)),
    });

    return {
      ok: true,
      challengeId,
      row: data,
      card: mapRowToCard(data || localRow, cardExtras),
      refreshed,
    };
  } catch (error) {
    const msg = String(error?.message || error);
    console.warn('[arena_challenges] INSERT soft-fallback:', {
      message: msg,
      challengeId,
      payload: localRow,
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
    });
    return {
      ok: true,
      softFallback: true,
      error: msg,
      challengeId,
      card: mapRowToCard(localRow, cardExtras),
      localOnly: true,
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
      refreshed: [],
    };
  }
}

export function mapArenaChallengeRowToCard(row) {
  return mapRowToCard(row);
}

export default {
  publishArenaChallenge,
  fetchArenaChallenges,
  mapArenaChallengeRowToCard,
  ARENA_CHALLENGES_SETUP_HINT,
};
