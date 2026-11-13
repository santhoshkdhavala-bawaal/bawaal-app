/**
 * Reel ⋮ social actions — local-first with soft-fail Supabase sync.
 * Actions: DM · Like · Follow/Unfollow · Share · Save · Banter · Comment · Send
 * Follow is sheet-only — never a canvas overlay CTA.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import {
  postVideoComment,
  toggleVideoLike,
} from './videoSocialService';

const QUEUE_KEY = '@bawaal/reel_social_queue_v1';
const FOLLOW_SET_KEY = '@bawaal/reel_following_ids_v1';

function actorId() {
  const u = getActiveUser?.() || {};
  return String(u.userId || u.id || u.handle || 'local-athlete');
}

function targetFromReel(reel) {
  if (!reel || typeof reel !== 'object') return {};
  return {
    reelId: String(reel.id || reel.challengeId || ''),
    ownerId: String(
      reel.user_id || reel.userId || reel.hostId || reel.author || ''
    ),
    handle: String(reel.author || reel.handle || reel.host || ''),
  };
}

async function pushLocalEvent(event) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    next.unshift(event);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next.slice(0, 200)));
  } catch (err) {
    console.warn('[reelSocial] local queue failed:', err?.message || err);
  }
}

/** Session short-circuit for missing / 404 tables (reel_likes, reel_banter, …). */
const missingSocialTables = new Set();

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

async function softInsert(table, row) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, reason: 'offline' };
  }
  if (missingSocialTables.has(table)) {
    return { ok: false, fromCloud: false, reason: 'table-missing' };
  }
  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) {
      if (isMissingRelationError(error)) {
        if (!missingSocialTables.has(table)) {
          missingSocialTables.add(table);
          console.warn(
            `[reelSocial] ${table} unavailable — local fallback only`,
            { reason: error.message || error.code }
          );
        }
        return { ok: false, fromCloud: false, reason: 'table-missing' };
      }
      return { ok: false, fromCloud: false, error };
    }
    return { ok: true, fromCloud: true };
  } catch (err) {
    if (isMissingRelationError(err)) {
      missingSocialTables.add(table);
    }
    return { ok: false, fromCloud: false, error: err };
  }
}

async function softDeleteFollow(followerId, followingId) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, reason: 'offline' };
  }
  if (missingSocialTables.has('reel_follows')) {
    return { ok: false, fromCloud: false, reason: 'table-missing' };
  }
  try {
    const { error } = await supabase
      .from('reel_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) {
      if (isMissingRelationError(error)) {
        missingSocialTables.add('reel_follows');
      }
      return { ok: false, fromCloud: false, error };
    }
    return { ok: true, fromCloud: true };
  } catch (err) {
    if (isMissingRelationError(err)) {
      missingSocialTables.add('reel_follows');
    }
    return { ok: false, fromCloud: false, error: err };
  }
}

async function readFollowSet() {
  try {
    const raw = await AsyncStorage.getItem(FOLLOW_SET_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

async function writeFollowSet(set) {
  try {
    await AsyncStorage.setItem(
      FOLLOW_SET_KEY,
      JSON.stringify(Array.from(set).slice(0, 500))
    );
  } catch (err) {
    console.warn('[reelSocial] follow set persist failed:', err?.message || err);
  }
}

/** Whether the active user is following this reel owner (local-first). */
export async function isFollowingReelOwner(ownerKey) {
  const key = String(ownerKey || '').trim();
  if (!key) return false;
  const set = await readFollowSet();
  return set.has(key);
}

/** Persist local follow flag for sheet Follow / Unfollow label. */
export async function setFollowingReelOwner(ownerKey, following) {
  const key = String(ownerKey || '').trim();
  if (!key) return false;
  const set = await readFollowSet();
  if (following) set.add(key);
  else set.delete(key);
  await writeFollowSet(set);
  return following;
}

/**
 * Dispatch a reel social action. Always records locally; cloud is best-effort.
 * @param {string} actionId
 * @param {object} reel
 * @param {{ message?: string, tagHandle?: string }} [extras]
 */
export async function dispatchReelSocialAction(actionId, reel, extras = {}) {
  const action = String(actionId || '').toLowerCase();
  const target = targetFromReel(reel);
  const event = {
    id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    actorId: actorId(),
    ...target,
    message: extras.message || null,
    tagHandle: extras.tagHandle || null,
    createdAt: Date.now(),
  };

  await pushLocalEvent(event);

  switch (action) {
    case 'banner_like':
    case 'like': {
      const likeResult = await toggleVideoLike(reel);
      // Soft-compat: also mirror into legacy reel_likes when cloud like table wrote
      if (likeResult?.liked && likeResult?.delta > 0) {
        void softInsert('reel_likes', {
          id: event.id,
          user_id: event.actorId,
          reel_id: target.reelId || null,
          created_at: new Date(event.createdAt).toISOString(),
        });
      }
      return likeResult;
    }
    case 'follow':
      await setFollowingReelOwner(
        target.ownerId || target.handle || target.reelId,
        true
      );
      await softInsert('follows', {
        follower_id: event.actorId,
        following_id: target.ownerId || target.handle || 'unknown',
      });
      return softInsert('reel_follows', {
        id: event.id,
        follower_id: event.actorId,
        following_id: target.ownerId || target.handle || 'unknown',
        created_at: new Date(event.createdAt).toISOString(),
      });
    case 'unfollow':
      await setFollowingReelOwner(
        target.ownerId || target.handle || target.reelId,
        false
      );
      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', event.actorId)
            .eq('following_id', target.ownerId || target.handle || 'unknown');
        } catch (_) {
          /* soft-fail */
        }
      }
      return softDeleteFollow(
        event.actorId,
        target.ownerId || target.handle || 'unknown'
      );
    case 'dm':
      return softInsert('direct_messages', {
        sender_id: event.actorId,
        receiver_id: target.ownerId || target.handle || 'unknown',
        body: extras.message || `Hey ${target.handle || ''} — saw your BAWAAL reel.`.trim(),
      });
    case 'repost':
      return softInsert('reel_reposts', {
        id: event.id,
        user_id: event.actorId,
        reel_id: target.reelId || null,
        created_at: new Date(event.createdAt).toISOString(),
      });
    case 'tag':
      return softInsert('reel_tags', {
        id: event.id,
        user_id: event.actorId,
        reel_id: target.reelId || null,
        tagged_handle: extras.tagHandle || target.handle || null,
        created_at: new Date(event.createdAt).toISOString(),
      });
    case 'banter':
    case 'comment': {
      const body =
        extras.message ||
        (action === 'banter' ? '[bawaal:head_on_fire]' : '[bawaal:laughing1]');
      const posted = await postVideoComment(reel, body);
      void softInsert('reel_banter', {
        id: event.id,
        user_id: event.actorId,
        reel_id: target.reelId || null,
        body,
        created_at: new Date(event.createdAt).toISOString(),
      });
      return posted;
    }
    case 'share':
    case 'send':
      return { ok: true, fromCloud: false, reason: 'client-share' };
    case 'save':
      return { ok: true, fromCloud: false, reason: 'local-only' };
    default:
      return { ok: true, fromCloud: false, reason: 'noop' };
  }
}

/** Peek local social queue (debug / Passport activity). */
export async function loadLocalReelSocialEvents() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
