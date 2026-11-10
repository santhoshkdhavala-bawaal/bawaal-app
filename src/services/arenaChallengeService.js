/**
 * Arena OPEN challenges — Storage opener upload + `public.videos` insert/fetch.
 * Canonical feed table is `videos` (caption/title, category/sport, video_url, created_at).
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
import {
  fetchArenaPostsFromSupabase,
  mapDbRowToArenaPost,
  persistArenaPostToSupabase,
  resolveVideosUserId,
} from './arenaPostsService';

export const ARENA_CHALLENGES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase_schema.sql (creates public.videos)';

/** Canonical Arena publish / feed table. */
const TABLE = 'videos';

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
 * Map a `videos` (or legacy challenge-shaped) row → Arena challenge/reel card.
 */
function mapRowToCard(row, extras = {}) {
  if (!row) return null;
  const ts = row.created_at
    ? Date.parse(row.created_at) || Date.now()
    : Number(extras.createdAt) || Date.now();
  const sport = resolvePostSport(
    {
      sport: row.category || row.sport,
      category: row.category || row.sport,
    },
    'COMBAT'
  );
  const hostRaw =
    row.host_username ||
    row.profiles?.username ||
    row.author ||
    extras.host ||
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
    row.caption || row.title || row.target_title || 'OPEN CHALLENGE'
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
    _fromVideosTable: true,
    _freshPublish: !!extras._freshPublish,
    ...extras,
  };
}

/**
 * Fetch Arena items from `videos` newest-first (`created_at` desc).
 * Soft-fails to [] on schema/RLS/network errors (never throws).
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>} feed-ready cards
 */
export async function fetchArenaChallenges(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 80);
  console.log('[videos] FETCH start', { table: TABLE, limit });

  if (!isSupabaseConfigured()) {
    console.warn('[videos] FETCH skipped — Supabase not configured');
    return [];
  }

  try {
    // Prefer shared Arena posts fetch (videos ⨝ profiles, created_at desc)
    const posts = await fetchArenaPostsFromSupabase();
    if (Array.isArray(posts) && posts.length > 0) {
      console.log('[videos] FETCH ok via arenaPostsService', {
        count: posts.length,
        newestId: posts[0]?.id || null,
      });
      return posts.slice(0, limit).map((post) =>
        mapRowToCard(
          {
            id: post.id,
            video_url: post.videoUri || post.video_url || post.uri,
            caption: post.caption || post.title,
            title: post.title || post.caption,
            category: post.category || post.sport,
            created_at:
              typeof post.createdAt === 'number'
                ? new Date(post.createdAt).toISOString()
                : post.created_at,
            author: post.author,
            profiles: post.avatarUrl
              ? { username: post.author, avatar_url: post.avatarUrl }
              : null,
          },
          { _fromVideosTable: true }
        )
      );
    }

    const { data, error, status, statusText } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[videos] FETCH error — schema/RLS mismatch?', {
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
    console.log('[videos] FETCH ok', {
      count: rows.length,
      newestId: rows[0]?.id || null,
      newestCreatedAt: rows[0]?.created_at || null,
      sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
    });

    return rows
      .map((row) => mapDbRowToArenaPost(row) || mapRowToCard(row))
      .filter(Boolean);
  } catch (err) {
    console.error('[videos] FETCH crashed:', {
      message: err?.message || String(err),
      err,
    });
    return [];
  }
}

/**
 * Upload opener (if local) + insert into `public.videos`
 * (`caption`←title, `category`←sport, `video_url`, `created_at`).
 * Soft-falls back to a local feed card when cloud is offline / insert fails.
 * On success, immediately re-queries `videos` (created_at desc).
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
        console.log('[videos] UPLOAD opener start', {
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
        console.log('[videos] UPLOAD opener result', {
          challengeId,
          publicOpenerUrl,
        });
      } catch (err) {
        console.warn('[videos] UPLOAD opener failed:', err?.message || err);
      }
    }
  }

  const caption = details ? `${title} — ${details}` : title;
  const createdAt = new Date().toISOString();

  /** `videos` row — title→caption, sport→category (schema columns). */
  const videosRow = {
    id: challengeId,
    video_url: publicOpenerUrl || null,
    caption,
    // Conceptual title/sport aliases for logging / soft schema retries
    title,
    sport: category,
    category,
    created_at: createdAt,
  };

  const cardExtras = {
    localOpenerUri: localOpener,
    targetDetails: details,
    host: host.handle,
    _freshPublish: true,
  };

  const localCard = mapRowToCard(
    {
      id: challengeId,
      video_url: publicOpenerUrl,
      caption,
      title,
      category,
      created_at: createdAt,
      host_username: host.handle,
      status: 'OPEN',
    },
    cardExtras
  );

  if (!isSupabaseConfigured()) {
    console.warn('[videos] INSERT skipped — Supabase not configured', {
      challengeId,
      payloadKeys: Object.keys(videosRow),
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

  if (!publicOpenerUrl || !isRemoteHttpsUri(publicOpenerUrl)) {
    console.warn(
      '[videos] INSERT skipped — need public HTTPS video_url before write',
      { challengeId, publicOpenerUrl }
    );
    return {
      ok: true,
      softFallback: true,
      reason: 'missing-https-url',
      challengeId,
      card: localCard,
      localOnly: true,
      refreshed: [],
    };
  }

  // Attach auth uuid when available (FK / RLS)
  let userId = null;
  try {
    userId = await resolveVideosUserId(host.userId);
  } catch (_) {
    userId = null;
  }

  const insertPayload = {
    id: challengeId,
    video_url: publicOpenerUrl,
    caption,
    category,
    created_at: createdAt,
  };
  if (userId) insertPayload.user_id = userId;

  console.log('[videos] INSERT payload', {
    table: TABLE,
    challengeId,
    payload: insertPayload,
    payloadKeys: Object.keys(insertPayload),
    title,
    sport: category,
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
      userId &&
      /user_id|foreign key|violates|23503|42501|RLS/i.test(
        String(error.message || error.code || '')
      )
    ) {
      console.warn('[videos] INSERT retry without user_id', {
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

    // Unknown title/sport columns should never be in insertPayload — but if caption/category
    // naming drifts, fall back through persistArenaPostToSupabase.
    if (error) {
      console.error('[videos] INSERT error — schema/payload mismatch?', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status,
        statusText,
        payload: insertPayload,
        setupHint: ARENA_CHALLENGES_SETUP_HINT,
      });

      console.log('[videos] INSERT soft-retry via persistArenaPostToSupabase');
      const persistRes = await persistArenaPostToSupabase({
        id: challengeId,
        title,
        caption,
        sport: category,
        category,
        video_url: publicOpenerUrl,
        videoUri: publicOpenerUrl,
        publicCloudUrl: publicOpenerUrl,
        user_id: userId,
        timestamp: Date.parse(createdAt) || Date.now(),
        createdAt: Date.parse(createdAt) || Date.now(),
        _freshPublish: true,
      });
      if (!persistRes?.ok && !persistRes?.skipped) {
        throw error;
      }
      data = { ...insertPayload, id: persistRes?.id || challengeId };
    }

    console.log('[videos] INSERT ok', {
      id: data?.id || challengeId,
      video_url: data?.video_url || insertPayload.video_url,
      caption: data?.caption || caption,
      category: data?.category || category,
      created_at: data?.created_at || createdAt,
      rowKeys: data ? Object.keys(data) : [],
    });

    // Instant feed sync — re-query videos newest-first
    const refreshed = await fetchArenaChallenges({ limit: 40 });
    console.log('[videos] REFRESH after insert', {
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
    console.warn('[videos] INSERT soft-fallback:', {
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
  // Prefer reel mapper for pure videos rows, then challenge card shape
  if (row && (row.video_url || row._fromVideosTable) && !row.opener_video_url) {
    const reel = mapDbRowToArenaPost(row);
    if (reel) return { ...reel, isOpenChallenge: true, source: 'ARENA_CHALLENGE' };
  }
  return mapRowToCard(row);
}

export default {
  publishArenaChallenge,
  fetchArenaChallenges,
  mapArenaChallengeRowToCard,
  ARENA_CHALLENGES_SETUP_HINT,
};
