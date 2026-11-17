/**
 * BATTLE BAWAAL real-time sync — Supabase Realtime + RPC helpers.
 * Channel: `battle:${battleId}`
 * War Cry schedule: start_time (UTC) + registration_open (5h cutoff).
 *
 * Soft-fail: missing tables / RPC / offline never crash Arena UX.
 * Broadcast events (`vote_update` / `hype_update` / `live_banter`) keep
 * clients synced even when postgres RPCs are unavailable.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import {
  resolveWarCryRegistrationOpen,
  parseWarCryStartMs,
} from '../utils/warCrySchedule';
import { softFailWarn } from '../utils/softFailLog';

const LOCAL_SENDER = 'spectator-local';

/** @type {Map<string, { channel: any, refCount: number, handlers: Set<Function> }>} */
const battleLiveRooms = new Map();

function notConfigured(extra = {}) {
  return { ok: false, skipped: true, reason: 'not-configured', ...extra };
}

function emitBattleHandlers(room, payload) {
  room?.handlers?.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      softFailWarn(
        'battleSync:handler',
        '[battleSync] handler soft-fail',
        err?.message || err
      );
    }
  });
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
  scheduledAtUTC = null,
  startTime = null,
} = {}) {
  const battleId = id || newBattleId();
  if (!isSupabaseConfigured()) {
    return notConfigured({ battleId });
  }

  try {
    const startUtc =
      startTime ||
      scheduledAtUTC ||
      (status === 'live' ? new Date().toISOString() : null);
    const startMs = parseWarCryStartMs(startUtc);
    const registrationOpen =
      status === 'live'
        ? false
        : resolveWarCryRegistrationOpen(startUtc);

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
    if (startMs != null) {
      row.start_time = new Date(startMs).toISOString();
      row.registration_open = registrationOpen;
    } else if (status === 'live') {
      row.registration_open = false;
    }

    let { data: battle, error } = await supabase
      .from('battles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    // Soft-retry without schedule columns if migration not applied yet
    if (
      error &&
      /start_time|registration_open|PGRST204|schema cache|column/i.test(
        String(error.message || error.code || '')
      )
    ) {
      const { start_time: _st, registration_open: _ro, ...baseRow } = row;
      ({ data: battle, error } = await supabase
        .from('battles')
        .upsert(baseRow, { onConflict: 'id' })
        .select()
        .single());
    }
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
 * Insert an OPEN Arena challenge from the + BATTLE FAB.
 * Soft-falls back when Supabase is offline or the status check hasn't been migrated yet.
 */
export async function createOpenChallenge({
  id,
  hostId,
  hostUsername,
  hostFlag,
  title,
  category,
  openerVideoUrl = null,
  matchLength = null,
} = {}) {
  const battleId = id || newBattleId();
  const localRow = {
    id: battleId,
    host_id: hostId || 'host-local',
    host_username: hostUsername || null,
    host_flag: hostFlag || null,
    title: title || 'OPEN CHALLENGE',
    category: category || null,
    match_length: matchLength || null,
    status: 'open',
    host_reps: 0,
    total_spectators: 1,
    opener_video_url: openerVideoUrl || null,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: 'not-configured',
      battleId,
      battle: localRow,
      localOnly: true,
    };
  }

  try {
    let { data: battle, error } = await supabase
      .from('battles')
      .upsert(localRow, { onConflict: 'id' })
      .select()
      .single();

    // Retry without opener column if schema hasn't been migrated yet
    if (
      error &&
      /opener_video_url|schema cache|PGRST204|column/i.test(
        String(error?.message || error?.details || '')
      )
    ) {
      const { opener_video_url: _omit, ...withoutOpener } = localRow;
      const retry = await supabase
        .from('battles')
        .upsert(withoutOpener, { onConflict: 'id' })
        .select()
        .single();
      battle = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return { ok: true, battleId, battle };
  } catch (error) {
    const msg = String(error?.message || error);
    // Older DBs may reject 'open' until ENSURE_BATTLES_OPEN.sql is run —
    // still return a usable local card so Arena hydrates instantly.
    console.warn('[battleSync] createOpenChallenge soft-fallback:', msg);
    return {
      ok: true,
      softFallback: true,
      error: msg,
      battleId,
      battle: localRow,
      localOnly: true,
    };
  }
}

/**
 * Subscribe to postgres_changes + live broadcast for a battle.
 * Refcount-safe — one channel per battleId.
 * @param {string} battleId
 * @param {(payload: object) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeToBattle(battleId, onUpdate) {
  if (!battleId || typeof onUpdate !== 'function') {
    return () => {};
  }
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channelName = `battle:${battleId}`;
  let room = battleLiveRooms.get(channelName);
  if (!room) {
    const handlers = new Set();
    let channel;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'battles',
            filter: `id=eq.${battleId}`,
          },
          (payload) =>
            emitBattleHandlers(battleLiveRooms.get(channelName), {
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
            emitBattleHandlers(battleLiveRooms.get(channelName), {
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
            emitBattleHandlers(battleLiveRooms.get(channelName), {
              table: 'battle_events',
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            })
        )
        .on('broadcast', { event: 'vote_update' }, (msg) => {
          emitBattleHandlers(battleLiveRooms.get(channelName), {
            table: 'broadcast',
            eventType: 'vote_update',
            new: msg?.payload || {},
          });
        })
        .on('broadcast', { event: 'hype_update' }, (msg) => {
          emitBattleHandlers(battleLiveRooms.get(channelName), {
            table: 'broadcast',
            eventType: 'hype_update',
            new: msg?.payload || {},
          });
        })
        .on('broadcast', { event: 'live_banter' }, (msg) => {
          emitBattleHandlers(battleLiveRooms.get(channelName), {
            table: 'broadcast',
            eventType: 'live_banter',
            new: msg?.payload || {},
          });
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            softFailWarn(
              'battleSync:subscribe',
              '[battleSync] channel soft-fail',
              status
            );
          }
        });
    } catch (err) {
      softFailWarn(
        'battleSync:subscribe',
        '[battleSync] subscribe soft-fail',
        err?.message || err
      );
      return () => {};
    }
    room = { channel, refCount: 0, handlers };
    battleLiveRooms.set(channelName, room);
  }

  room.handlers.add(onUpdate);
  room.refCount += 1;

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = battleLiveRooms.get(channelName);
    if (!current) return;
    current.handlers.delete(onUpdate);
    current.refCount = Math.max(0, current.refCount - 1);
    if (current.refCount === 0) {
      battleLiveRooms.delete(channelName);
      try {
        supabase.removeChannel(current.channel);
      } catch (_) {
        /* ignore */
      }
    }
  };
}

/**
 * Soft broadcast a live vote / hype / banter tick on the battle channel.
 * Never throws.
 */
export async function broadcastBattleLive(battleId, event, payload = {}) {
  if (!battleId || !isSupabaseConfigured()) {
    return notConfigured({ event });
  }
  const channelName = `battle:${battleId}`;
  try {
    let room = battleLiveRooms.get(channelName);
    let ephemeral = false;
    let channel = room?.channel;
    if (!channel) {
      ephemeral = true;
      channel = supabase.channel(channelName, {
        config: { broadcast: { self: true } },
      });
      await new Promise((resolve) => {
        channel.subscribe((status) => {
          if (
            status === 'SUBSCRIBED' ||
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            resolve(status);
          }
        });
      });
    }
    await channel.send({
      type: 'broadcast',
      event: String(event || 'vote_update'),
      payload: { ...payload, at: Date.now() },
    });
    if (ephemeral) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    }
    return { ok: true };
  } catch (err) {
    softFailWarn(
      'battleSync:broadcast',
      '[battleSync] broadcast soft-fail',
      err?.message || err
    );
    return { ok: false, error: String(err?.message || err) };
  }
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
 * Always soft-broadcasts so peers stay live even if RPC is missing.
 */
export async function castVote(battleId, challengerUserId = null, senderId = LOCAL_SENDER) {
  const side = challengerUserId ? 'rival' : 'host';
  void broadcastBattleLive(battleId, 'vote_update', {
    side,
    challengerUserId: challengerUserId || null,
    senderId: senderId || LOCAL_SENDER,
    event_type: side === 'host' ? 'VOTE_HOST' : 'VOTE_RIVAL',
  });

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
    softFailWarn(
      'battleSync:castVote',
      '[battleSync] castVote RPC soft-fail — broadcast only',
      error?.message || error
    );
    return { ok: false, error: String(error?.message || error), challengerUserId };
  }
}

/**
 * Convenience: fire HYPE event + live broadcast for hype meter sync.
 */
export async function sendHype(battleId, senderId = LOCAL_SENDER) {
  void broadcastBattleLive(battleId, 'hype_update', {
    senderId: senderId || LOCAL_SENDER,
    delta: 1,
    event_type: 'HYPE',
  });
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

    // Soft-refresh registration_open when hydrate detects the 5h cutoff crossed.
    let nextBattle = battle;
    if (battle?.start_time != null) {
      const open = resolveWarCryRegistrationOpen(battle.start_time);
      if (battle.registration_open !== open) {
        nextBattle = { ...battle, registration_open: open };
        try {
          await supabase
            .from('battles')
            .update({ registration_open: open })
            .eq('id', battleId);
        } catch (_) {
          /* soft-fail — UI still uses computed flag */
        }
      }
    }

    return { ok: true, battle: nextBattle, challengers: challengers || [] };
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
  createOpenChallenge,
  subscribeToBattle,
  broadcastBattleLive,
  sendReaction,
  sendHype,
  incrementReps,
  castVote,
  fetchBattleSnapshot,
};

export default battleSync;
