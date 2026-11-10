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
import { showBawaalAlert } from '../components/BawaalAlert';

export const ARENA_CHALLENGES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_ARENA_CHALLENGES.sql';

/** Canonical Arena challenge publish / feed table. */
const TABLE = 'arena_challenges';

/** Explicit feed columns — no sport filters (COMBAT / CRICKET / etc. all return). */
export const ARENA_CHALLENGES_FEED_SELECT =
  'id, user_id, title, description, sport, video_url, created_at';

/** Fallback if `description` is not yet migrated on the project. */
const ARENA_CHALLENGES_FEED_SELECT_LEAN =
  'id, user_id, title, sport, video_url, created_at';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Only real UUIDs are safe for arena_challenges.user_id (uuid column).
 * Rejects empty strings and placeholders like "user-santhosh", "host-local", handles.
 * @param {unknown} value
 * @returns {string|null}
 */
function asUuidOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Explicit reject of non-uuid local / pseudo ids (e.g. ACTIVE_USER id "user-santhosh")
  if (
    /^user-/i.test(s) ||
    /^host-/i.test(s) ||
    s.startsWith('@') ||
    !UUID_RE.test(s)
  ) {
    return null;
  }
  return s;
}

/**
 * Strip invalid user_id from a payload right before Supabase upsert.
 * Mutates a shallow copy — never sends non-UUID strings to a uuid column.
 * @param {Record<string, unknown>} payload
 * @returns {Record<string, unknown>}
 */
function sanitizeInsertUserId(payload) {
  const next = { ...(payload || {}) };
  const safe = asUuidOrNull(next.user_id);
  if (safe) {
    next.user_id = safe;
  } else {
    if (next.user_id != null && String(next.user_id).trim() !== '') {
      console.warn(
        '[arena_challenges] scrubbing non-UUID user_id before insert:',
        String(next.user_id)
      );
    }
    delete next.user_id;
  }
  return next;
}

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
  const description =
    row.description != null && String(row.description).trim()
      ? String(row.description).trim()
      : row.target_details || extras.targetDetails || null;
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
    description,
    targetDetails: description,
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
  console.log('[arena_challenges] FETCH start', {
    table: TABLE,
    limit,
    select: ARENA_CHALLENGES_FEED_SELECT,
    // Intentionally no .eq('sport', …) — COMBAT and all sports must return
    sportFilter: null,
  });

  if (!isSupabaseConfigured()) {
    console.warn(
      '[arena_challenges] FETCH skipped — Supabase not configured'
    );
    return [];
  }

  try {
    let { data, error, status, statusText } = await supabase
      .from(TABLE)
      .select(ARENA_CHALLENGES_FEED_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Soft-retry without description if that column is missing from schema cache
    if (
      error &&
      /description|column|schema cache|PGRST204|Could not find/i.test(
        String(error.message || error.code || '')
      )
    ) {
      console.warn(
        '[arena_challenges] FETCH retry without description column',
        { message: error.message, code: error.code }
      );
      const lean = await supabase
        .from(TABLE)
        .select(ARENA_CHALLENGES_FEED_SELECT_LEAN)
        .order('created_at', { ascending: false })
        .limit(limit);
      data = lean.data;
      error = lean.error;
      status = lean.status;
      statusText = lean.statusText;
    }

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
    // Confirm raw rows reached the client (incl. sport: 'COMBAT')
    console.log('ARENA_CHALLENGES_FETCHED:', rows);
    console.log('[arena_challenges] FETCH ok', {
      count: rows.length,
      combatCount: rows.filter(
        (r) => String(r?.sport || '').toUpperCase() === 'COMBAT'
      ).length,
      newestId: rows[0]?.id || null,
      newestCreatedAt: rows[0]?.created_at || null,
      sports: [...new Set(rows.map((r) => r?.sport).filter(Boolean))],
      sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
    });

    // Map every row — never filter out by sport
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

  // Prefer auth UUID only — never fall back to ACTIVE_USER "user-santhosh" / host-local
  let rawUserId = null;
  try {
    rawUserId = await resolveVideosUserId(host.userId);
  } catch (_) {
    rawUserId = null;
  }
  const safeUserId = asUuidOrNull(rawUserId) || asUuidOrNull(host.userId);
  if ((rawUserId || host.userId) && !safeUserId) {
    console.warn(
      '[arena_challenges] omitting non-UUID user_id from insert payload:',
      String(rawUserId || host.userId)
    );
  }

  // Required fields for arena_challenges — always set explicitly
  const requiredTitle = String(title || '').trim() || 'OPEN CHALLENGE';
  const requiredSport = String(category || sport || 'COMBAT').trim() || 'COMBAT';
  const requiredVideoUrl =
    typeof publicOpenerUrl === 'string' && publicOpenerUrl.trim()
      ? publicOpenerUrl.trim()
      : null;

  /** Canonical insert payload — title, sport, video_url always present as keys. */
  const insertPayload = {
    id: challengeId,
    title: requiredTitle,
    sport: requiredSport,
    video_url: requiredVideoUrl,
    created_at: createdAt,
  };
  if (details) {
    insertPayload.description = details;
  }
  // Only attach user_id when it is a valid UUID (omit / null otherwise)
  if (safeUserId) {
    insertPayload.user_id = safeUserId;
  }

  const localCard = mapRowToCard(insertPayload, cardExtras);

  let insertAlertShown = false;
  const reportInsertError = (error) => {
    console.error('SUPABASE_INSERT_ERROR:', error);
    const exactMessage =
      (typeof error?.message === 'string' && error.message.trim()) ||
      (typeof error === 'string' && error.trim()) ||
      (() => {
        try {
          return JSON.stringify(error);
        } catch (_) {
          return 'Unknown Supabase insert error';
        }
      })() ||
      'Unknown Supabase insert error';
    if (!insertAlertShown) {
      insertAlertShown = true;
      try {
        showBawaalAlert({
          title: 'SUPABASE INSERT ERROR',
          message: exactMessage,
        });
      } catch (alertErr) {
        console.warn(
          '[arena_challenges] alert failed:',
          alertErr?.message || alertErr
        );
      }
    }
    return exactMessage;
  };

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

  // Block insert when required fields are missing so failures are obvious
  if (!requiredTitle || !requiredSport || !requiredVideoUrl) {
    const missing = [
      !requiredTitle ? 'title' : null,
      !requiredSport ? 'sport' : null,
      !requiredVideoUrl ? 'video_url' : null,
    ].filter(Boolean);
    const missingErr = {
      message: `Missing required arena_challenges field(s): ${missing.join(', ')}`,
      code: 'BAWAAL_REQUIRED_FIELDS',
      details: { title: requiredTitle, sport: requiredSport, video_url: requiredVideoUrl },
      hint: ARENA_CHALLENGES_SETUP_HINT,
    };
    const msg = reportInsertError(missingErr);
    return {
      ok: false,
      softFallback: true,
      error: msg,
      challengeId,
      card: localCard,
      localOnly: true,
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
      refreshed: [],
    };
  }

  console.log('[arena_challenges] INSERT payload', {
    table: TABLE,
    challengeId,
    title: insertPayload.title,
    sport: insertPayload.sport,
    video_url: insertPayload.video_url,
    user_id: insertPayload.user_id,
    created_at: insertPayload.created_at,
    payload: insertPayload,
    payloadKeys: Object.keys(insertPayload),
  });

  try {
    let data = null;
    let error = null;
    let status = null;
    let statusText = null;

    try {
      // Final scrub — never send "user-santhosh" / empty / non-UUID to uuid column
      const safeRow = sanitizeInsertUserId(insertPayload);
      console.log('[arena_challenges] INSERT user_id check', {
        raw: rawUserId || host.userId || null,
        safe: safeRow.user_id ?? null,
        omitted: !Object.prototype.hasOwnProperty.call(safeRow, 'user_id'),
      });
      const insertResult = await supabase
        .from(TABLE)
        .upsert(safeRow, { onConflict: 'id' })
        .select()
        .single();
      data = insertResult.data;
      error = insertResult.error;
      status = insertResult.status;
      statusText = insertResult.statusText;
    } catch (insertThrown) {
      console.error('SUPABASE_INSERT_ERROR:', insertThrown);
      reportInsertError(insertThrown);
      throw insertThrown;
    }

    if (error) {
      console.error('SUPABASE_INSERT_ERROR:', error);
      // Soft-retry without user_id on FK/RLS noise
      if (
        insertPayload.user_id &&
        /user_id|foreign key|violates|23503|42501|RLS/i.test(
          String(error.message || error.code || '')
        )
      ) {
        console.warn('[arena_challenges] INSERT retry without user_id', {
          message: error.message,
          code: error.code,
        });
        try {
          const retry = await supabase
            .from(TABLE)
            .upsert(
              sanitizeInsertUserId({
                id: challengeId,
                title: insertPayload.title,
                sport: insertPayload.sport,
                video_url: insertPayload.video_url,
                created_at: insertPayload.created_at,
              }),
              { onConflict: 'id' }
            )
            .select()
            .single();
          data = retry.data;
          error = retry.error;
          status = retry.status;
          statusText = retry.statusText;
        } catch (retryThrown) {
          console.error('SUPABASE_INSERT_ERROR:', retryThrown);
          reportInsertError(retryThrown);
          throw retryThrown;
        }
      }
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
      try {
        const legacyPayload = sanitizeInsertUserId({
          id: challengeId,
          title: insertPayload.title,
          sport: insertPayload.sport,
          video_url: insertPayload.video_url,
          created_at: createdAt,
          host_id: String(host.userId),
          host_username: host.handle,
          host_flag: host.flag,
          target_title: insertPayload.title,
          target_details: details,
          opener_video_url: insertPayload.video_url,
          status: 'OPEN',
          response_count: 0,
          ...(safeUserId ? { user_id: safeUserId } : {}),
        });
        const retry = await supabase
          .from(TABLE)
          .upsert(legacyPayload, { onConflict: 'id' })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
        status = retry.status;
        statusText = retry.statusText;
      } catch (legacyThrown) {
        console.error('SUPABASE_INSERT_ERROR:', legacyThrown);
        reportInsertError(legacyThrown);
        throw legacyThrown;
      }
    }

    if (error) {
      console.error('SUPABASE_INSERT_ERROR:', error);
      console.error('[arena_challenges] INSERT failed details', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status,
        statusText,
        payload: {
          title: insertPayload.title,
          sport: insertPayload.sport,
          video_url: insertPayload.video_url,
          user_id: insertPayload.user_id,
          created_at: insertPayload.created_at,
        },
        setupHint: ARENA_CHALLENGES_SETUP_HINT,
      });
      reportInsertError(error);
      throw error;
    }

    console.log('[arena_challenges] INSERT ok', {
      id: data?.id || challengeId,
      title: data?.title || insertPayload.title,
      sport: data?.sport || insertPayload.sport,
      video_url: data?.video_url || insertPayload.video_url,
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
    const msg = reportInsertError(error);
    console.warn('[arena_challenges] INSERT soft-fallback:', {
      message: msg,
      challengeId,
      payload: {
        title: insertPayload.title,
        sport: insertPayload.sport,
        video_url: insertPayload.video_url,
      },
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
    });
    return {
      ok: false,
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
