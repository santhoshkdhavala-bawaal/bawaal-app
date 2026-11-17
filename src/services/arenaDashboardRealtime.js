/**
 * Arena dashboard realtime — live War Cry scores / spectators + shelf inserts.
 *
 * Channels:
 *  - postgres_changes on war_cry_matches / sparks_josh_clips /
 *    battle_bawaal_reels / face_off_challenges
 *  - broadcast `arena_dashboard_room` for room interactions (scores / spectators)
 *
 * Soft-fail when Supabase is offline — never throws into Arena UX.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { softFailWarn } from '../utils/softFailLog';
import { ARENA_DASHBOARD_TABLES } from './arenaDashboardService';

const CHANNEL_NAME = 'arena_dashboard_live';
const ROOM_BROADCAST = 'arena_dashboard_room';

/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let activeChannel = null;

/**
 * Subscribe to Arena dashboard live updates.
 *
 * @param {{
 *   onWarCryMatch?: (row: object, event: string) => void,
 *   onSparksJosh?: (row: object, event: string) => void,
 *   onBattleBawaal?: (row: object, event: string) => void,
 *   onFaceOff?: (row: object, event: string) => void,
 *   onRoomInteraction?: (payload: object) => void,
 *   onScoreUpdate?: (payload: { matchId?: string, hostScore?: number, rivalScore?: number, spectatorCount?: number }) => void,
 * }} [handlers]
 * @returns {() => void} unsubscribe
 */
export function subscribeArenaDashboardRealtime(handlers = {}) {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  // Drop prior channel (single dashboard subscription)
  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (_) {
      /* ignore */
    }
    activeChannel = null;
  }

  let channel;
  try {
    channel = supabase.channel(CHANNEL_NAME);

    const bindTable = (table, cb) => {
      if (typeof cb !== 'function') return;
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          try {
            const row = payload?.new || payload?.old || null;
            if (!row) return;
            cb(row, String(payload?.eventType || payload?.event || 'UPDATE'));
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

    bindTable(ARENA_DASHBOARD_TABLES.warCry, (row, event) => {
      handlers.onWarCryMatch?.(row, event);
      if (event === 'UPDATE' || event === 'INSERT') {
        handlers.onScoreUpdate?.({
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
    });
    bindTable(ARENA_DASHBOARD_TABLES.sparks, handlers.onSparksJosh);
    bindTable(ARENA_DASHBOARD_TABLES.battle, handlers.onBattleBawaal);
    bindTable(ARENA_DASHBOARD_TABLES.faceOff, handlers.onFaceOff);

    channel.on('broadcast', { event: 'score_update' }, (msg) => {
      try {
        const payload = msg?.payload || {};
        handlers.onScoreUpdate?.(payload);
        handlers.onRoomInteraction?.({ type: 'score_update', ...payload });
      } catch (err) {
        softFailWarn(
          'arenaDashboardRt:score',
          '[arenaDashboardRt] score broadcast soft-fail',
          err?.message || err
        );
      }
    });

    channel.on('broadcast', { event: 'spectator_count' }, (msg) => {
      try {
        const payload = msg?.payload || {};
        handlers.onScoreUpdate?.({
          matchId: payload.matchId || payload.roomId,
          spectatorCount: Number(payload.spectatorCount) || 0,
        });
        handlers.onRoomInteraction?.({ type: 'spectator_count', ...payload });
      } catch (err) {
        softFailWarn(
          'arenaDashboardRt:spectators',
          '[arenaDashboardRt] spectator broadcast soft-fail',
          err?.message || err
        );
      }
    });

    channel.on('broadcast', { event: 'room_interaction' }, (msg) => {
      try {
        handlers.onRoomInteraction?.(msg?.payload || {});
      } catch (err) {
        softFailWarn(
          'arenaDashboardRt:room',
          '[arenaDashboardRt] room interaction soft-fail',
          err?.message || err
        );
      }
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
  } catch (err) {
    softFailWarn(
      'arenaDashboardRt:subscribe',
      '[arenaDashboardRt] subscribe soft-fail',
      err?.message || err
    );
    return () => {};
  }

  return () => {
    try {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    } catch (_) {
      /* ignore */
    }
    activeChannel = null;
  };
}

/**
 * Broadcast a live score / spectator tick to the dashboard room.
 * Soft-fail; never throws.
 */
export async function broadcastArenaDashboardScore(payload = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'offline' };
  try {
    const channel =
      activeChannel ||
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

export default {
  subscribeArenaDashboardRealtime,
  broadcastArenaDashboardScore,
};
