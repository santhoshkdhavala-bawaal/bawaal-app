/**
 * Live Arena social graph — likes / comments / follows against Supabase.
 * Soft-fails offline or when schema is missing; never blocks feed UX.
 * Legacy `reel_likes` / `reel_banter` queries never throw or spam 404s.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import { softFailWarn } from '../utils/softFailLog';

function actorId() {
  const u = getActiveUser?.() || {};
  return String(u.userId || u.id || u.handle || 'local-athlete');
}

function videoKey(reelOrId) {
  if (reelOrId == null) return '';
  if (typeof reelOrId === 'string' || typeof reelOrId === 'number') {
    return String(reelOrId);
  }
  return String(reelOrId.id || reelOrId.videoId || reelOrId.reelId || '');
}

/** Session short-circuit for missing legacy reel_* tables (stops 404 spam). */
const missingLegacyTables = new Set();

function isMissingRelationError(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const msg = String(error.message || error.details || error.hint || error || '');
  return (
    status === 404 ||
    status === 400 ||
    code === '42P01' ||
    code === 'PGRST116' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    /does not exist|relation .* not found|Could not find the table|schema cache|not found|404/i.test(
      msg
    )
  );
}

function markLegacyTableMissing(table, reason) {
  if (missingLegacyTables.has(table)) return;
  missingLegacyTables.add(table);
  softFailWarn(`videoSocial:${table}`, `[videoSocial] ${table} unavailable — using local empty fallback`, { reason: String(reason || 'missing') });
}

function isLegacyTableDisabled(table) {
  return missingLegacyTables.has(table);
}

/**
 * Soft select from a legacy reel_* table. Returns [] on 404 / missing table / throw.
 * @param {string} table
 * @param {(q: any) => any} buildQuery — receives supabase.from(table) builder
 */
async function softLegacySelect(table, buildQuery) {
  if (!isSupabaseConfigured() || isLegacyTableDisabled(table)) {
    return [];
  }
  try {
    const query = buildQuery(supabase.from(table));
    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) {
        markLegacyTableMissing(table, error.message || error.code);
      }
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (isMissingRelationError(err)) {
      markLegacyTableMissing(table, err?.message || err);
    }
    return [];
  }
}

/**
 * Soft insert into a legacy reel_* table. Never throws; no-ops when missing.
 * @param {string} table
 * @param {Record<string, unknown>} row
 */
async function softLegacyInsert(table, row) {
  if (!isSupabaseConfigured() || isLegacyTableDisabled(table)) {
    return { ok: false, fromCloud: false };
  }
  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) {
      if (isMissingRelationError(error)) {
        markLegacyTableMissing(table, error.message || error.code);
      }
      return { ok: false, fromCloud: false, error };
    }
    return { ok: true, fromCloud: true };
  } catch (err) {
    if (isMissingRelationError(err)) {
      markLegacyTableMissing(table, err?.message || err);
    }
    return { ok: false, fromCloud: false, error: err };
  }
}

/**
 * Batch like + comment counts for a list of video ids.
 * @param {string[]} videoIds
 * @returns {Promise<Record<string, { likeCount: number, commentCount: number, likedByMe: boolean }>>}
 */
export async function fetchVideoSocialCounts(videoIds = []) {
  const ids = [...new Set((videoIds || []).map(String).filter(Boolean))];
  const empty = {};
  ids.forEach((id) => {
    empty[id] = { likeCount: 0, commentCount: 0, likedByMe: false };
  });
  if (!ids.length || !isSupabaseConfigured()) return empty;

  const me = actorId();
  try {
    let likesRes;
    let commentsRes;
    try {
      [likesRes, commentsRes] = await Promise.all([
        supabase.from('likes').select('video_id, user_id').in('video_id', ids),
        supabase.from('comments').select('video_id').in('video_id', ids),
      ]);
    } catch (_) {
      return empty;
    }

    let likeRows = likesRes?.error ? null : likesRes?.data;
    let commentRows = commentsRes?.error ? null : commentsRes?.data;

    // Soft-fallback to legacy reel_* if new tables missing — never throw on 404
    if (likesRes?.error || likeRows == null) {
      const legacy = await softLegacySelect('reel_likes', (q) =>
        q.select('reel_id, user_id').in('reel_id', ids)
      );
      likeRows = legacy.map((r) => ({
        video_id: r.reel_id,
        user_id: r.user_id,
      }));
    }
    if (commentsRes?.error || commentRows == null) {
      const legacy = await softLegacySelect('reel_banter', (q) =>
        q.select('reel_id').in('reel_id', ids)
      );
      commentRows = legacy.map((r) => ({ video_id: r.reel_id }));
    }

    const out = { ...empty };
    (likeRows || []).forEach((row) => {
      const id = String(row.video_id || '');
      if (!out[id]) out[id] = { likeCount: 0, commentCount: 0, likedByMe: false };
      out[id].likeCount += 1;
      if (String(row.user_id) === me) out[id].likedByMe = true;
    });
    (commentRows || []).forEach((row) => {
      const id = String(row.video_id || '');
      if (!out[id]) out[id] = { likeCount: 0, commentCount: 0, likedByMe: false };
      out[id].commentCount += 1;
    });
    return out;
  } catch (_) {
    return empty;
  }
}

/** Toggle like for the active user. Returns next liked state + count delta. */
export async function toggleVideoLike(reel) {
  const videoId = videoKey(reel);
  const userId = actorId();
  if (!videoId) return { ok: false, liked: false, delta: 0 };

  if (!isSupabaseConfigured()) {
    return { ok: true, liked: true, delta: 1, fromCloud: false };
  }

  try {
    const { data: existing, error: lookupError } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (lookupError && isMissingRelationError(lookupError)) {
      // Primary likes table missing — try legacy once, else local mock
      const legacy = await softLegacyInsert('reel_likes', {
        id: `like-${Date.now()}`,
        user_id: userId,
        reel_id: videoId,
        created_at: new Date().toISOString(),
      });
      return {
        ok: true,
        liked: true,
        delta: 1,
        fromCloud: Boolean(legacy.fromCloud),
      };
    }

    if (existing?.id) {
      const { error } = await supabase.from('likes').delete().eq('id', existing.id);
      if (error) {
        return { ok: true, liked: false, delta: -1, fromCloud: false };
      }
      return { ok: true, liked: false, delta: -1, fromCloud: true };
    }

    const { error } = await supabase.from('likes').insert({
      user_id: userId,
      video_id: videoId,
    });
    if (error) {
      // Unique race or missing table — soft-insert legacy (no console spam)
      await softLegacyInsert('reel_likes', {
        id: `like-${Date.now()}`,
        user_id: userId,
        reel_id: videoId,
        created_at: new Date().toISOString(),
      });
      return { ok: true, liked: true, delta: 1, fromCloud: false };
    }
    return { ok: true, liked: true, delta: 1, fromCloud: true };
  } catch (_) {
    return { ok: true, liked: true, delta: 1, fromCloud: false };
  }
}

/** Fetch comment/banter rows for a video (newest first). */
export async function fetchVideoComments(reel, limit = 40) {
  const videoId = videoKey(reel);
  if (!videoId || !isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      const legacy = await softLegacySelect('reel_banter', (q) =>
        q
          .select('id, user_id, body, created_at')
          .eq('reel_id', videoId)
          .order('created_at', { ascending: false })
          .limit(limit)
      );
      return legacy.map((row) => ({
        id: String(row.id),
        handle: `@${String(row.user_id || 'athlete').replace(/^@/, '')}`,
        text: row.body || '',
        emotion: 'laughing1',
        gif: 'laughing1',
        createdAt: row.created_at,
      }));
    }

    return (data || []).map((row) => ({
      id: String(row.id),
      handle: `@${String(row.user_id || 'athlete').replace(/^@/, '')}`,
      text: row.body || '',
      emotion: 'laughing1',
      gif: 'laughing1',
      createdAt: row.created_at,
    }));
  } catch (_) {
    return [];
  }
}

/** Persist a comment / banter line. */
export async function postVideoComment(reel, body) {
  const videoId = videoKey(reel);
  const text = String(body || '').trim();
  const userId = actorId();
  if (!videoId || !text) return { ok: false };

  const local = {
    id: `local-${Date.now()}`,
    handle: '@you',
    text,
    emotion: 'laughing1',
    gif: 'laughing1',
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    return { ok: true, comment: local, fromCloud: false };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: userId, video_id: videoId, body: text })
      .select('id, user_id, body, created_at')
      .maybeSingle();

    if (error) {
      await softLegacyInsert('reel_banter', {
        id: local.id,
        user_id: userId,
        reel_id: videoId,
        body: text,
        created_at: local.createdAt,
      });
      return { ok: true, comment: local, fromCloud: false };
    }

    return {
      ok: true,
      fromCloud: true,
      comment: {
        id: String(data?.id || local.id),
        handle: '@you',
        text: data?.body || text,
        emotion: 'laughing1',
        gif: 'laughing1',
        createdAt: data?.created_at || local.createdAt,
      },
    };
  } catch (_) {
    return { ok: true, comment: local, fromCloud: false };
  }
}

/**
 * Subscribe to live like/comment inserts for a set of video ids.
 * @returns {() => void} unsubscribe
 */
export function subscribeVideoSocial(videoIds, onChange) {
  if (!isSupabaseConfigured() || !Array.isArray(videoIds) || !videoIds.length) {
    return () => {};
  }
  const ids = videoIds.map(String);
  try {
    const channel = supabase
      .channel(`arena-social-${ids.slice(0, 4).join('-')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        (payload) => {
          const vid = String(
            payload.new?.video_id || payload.old?.video_id || ''
          );
          if (ids.includes(vid)) onChange?.({ table: 'likes', videoId: vid, payload });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          const vid = String(
            payload.new?.video_id || payload.old?.video_id || ''
          );
          if (ids.includes(vid)) onChange?.({ table: 'comments', videoId: vid, payload });
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    };
  } catch (_) {
    return () => {};
  }
}
