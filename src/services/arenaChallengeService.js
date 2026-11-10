/**
 * Arena OPEN challenges — Storage opener upload + `public.arena_challenges`.
 * Canonical columns: title, sport, video_url, user_id, created_at.
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
import { resolveVideosUserId } from './arenaPostsService';

export const ARENA_CHALLENGES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_ARENA_CHALLENGES.sql';

/** Canonical Arena challenge publish / feed table. */
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

/**
 * Map an `arena_challenges` row → Arena feed card.
 * Supports new columns (title, sport, video_url, user_id) + legacy aliases.
 */
function mapRowToCard(row, extras = {}) {
  if (!row) return null;
  const ts = row.created_at
    ? Date.parse(row.created_at) || Date.now()
    : Number(extras.createdAt) || Date.now();
  const sport = resolvePostSport(
    {
      sport: row.sport || row.category,
      category: row.sport || row.category,
    },
    'COMBAT'
  );
  const hostRaw =
    row.host_username ||
    extras.host ||
    row.user_id ||
    '@YOU';
  const host = String(hostRaw).startsWith('@')
    ? String(hostRaw)
    : `@${String(hostRaw).replace(/^@/, '')}`;
  const opener =
    ensurePublicBawaalVideoUrl(
      row.video_url || row.opener_video_url || row.videoUri
    ) ||
    row.video_url ||
    row.opener_video_url ||
    extras.localOpenerUri ||
    null;
  const id = String(row.id);
  const target = String(
    row.title || row.target_title || row.caption || 'OPEN CHALLENGE'
  );
  return {
    id,
    challengeId: id,
    battleId: id,
    type: 'battle_thread',
    isOpenChallenge: true,
    isBattle: true,
    status:
      String(row.status || 'OPEN').toUpperCase() === 'OPEN'
        ? 'OPEN'
        : row.status || 'OPEN',
    sport,
    category: sport,
    target,
    title: target,
    caption: target,
    targetDetails: row.target_details || extras.targetDetails || null,
    host,
    opponent: host,
    author: host || 'CHALLENGE',
    user_id: row.user_id || null,
    challengerLabel: '@YOU',
    leaderLabel: 'OPEN',
    challengeVideoUri: opener,
    openerVideoUri: opener,
    videoUri: opener,
    uri: opener,
    video_url: opener,
    localVideoUri: extras.localOpenerUri || null,
    publicCloudUrl: isRemoteHttpsUri(opener) ? opener : null,
    responses: [],
    responseCount: Number(row.response_count) || 0,
    timestamp: ts,
    createdAt: ts,
    feedTarget: 'ARENA',
    source: 'ARENA_CHALLENGE',
    _fromArenaChallenges: true,
    _freshPublish: !!extras._freshPublish,
    ...extras,
  };
}

/**
 * Fetch Arena challenges newest-first from `arena_challenges` (`created_at` desc).
 * Soft-fails to [] on schema/RLS/network errors (never throws).
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>} feed-ready cards
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
 * Upload opener (if local) + insert into `arena_challenges`
 * (`title`, `sport`, `video_url`, `user_id`, `created_at`).
 * On success, re-queries the table (created_at desc) for instant Arena paint.
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

  const createdAt = new Date().toISOString();
  const cardExtras = {
    localOpenerUri: localOpener,
    targetDetails: details,
    host: host.handle,
    _freshPublish: true,
  };

  let userId = null;
  try {
    userId = (await resolveVideosUserId(host.userId)) || host.userId || null;
  } catch (_) {
    userId = host.userId || null;
  }

  /** Canonical insert payload for the new arena_challenges table. */
  const insertPayload = {
    id: challengeId,
    title,
    sport: category,
    video_url: publicOpenerUrl || null,
    user_id: userId != null ? String(userId) : null,
    created_at: createdAt,
  };

  const localCard = mapRowToCard(insertPayload, cardExtras);

  if (!isSupabaseConfigured()) {
    console.warn('[arena_challenges] INSERT skipped — Supabase not configured', {
      challengeId,
      payloadKeys: Object.keys(insertPayload),
    });
    return {
      ok: true,
      skipped: true,
      reason: 'not-configured',
      challengeId,
      card: localCard,
      localOnly: true,
      refreshed: [],
    };
  }

  console.log('[arena_challenges] INSERT payload', {
    table: TABLE,
    challengeId,
    payload: insertPayload,
    payloadKeys: Object.keys(insertPayload),
  });

  try {
    let { data, error, status, statusText } = await supabase
      .from(TABLE)
      .upsert(insertPayload, { onConflict: 'id' })
      .select()
      .single();

    // Soft-retry without user_id on FK/RLS noise
    if (
      error &&
      insertPayload.user_id &&
      /user_id|foreign key|violates|23503|42501|RLS/i.test(
        String(error.message || error.code || '')
      )
    ) {
      console.warn('[arena_challenges] INSERT retry without user_id', {
        message: error.message,
        code: error.code,
      });
      const { user_id: _omit, ...withoutUser } = insertPayload;
      const retry = await supabase
        .from(TABLE)
        .upsert(withoutUser, { onConflict: 'id' })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      status = retry.status;
      statusText = retry.statusText;
    }

    // Legacy schema soft-retry (target_title / opener_video_url / host_*)
    if (
      error &&
      /column|schema cache|PGRST204|Could not find/i.test(
        String(error.message || error.code || '')
      )
    ) {
      console.warn(
        '[arena_challenges] INSERT retry with legacy column aliases',
        { message: error.message, code: error.code }
      );
      const legacyPayload = {
        id: challengeId,
        title,
        sport: category,
        video_url: publicOpenerUrl || null,
        user_id: insertPayload.user_id,
        created_at: createdAt,
        host_id: String(host.userId),
        host_username: host.handle,
        host_flag: host.flag,
        target_title: title,
        target_details: details,
        opener_video_url: publicOpenerUrl || null,
        status: 'OPEN',
        response_count: 0,
      };
      const retry = await supabase
        .from(TABLE)
        .upsert(legacyPayload, { onConflict: 'id' })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      status = retry.status;
      statusText = retry.statusText;
    }

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
          payload: insertPayload,
          setupHint: ARENA_CHALLENGES_SETUP_HINT,
        }
      );
      throw error;
    }

    console.log('[arena_challenges] INSERT ok', {
      id: data?.id || challengeId,
      title: data?.title || title,
      sport: data?.sport || category,
      video_url: data?.video_url || publicOpenerUrl,
      user_id: data?.user_id || insertPayload.user_id,
      created_at: data?.created_at || createdAt,
      rowKeys: data ? Object.keys(data) : [],
    });

    const refreshed = await fetchArenaChallenges({ limit: 40 });
    console.log('[arena_challenges] REFRESH after insert', {
      count: refreshed.length,
      includesNew: refreshed.some((c) => String(c?.id) === String(challengeId)),
    });

    return {
      ok: true,
      challengeId: data?.id || challengeId,
      row: data,
      card: mapRowToCard(data || insertPayload, cardExtras),
      refreshed,
    };
  } catch (error) {
    const msg = String(error?.message || error);
    console.warn('[arena_challenges] INSERT soft-fallback:', {
      message: msg,
      challengeId,
      payload: insertPayload,
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
    });
    return {
      ok: true,
      softFallback: true,
      error: msg,
      challengeId,
      card: localCard,
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
