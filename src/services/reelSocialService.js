/**
 * Reel ⋮ social actions — local-first with soft-fail Supabase sync.
 * Actions: DM · Banner Like · Follow · Share · Repost · Tag · Banter
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';

const QUEUE_KEY = '@bawaal/reel_social_queue_v1';

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

async function softInsert(table, row) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, reason: 'offline' };
  }
  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) {
      console.warn(`[reelSocial] ${table} insert:`, error.message || error);
      return { ok: false, fromCloud: false, error };
    }
    return { ok: true, fromCloud: true };
  } catch (err) {
    console.warn(`[reelSocial] ${table} crashed:`, err?.message || err);
    return { ok: false, fromCloud: false, error: err };
  }
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
      return softInsert('reel_likes', {
        id: event.id,
        user_id: event.actorId,
        reel_id: target.reelId || null,
        created_at: new Date(event.createdAt).toISOString(),
      });
    case 'follow':
      return softInsert('reel_follows', {
        id: event.id,
        follower_id: event.actorId,
        following_id: target.ownerId || target.handle || 'unknown',
        created_at: new Date(event.createdAt).toISOString(),
      });
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
      return softInsert('reel_banter', {
        id: event.id,
        user_id: event.actorId,
        reel_id: target.reelId || null,
        body: extras.message || '🔥',
        created_at: new Date(event.createdAt).toISOString(),
      });
    case 'share':
      return { ok: true, fromCloud: false, reason: 'client-share' };
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
