/**
 * App Store / Play UGC moderation — Report Content + Block User.
 * Soft-fails when tables/RLS missing; always records a local event.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { softFailWarn } from '../utils/softFailLog';

const BLOCKS_KEY = '@bawaal/user_blocks_v1';
const REPORTS_KEY = '@bawaal/content_reports_v1';

async function currentActorId() {
  try {
    if (!isSupabaseConfigured()) return 'local';
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || 'local';
  } catch {
    return 'local';
  }
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* soft */
  }
}

/**
 * @param {{
 *   targetType: 'video'|'live'|'profile'|'comment'|'message'|'other',
 *   targetId: string,
 *   targetOwnerId?: string,
 *   reason?: string,
 *   details?: string,
 * }} args
 */
export async function reportContent({
  targetType,
  targetId,
  targetOwnerId,
  reason = 'inappropriate',
  details = '',
} = {}) {
  const reporterId = await currentActorId();
  const type = String(targetType || 'other').toLowerCase();
  const id = String(targetId || '').trim();
  if (!id) {
    return { ok: false, error: new Error('Missing report target') };
  }

  const row = {
    reporter_id: reporterId,
    target_type: type,
    target_id: id,
    target_owner_id: targetOwnerId ? String(targetOwnerId) : null,
    reason: String(reason || 'inappropriate').slice(0, 120),
    details: String(details || '').slice(0, 1000),
    status: 'open',
  };

  const local = await readJson(REPORTS_KEY, []);
  local.unshift({ ...row, id: `local-${Date.now()}`, created_at: new Date().toISOString() });
  await writeJson(REPORTS_KEY, local.slice(0, 200));

  if (!isSupabaseConfigured() || reporterId === 'local') {
    return { ok: true, mode: 'local' };
  }

  try {
    const { error } = await supabase.from('content_reports').insert(row);
    if (error) {
      softFailWarn(
        'moderation:report',
        '[moderation] report soft-fail',
        error.message
      );
      return { ok: true, mode: 'local', error };
    }
    return { ok: true, mode: 'supabase' };
  } catch (err) {
    softFailWarn(
      'moderation:reportEx',
      '[moderation] report exception',
      err?.message || err
    );
    return { ok: true, mode: 'local', error: err };
  }
}

/**
 * @param {{ blockedId: string, reason?: string }} args
 */
export async function blockUser({ blockedId, reason = '' } = {}) {
  const blockerId = await currentActorId();
  const blocked = String(blockedId || '').trim();
  if (!blocked) {
    return { ok: false, error: new Error('Missing user to block') };
  }
  if (blocked === blockerId) {
    return { ok: false, error: new Error('You cannot block yourself') };
  }

  const set = new Set(await readJson(BLOCKS_KEY, []));
  set.add(blocked);
  await writeJson(BLOCKS_KEY, Array.from(set));

  if (!isSupabaseConfigured() || blockerId === 'local') {
    return { ok: true, mode: 'local' };
  }

  try {
    const { error } = await supabase.from('user_blocks').upsert(
      {
        blocker_id: blockerId,
        blocked_id: blocked,
        reason: String(reason || '').slice(0, 200) || null,
      },
      { onConflict: 'blocker_id,blocked_id' }
    );
    if (error) {
      softFailWarn(
        'moderation:block',
        '[moderation] block soft-fail',
        error.message
      );
      return { ok: true, mode: 'local', error };
    }
    return { ok: true, mode: 'supabase' };
  } catch (err) {
    softFailWarn(
      'moderation:blockEx',
      '[moderation] block exception',
      err?.message || err
    );
    return { ok: true, mode: 'local', error: err };
  }
}

export async function isUserBlocked(userId) {
  const id = String(userId || '').trim();
  if (!id) return false;
  const set = new Set(await readJson(BLOCKS_KEY, []));
  return set.has(id);
}

export async function listBlockedUserIds() {
  return readJson(BLOCKS_KEY, []);
}
