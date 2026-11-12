/**
 * Live Arena social graph — likes / comments / follows against Supabase.
 * Soft-fails offline or when schema is missing; never blocks feed UX.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';

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
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from('likes').select('video_id, user_id').in('video_id', ids),
      supabase.from('comments').select('video_id').in('video_id', ids),
    ]);

    // Soft-fallback to legacy reel_* if new tables missing
    let likeRows = likesRes.data;
    let commentRows = commentsRes.data;
    if (likesRes.error) {
      const legacy = await supabase
        .from('reel_likes')
        .select('reel_id, user_id')
        .in('reel_id', ids);
      likeRows = (legacy.data || []).map((r) => ({
        video_id: r.reel_id,
        user_id: r.user_id,
      }));
    }
    if (commentsRes.error) {
      const legacy = await supabase
        .from('reel_banter')
        .select('reel_id')
        .in('reel_id', ids);
      commentRows = (legacy.data || []).map((r) => ({ video_id: r.reel_id }));
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
  } catch (err) {
    console.warn('[videoSocial] fetch counts failed:', err?.message || err);
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
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from('likes').delete().eq('id', existing.id);
      if (error) {
        console.warn('[videoSocial] unlike failed:', error.message);
        return { ok: false, liked: true, delta: 0, error };
      }
      return { ok: true, liked: false, delta: -1, fromCloud: true };
    }

    const { error } = await supabase.from('likes').insert({
      user_id: userId,
      video_id: videoId,
    });
    if (error) {
      // Unique race or missing table — soft-insert legacy
      console.warn('[videoSocial] like insert:', error.message);
      await supabase.from('reel_likes').insert({
        id: `like-${Date.now()}`,
        user_id: userId,
        reel_id: videoId,
        created_at: new Date().toISOString(),
      });
      return { ok: true, liked: true, delta: 1, fromCloud: false };
    }
    return { ok: true, liked: true, delta: 1, fromCloud: true };
  } catch (err) {
    console.warn('[videoSocial] toggleLike crashed:', err?.message || err);
    return { ok: false, liked: false, delta: 0, error: err };
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
      const legacy = await supabase
        .from('reel_banter')
        .select('id, user_id, body, created_at')
        .eq('reel_id', videoId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return (legacy.data || []).map((row) => ({
        id: String(row.id),
        handle: `@${String(row.user_id || 'athlete').replace(/^@/, '')}`,
        text: row.body || '',
        gif: '💬',
        createdAt: row.created_at,
      }));
    }

    return (data || []).map((row) => ({
      id: String(row.id),
      handle: `@${String(row.user_id || 'athlete').replace(/^@/, '')}`,
      text: row.body || '',
      gif: '💬',
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('[videoSocial] fetchComments failed:', err?.message || err);
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
    gif: '💬',
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
      await supabase.from('reel_banter').insert({
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
        gif: '💬',
        createdAt: data?.created_at || local.createdAt,
      },
    };
  } catch (err) {
    console.warn('[videoSocial] postComment crashed:', err?.message || err);
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
  } catch (err) {
    console.warn('[videoSocial] subscribe failed:', err?.message || err);
    return () => {};
  }
}
