/**
 * BATTLE BAWAAL real-time sync — Supabase Realtime + RPC helpers.
 * Channel: `battle:${battleId}`
 */
import { isSupabaseConfigured, supabase } from './supabase';

const LOCAL_SENDER = 'spectator-local';

function notConfigured(extra = {}) {
  return { ok: false, skipped: true, reason: 'not-configured', ...extra };
}

/** RFC4122-ish uuid for battle rows (works without crypto.randomUUID). */
export function newBattleId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Upsert a live battle row + optional first challenger (host launch).
 */
export async function createLiveBattle({
  id,
  hostId,
  hostUsername,
  hostFlag,
  title,
  category,
  matchLength,
  status = 'live',
  challenger,
} = {}) {
  const battleId = id || newBattleId();
  if (!isSupabaseConfigured()) {
    return notConfigured({ battleId });
  }

  try {
    const row = {
      id: battleId,
      host_id: hostId || 'host-local',
      host_username: hostUsername || null,
      host_flag: hostFlag || null,
      title: title || null,
      category: category || null,
      match_length: matchLength || null,
      status: status === 'scheduled' ? 'scheduled' : 'live',
      host_reps: 0,
      total_spectators: 1,
    };

    const { data: battle, error } = await supabase
      .from('battles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;

    if (challenger?.userId) {
      const { error: cErr } = await supabase.from('battle_challengers').upsert(
        {
          battle_id: battleId,
          user_id: challenger.userId,
          username: challenger.username || null,
          flag: challenger.flag || null,
          reps: challenger.reps ?? 0,
          votes: challenger.votes ?? 0,
        },
        { onConflict: 'battle_id,user_id' }
      );
      if (cErr) throw cErr;
    }

    return { ok: true, battleId, battle };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), battleId };
  }
}

/**
 * Subscribe to postgres_changes for a live battle.
 * @param {string} battleId
 * @param {(payload: { table: string, eventType: string, new: object, old: object }) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeToBattle(battleId, onUpdate) {
  if (!battleId || !isSupabaseConfigured()) {
    return () => {};
  }

  const channelName = `battle:${battleId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
      (payload) =>
        onUpdate?.({
          table: 'battles',
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battle_challengers',
        filter: `battle_id=eq.${battleId}`,
      },
      (payload) =>
        onUpdate?.({
          table: 'battle_challengers',
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battle_events',
        filter: `battle_id=eq.${battleId}`,
      },
      (payload) =>
        onUpdate?.({
          table: 'battle_events',
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        })
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (_) {
      /* ignore */
    }
  };
}

/**
 * Broadcast a floating reaction / vote event to all spectators.
 * @param {string} battleId
 * @param {string} senderId
 * @param {'HYPE'|'VOTE_HOST'|'VOTE_RIVAL'|'BANTER'} eventType
 * @param {string|null} [targetChallengerId]
 */
export async function sendReaction(
  battleId,
  senderId,
  eventType,
  targetChallengerId = null
) {
  if (!battleId || !isSupabaseConfigured()) {
    return notConfigured({ eventType });
  }

  try {
    const { data, error } = await supabase.rpc('send_battle_reaction', {
      p_battle_id: battleId,
      p_sender_id: senderId || LOCAL_SENDER,
      p_event_type: eventType,
      p_target_challenger_id: targetChallengerId,
    });
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), eventType };
  }
}

/**
 * Increment host or challenger reps (optimistic UI should update locally first).
 */
export async function incrementReps(battleId, userId, currentReps = 0) {
  if (!battleId || !userId || !isSupabaseConfigured()) {
    return notConfigured({ reps: (currentReps || 0) + 1 });
  }

  try {
    const { data, error } = await supabase.rpc('increment_battle_reps', {
      p_battle_id: battleId,
      p_user_id: userId,
      p_delta: 1,
    });
    if (error) throw error;
    return { ok: true, data, reps: data?.reps ?? currentReps + 1 };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      reps: currentReps + 1,
    };
  }
}

/**
 * Cast crowd vote — host when challengerUserId is null/empty, else rival.
 */
export async function castVote(battleId, challengerUserId = null, senderId = LOCAL_SENDER) {
  if (!battleId || !isSupabaseConfigured()) {
    return notConfigured({ challengerUserId });
  }

  try {
    const { data, error } = await supabase.rpc('cast_battle_vote', {
      p_battle_id: battleId,
      p_sender_id: senderId || LOCAL_SENDER,
      p_challenger_user_id: challengerUserId || null,
    });
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), challengerUserId };
  }
}

/**
 * Convenience: fire HYPE event for floating 🔥 broadcast.
 */
export async function sendHype(battleId, senderId = LOCAL_SENDER) {
  return sendReaction(battleId, senderId, 'HYPE', null);
}

/**
 * Fetch current battle + challengers snapshot (optional hydrate).
 */
export async function fetchBattleSnapshot(battleId) {
  if (!battleId || !isSupabaseConfigured()) {
    return notConfigured({ battle: null, challengers: [] });
  }

  try {
    const [{ data: battle, error: bErr }, { data: challengers, error: cErr }] =
      await Promise.all([
        supabase.from('battles').select('*').eq('id', battleId).maybeSingle(),
        supabase
          .from('battle_challengers')
          .select('*')
          .eq('battle_id', battleId)
          .order('votes', { ascending: false }),
      ]);
    if (bErr) throw bErr;
    if (cErr) throw cErr;
    return { ok: true, battle, challengers: challengers || [] };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      battle: null,
      challengers: [],
    };
  }
}

export const battleSync = {
  newBattleId,
  createLiveBattle,
  subscribeToBattle,
  sendReaction,
  sendHype,
  incrementReps,
  castVote,
  fetchBattleSnapshot,
};

export default battleSync;
