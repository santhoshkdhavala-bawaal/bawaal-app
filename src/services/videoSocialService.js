/**
 * Live Arena social graph — likes / comments / follows against Supabase.
 * Soft-fails offline or when schema is missing; never blocks feed UX.
 * Legacy `reel_likes` / `reel_banter` queries never throw or spam 404s.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import { softFailWarn } from '../utils/softFailLog';
import {
  isMissingRelationError,
  isTableDisabled,
  markTableMissing,
} from '../utils/supabaseSoftFail';

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

function markLegacyTableMissing(table, reason) {
  markTableMissing(table, 'videoSocial', reason);
}

function isLegacyTableDisabled(table) {
  return isTableDisabled(table);
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
 * Shared live social channel — one postgres_changes subscription fan-out.
 * Avoids duplicate channels / leaks when multiple sheets subscribe.
 * @type {{
 *   channel: import('@supabase/supabase-js').RealtimeChannel | null,
 *   refCount: number,
 *   listeners: Set<(evt: object) => void>,
 * }}
 */
const socialLive = {
  channel: null,
  refCount: 0,
  listeners: new Set(),
};

function emitSocialLive(evt) {
  socialLive.listeners.forEach((fn) => {
    try {
      fn(evt);
    } catch (err) {
      softFailWarn(
        'videoSocial:rt:listener',
        '[videoSocial] realtime listener soft-fail',
        err?.message || err
      );
    }
  });
}

function ensureSocialLiveChannel() {
  if (socialLive.channel || !isSupabaseConfigured()) return socialLive.channel;
  try {
    const channel = supabase.channel('arena_social_live');

    const bind = (table, idKeys) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          try {
            const row = payload?.new || payload?.old || {};
            let videoId = '';
            for (const key of idKeys) {
              if (row?.[key] != null) {
                videoId = String(row[key]);
                break;
              }
            }
            emitSocialLive({
              table,
              videoId,
              event: String(payload?.eventType || payload?.event || 'UPDATE'),
              payload,
            });
          } catch (err) {
            softFailWarn(
              `videoSocial:rt:${table}`,
              `[videoSocial] ${table} realtime soft-fail`,
              err?.message || err
            );
          }
        }
      );
    };

    bind('likes', ['video_id']);
    bind('comments', ['video_id']);
    bind('reel_likes', ['reel_id']);
    bind('reel_banter', ['reel_id']);

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        softFailWarn(
          'videoSocial:rt:subscribe',
          '[videoSocial] social channel soft-fail',
          status
        );
      }
    });

    socialLive.channel = channel;
  } catch (err) {
    softFailWarn(
      'videoSocial:rt:subscribe',
      '[videoSocial] subscribe soft-fail',
      err?.message || err
    );
    socialLive.channel = null;
  }
  return socialLive.channel;
}

function teardownSocialLiveChannel() {
  if (!socialLive.channel) return;
  try {
    supabase.removeChannel(socialLive.channel);
  } catch (_) {
    /* ignore */
  }
  socialLive.channel = null;
}

/**
 * Subscribe to live like/comment/banter inserts for a set of video ids.
 * Refcount-safe — multiple callers share one channel.
 * @returns {() => void} unsubscribe
 */
export function subscribeVideoSocial(videoIds, onChange) {
  if (!isSupabaseConfigured() || typeof onChange !== 'function') {
    return () => {};
  }
  const ids = new Set(
    (Array.isArray(videoIds) ? videoIds : []).map(String).filter(Boolean)
  );

  const listener = (evt) => {
    const table = String(evt?.table || '');
    const vid = String(evt?.videoId || '');
    if (ids.size && vid && !ids.has(vid)) return;
    // Normalize legacy reel_* → likes / comments for consumers
    const normalizedTable =
      table === 'reel_likes'
        ? 'likes'
        : table === 'reel_banter'
          ? 'comments'
          : table;
    onChange({
      table: normalizedTable,
      videoId: vid,
      payload: evt?.payload,
      sourceTable: table,
    });
  };

  socialLive.listeners.add(listener);
  socialLive.refCount += 1;
  ensureSocialLiveChannel();

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    socialLive.listeners.delete(listener);
    socialLive.refCount = Math.max(0, socialLive.refCount - 1);
    if (socialLive.refCount === 0) {
      socialLive.listeners.clear();
      teardownSocialLiveChannel();
    }
  };
}
