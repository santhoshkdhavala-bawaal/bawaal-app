/**
 * Vault emoji burst — Supabase Realtime Broadcast sync.
 *
 * Channel: `arena_${roomId}` (ephemeral broadcast, no DB table).
 * Event: `vault_burst` → payload `{ emojiId, userId }`
 *
 * Soft-fail when Supabase is offline / misconfigured — never throws into Arena UX.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import { softFailWarn } from '../utils/softFailLog';

/** @type {Map<string, import('@supabase/supabase-js').RealtimeChannel>} */
const activeChannels = new Map();

/**
 * Room id for arena / challenge vault sync.
 * @param {{ battleId?: string, challengeId?: string, id?: string } | null | undefined} item
 */
export function resolveVaultBurstRoomId(item) {
  const id = item?.battleId || item?.challengeId || item?.id || '';
  return String(id || '').trim();
}

export function vaultBurstChannelName(roomId) {
  return `arena_${String(roomId || '').trim()}`;
}

/**
 * Actor id for burst payload — prefer auth UUID, else active profile handle.
 */
export async function resolveBurstActorId() {
  try {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (uid) return String(uid);
    }
  } catch (_) {
    /* soft-fail */
  }
  const u = getActiveUser?.() || {};
  return String(u.userId || u.id || u.handle || 'local-athlete');
}

/**
 * Subscribe to vault_burst broadcasts for an arena room.
 * Only call for the active viewport card to avoid N open channels.
 *
 * @param {string} roomId
 * @param {{ onVaultBurst?: (emojiId: string, payload: object) => void }} [opts]
 * @returns {() => void} unsubscribe / removeChannel
 */
export function subscribeVaultBurstChannel(roomId, opts = {}) {
  const id = String(roomId || '').trim();
  if (!id || !isSupabaseConfigured()) {
    return () => {};
  }

  const name = vaultBurstChannelName(id);

  // Drop prior subscription for the same room if any
  const prior = activeChannels.get(name);
  if (prior) {
    try {
      supabase.removeChannel(prior);
    } catch (_) {
      /* ignore */
    }
    activeChannels.delete(name);
  }

  let channel;
  try {
    channel = supabase.channel(name, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'vault_burst' }, (msg) => {
      try {
        const payload = msg?.payload || {};
        const emojiId = String(
          payload.emojiId || payload.emojiKey || ''
        ).trim();
        if (!emojiId) return;
        opts.onVaultBurst?.(emojiId, payload);
      } catch (err) {
        softFailWarn(
          'vaultBurst:onReceive',
          '[vaultBurst] receive handler soft-fail',
          err?.message || err
        );
      }
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        softFailWarn(
          'vaultBurst:subscribe',
          '[vaultBurst] channel subscribe soft-fail',
          status
        );
      }
    });

    activeChannels.set(name, channel);
  } catch (err) {
    softFailWarn(
      'vaultBurst:subscribe',
      '[vaultBurst] subscribe soft-fail',
      err?.message || err
    );
    return () => {};
  }

  return () => {
    try {
      const current = activeChannels.get(name);
      if (current === channel) {
        activeChannels.delete(name);
      }
      supabase.removeChannel(channel);
    } catch (_) {
      /* ignore */
    }
  };
}

/**
 * Broadcast a vault skull pick to the room. Soft-fail; never throws.
 * Reuses the subscribed channel when present.
 *
 * @param {string} roomId
 * @param {{ emojiId: string, userId?: string }} payload
 */
export async function broadcastVaultBurst(roomId, payload = {}) {
  const id = String(roomId || '').trim();
  const emojiId = String(payload.emojiId || payload.emojiKey || '').trim();
  if (!id || !emojiId || !isSupabaseConfigured()) {
    return { ok: false };
  }

  const name = vaultBurstChannelName(id);
  const body = {
    type: 'broadcast',
    event: 'vault_burst',
    payload: {
      emojiId,
      userId: payload.userId || (await resolveBurstActorId()),
    },
  };

  try {
    let channel = activeChannels.get(name);
    let ephemeral = false;

    if (!channel) {
      ephemeral = true;
      channel = supabase.channel(name, {
        config: { broadcast: { self: false } },
      });
      await new Promise((resolve) => {
        channel.subscribe((status) => {
          if (
            status === 'SUBSCRIBED' ||
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            resolve(status);
          }
        });
      });
    }

    const result = await channel.send(body);

    if (ephemeral) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    }

    if (result === 'error' || result?.error) {
      softFailWarn(
        'vaultBurst:broadcast',
        '[vaultBurst] broadcast soft-fail',
        result
      );
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    softFailWarn(
      'vaultBurst:broadcast',
      '[vaultBurst] broadcast soft-fail',
      err?.message || err
    );
    return { ok: false };
  }
}
