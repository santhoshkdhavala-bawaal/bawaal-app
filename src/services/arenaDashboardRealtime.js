/**
 * Arena dashboard realtime — live War Cry scores / spectators + shelf inserts.
 *
 * Channels:
 *  - postgres_changes on war_cry_matches / sparks_josh_clips /
 *    battle_bawaal_reels / face_off_challenges
 *  - broadcast `arena_dashboard_room` for room interactions (scores / spectators / banter)
 *
 * Single shared channel + refcount — no duplicate listeners / memory leaks.
 * Soft-fail when Supabase is offline — never throws into Arena UX.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { softFailWarn } from '../utils/softFailLog';
import { ARENA_DASHBOARD_TABLES } from './arenaDashboardService';

const CHANNEL_NAME = 'arena_dashboard_live';
const ROOM_BROADCAST = 'arena_dashboard_room';

/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let activeChannel = null;
let refCount = 0;
/** Latest handler bag — React remounts update this without resubscribing. */
let handlersRef = {};

function dispatch(method, ...args) {
  try {
    const fn = handlersRef?.[method];
    if (typeof fn === 'function') fn(...args);
  } catch (err) {
    softFailWarn(
      `arenaDashboardRt:dispatch:${method}`,
      `[arenaDashboardRt] ${method} soft-fail`,
      err?.message || err
    );
  }
}

function ensureChannel() {
  if (activeChannel) return activeChannel;
  if (!isSupabaseConfigured()) return null;

  try {
    const channel = supabase.channel(CHANNEL_NAME);

    const bindTable = (table, method) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          try {
            const row = payload?.new || payload?.old || null;
            if (!row) return;
            const event = String(
              payload?.eventType || payload?.event || 'UPDATE'
            );
            dispatch(method, row, event);
            if (
              table === ARENA_DASHBOARD_TABLES.warCry &&
              (event === 'UPDATE' || event === 'INSERT')
            ) {
              dispatch('onScoreUpdate', {
                matchId: row.id,
                hostScore: Number(row.host_score) || 0,
                rivalScore: Number(row.rival_score) || 0,
                spectatorCount: Number(row.spectator_count) || 0,
                hostHandle: row.host_handle,
                rivalHandle: row.rival_handle,
                sport: row.sport,
                status: row.status,
                roomId: row.room_id || row.id,
              });
            }
          } catch (err) {
            softFailWarn(
              `arenaDashboardRt:${table}`,
              `[arenaDashboardRt] ${table} handler soft-fail`,
              err?.message || err
            );
          }
        }
      );
    };

    bindTable(ARENA_DASHBOARD_TABLES.warCry, 'onWarCryMatch');
    bindTable(ARENA_DASHBOARD_TABLES.sparks, 'onSparksJosh');
    bindTable(ARENA_DASHBOARD_TABLES.battle, 'onBattleBawaal');
    bindTable(ARENA_DASHBOARD_TABLES.faceOff, 'onFaceOff');

    channel.on('broadcast', { event: 'score_update' }, (msg) => {
      const payload = msg?.payload || {};
      dispatch('onScoreUpdate', payload);
      dispatch('onRoomInteraction', { type: 'score_update', ...payload });
    });

    channel.on('broadcast', { event: 'spectator_count' }, (msg) => {
      const payload = msg?.payload || {};
      dispatch('onScoreUpdate', {
        matchId: payload.matchId || payload.roomId,
        spectatorCount: Number(payload.spectatorCount) || 0,
      });
      dispatch('onRoomInteraction', { type: 'spectator_count', ...payload });
    });

    channel.on('broadcast', { event: 'room_interaction' }, (msg) => {
      dispatch('onRoomInteraction', msg?.payload || {});
    });

    channel.on('broadcast', { event: 'live_banter' }, (msg) => {
      const payload = msg?.payload || {};
      dispatch('onLiveBanter', payload);
      dispatch('onRoomInteraction', { type: 'live_banter', ...payload });
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        softFailWarn(
          'arenaDashboardRt:subscribe',
          '[arenaDashboardRt] channel subscribe soft-fail',
          status
        );
      }
    });

    activeChannel = channel;
    return channel;
  } catch (err) {
    softFailWarn(
      'arenaDashboardRt:subscribe',
      '[arenaDashboardRt] subscribe soft-fail',
      err?.message || err
    );
    activeChannel = null;
    return null;
  }
}

function teardownChannel() {
  if (!activeChannel) return;
  try {
    supabase.removeChannel(activeChannel);
  } catch (_) {
    /* ignore */
  }
  activeChannel = null;
}

/**
 * Subscribe to Arena dashboard live updates (refcount-safe).
 *
 * @param {{
 *   onWarCryMatch?: (row: object, event: string) => void,
 *   onSparksJosh?: (row: object, event: string) => void,
 *   onBattleBawaal?: (row: object, event: string) => void,
 *   onFaceOff?: (row: object, event: string) => void,
 *   onRoomInteraction?: (payload: object) => void,
 *   onLiveBanter?: (payload: object) => void,
 *   onScoreUpdate?: (payload: object) => void,
 * }} [handlers]
 * @returns {() => void} unsubscribe
 */
export function subscribeArenaDashboardRealtime(handlers = {}) {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  handlersRef = handlers || {};
  refCount += 1;
  ensureChannel();

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      handlersRef = {};
      teardownChannel();
    }
  };
}

/**
 * Broadcast a live score / spectator tick to the dashboard room.
 * Soft-fail; never throws.
 */
export async function broadcastArenaDashboardScore(payload = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'offline' };
  try {
    const channel = ensureChannel() ||
      supabase.channel(ROOM_BROADCAST, {
        config: { broadcast: { self: true } },
      });
    if (!activeChannel) {
      await new Promise((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') resolve();
        });
      });
    }
    await channel.send({
      type: 'broadcast',
      event: 'score_update',
      payload: {
        matchId: payload.matchId || payload.roomId || null,
        hostScore: Number(payload.hostScore) || 0,
        rivalScore: Number(payload.rivalScore) || 0,
        spectatorCount: Number(payload.spectatorCount) || 0,
        at: Date.now(),
      },
    });
    return { ok: true };
  } catch (err) {
    softFailWarn(
      'arenaDashboardRt:broadcast',
      '[arenaDashboardRt] broadcast soft-fail',
      err?.message || err
    );
    return { ok: false, reason: err?.message || 'broadcast-failed' };
  }
}

/**
 * Broadcast a live banter line into the dashboard room.
 * Soft-fail; never throws.
 */
export async function broadcastArenaLiveBanter(payload = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'offline' };
  try {
    const channel = ensureChannel();
    if (!channel) return { ok: false, reason: 'offline' };
    await channel.send({
      type: 'broadcast',
      event: 'live_banter',
      payload: {
        matchId: payload.matchId || payload.roomId || null,
        text: String(payload.text || payload.body || '').trim(),
        handle: payload.handle || '@athlete',
        emotion: payload.emotion || null,
        at: Date.now(),
      },
    });
    return { ok: true };
  } catch (err) {
    softFailWarn(
      'arenaDashboardRt:banter',
      '[arenaDashboardRt] banter broadcast soft-fail',
      err?.message || err
    );
    return { ok: false, reason: err?.message || 'broadcast-failed' };
  }
}

export default {
  subscribeArenaDashboardRealtime,
  broadcastArenaDashboardScore,
  broadcastArenaLiveBanter,
};
