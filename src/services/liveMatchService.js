/**
 * Live Match Telecast — Supabase CRUD + Realtime (Phase 1).
 *
 * Authoritative (Postgres + postgres_changes): score_a/b, status.
 * Ephemeral broadcast on `live-match-{id}`: banter, reaction, vote_pulse.
 * Presence on same channel: watching count (no per-viewer DB rows).
 *
 * Soft-fail: missing table / offline → in-memory local store.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { softFailWarn } from '../utils/softFailLog';
import {
  isMissingRelationError,
  isTableDisabled,
  markTableMissing,
} from '../utils/supabaseSoftFail';
import { DEFAULT_LIVE_MATCH_SPORT } from '../constants/liveMatchSports';

const TABLE = 'live_matches';
const BANTER_CAP = 40;
const VOTE_FLUSH_MS = 8000;

/** @type {Map<string, object>} */
const localMatches = new Map();
/** @type {Set<Function>} */
const listListeners = new Set();

/** @type {Map<string, { channel: any, refCount: number, handlers: Set<object>, presenceCount: number }>} */
const rooms = new Map();

/** @type {Map<string, { a: number, b: number, timer: any }>} */
const voteBuffers = new Map();

function newMatchId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function channelName(matchId) {
  return `live-match-${String(matchId || '').trim()}`;
}

function normalizeMatch(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: String(row.id || ''),
    host_id: String(row.host_id || ''),
    host_handle: String(row.host_handle || ''),
    sport: String(row.sport || DEFAULT_LIVE_MATCH_SPORT).toUpperCase(),
    title: row.title != null ? String(row.title) : '',
    team_a_name: String(row.team_a_name || 'TEAM A'),
    team_b_name: String(row.team_b_name || 'TEAM B'),
    score_a: Math.max(0, Number(row.score_a) || 0),
    score_b: Math.max(0, Number(row.score_b) || 0),
    votes_a: Math.max(0, Number(row.votes_a) || 0),
    votes_b: Math.max(0, Number(row.votes_b) || 0),
    status: row.status === 'ended' ? 'ended' : 'live',
    stream_room_id: String(row.stream_room_id || row.id || ''),
    created_at: row.created_at || new Date().toISOString(),
    ended_at: row.ended_at || null,
    watching: Math.max(0, Number(row.watching) || 0),
  };
}

function emitListListeners() {
  const list = getLocalLiveList();
  listListeners.forEach((fn) => {
    try {
      fn(list);
    } catch (err) {
      softFailWarn(
        'liveMatch:listHandler',
        '[liveMatch] list handler soft-fail',
        err?.message || err
      );
    }
  });
}

function getLocalLiveList() {
  return Array.from(localMatches.values())
    .filter((m) => m.status === 'live')
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

/** Live match count for Arena header badge (local cache; hydrate via listLiveMatches). */
export function getLiveMatchCount() {
  return getLocalLiveList().length;
}

function shouldUseLocalOnly() {
  return !isSupabaseConfigured() || isTableDisabled(TABLE);
}

/**
 * @returns {Promise<object[]>}
 */
export async function listLiveMatches() {
  if (shouldUseLocalOnly()) {
    return getLocalLiveList();
  }
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
        return getLocalLiveList();
      }
      softFailWarn('liveMatch:list', '[liveMatch] list soft-fail', error);
      return getLocalLiveList();
    }
    const rows = (Array.isArray(data) ? data : [])
      .map(normalizeMatch)
      .filter(Boolean);
    rows.forEach((m) => localMatches.set(m.id, m));
    return rows;
  } catch (err) {
    softFailWarn('liveMatch:listEx', '[liveMatch] list exception', err?.message);
    return getLocalLiveList();
  }
}

/**
 * @param {object} input
 */
export async function createLiveMatch({
  hostId,
  hostHandle,
  sport,
  title,
  teamAName,
  teamBName,
} = {}) {
  const id = newMatchId();
  const row = normalizeMatch({
    id,
    host_id: String(hostId || `local:${Date.now()}`),
    host_handle: String(hostHandle || 'athlete'),
    sport: String(sport || DEFAULT_LIVE_MATCH_SPORT).toUpperCase(),
    title: String(title || '').trim(),
    team_a_name: String(teamAName || 'TEAM A').trim() || 'TEAM A',
    team_b_name: String(teamBName || 'TEAM B').trim() || 'TEAM B',
    score_a: 0,
    score_b: 0,
    votes_a: 0,
    votes_b: 0,
    status: 'live',
    stream_room_id: id,
    created_at: new Date().toISOString(),
  });

  localMatches.set(id, row);
  emitListListeners();

  if (shouldUseLocalOnly()) {
    return { ok: true, local: true, match: row };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        id: row.id,
        host_id: row.host_id,
        host_handle: row.host_handle,
        sport: row.sport,
        title: row.title || null,
        team_a_name: row.team_a_name,
        team_b_name: row.team_b_name,
        score_a: 0,
        score_b: 0,
        votes_a: 0,
        votes_b: 0,
        status: 'live',
        stream_room_id: row.stream_room_id,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
      } else {
        softFailWarn('liveMatch:create', '[liveMatch] create soft-fail', error);
      }
      return { ok: true, local: true, match: row };
    }
    const saved = normalizeMatch(data) || row;
    localMatches.set(saved.id, saved);
    emitListListeners();
    return { ok: true, match: saved };
  } catch (err) {
    softFailWarn(
      'liveMatch:createEx',
      '[liveMatch] create exception',
      err?.message
    );
    return { ok: true, local: true, match: row };
  }
}

/**
 * @param {string} matchId
 * @param {{ score_a?: number, score_b?: number }} scores
 */
export async function updateMatchScore(matchId, scores = {}) {
  const id = String(matchId || '').trim();
  if (!id) return { ok: false, reason: 'no-id' };

  const prev = localMatches.get(id) || { id, score_a: 0, score_b: 0 };
  const next = normalizeMatch({
    ...prev,
    score_a:
      scores.score_a != null
        ? Math.max(0, Number(scores.score_a) || 0)
        : prev.score_a,
    score_b:
      scores.score_b != null
        ? Math.max(0, Number(scores.score_b) || 0)
        : prev.score_b,
  });
  localMatches.set(id, { ...prev, ...next });
  emitListListeners();
  emitRoomHandlers(id, { type: 'score', match: localMatches.get(id) });

  if (shouldUseLocalOnly()) {
    return { ok: true, local: true, match: localMatches.get(id) };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        score_a: next.score_a,
        score_b: next.score_b,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
      } else {
        softFailWarn('liveMatch:score', '[liveMatch] score soft-fail', error);
      }
      return { ok: true, local: true, match: localMatches.get(id) };
    }
    const saved = normalizeMatch(data) || localMatches.get(id);
    if (saved) localMatches.set(id, saved);
    emitListListeners();
    return { ok: true, match: saved };
  } catch (err) {
    softFailWarn(
      'liveMatch:scoreEx',
      '[liveMatch] score exception',
      err?.message
    );
    return { ok: true, local: true, match: localMatches.get(id) };
  }
}

/**
 * @param {string} matchId
 */
export async function endLiveMatch(matchId) {
  const id = String(matchId || '').trim();
  if (!id) return { ok: false, reason: 'no-id' };
  const prev = localMatches.get(id) || { id };
  const ended = normalizeMatch({
    ...prev,
    status: 'ended',
    ended_at: new Date().toISOString(),
  });
  localMatches.set(id, ended);
  emitListListeners();
  emitRoomHandlers(id, { type: 'status', match: ended });

  if (shouldUseLocalOnly()) {
    return { ok: true, local: true, match: ended };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: 'ended',
        ended_at: ended.ended_at,
        votes_a: ended.votes_a,
        votes_b: ended.votes_b,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
      } else {
        softFailWarn('liveMatch:end', '[liveMatch] end soft-fail', error);
      }
      return { ok: true, local: true, match: ended };
    }
    const saved = normalizeMatch(data) || ended;
    localMatches.set(id, saved);
    emitListListeners();
    return { ok: true, match: saved };
  } catch (err) {
    softFailWarn('liveMatch:endEx', '[liveMatch] end exception', err?.message);
    return { ok: true, local: true, match: ended };
  }
}

export async function fetchLiveMatch(matchId) {
  const id = String(matchId || '').trim();
  if (!id) return null;
  if (localMatches.has(id)) return localMatches.get(id);
  if (shouldUseLocalOnly()) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
      }
      return null;
    }
    const m = normalizeMatch(data);
    if (m) localMatches.set(m.id, m);
    return m;
  } catch (_) {
    return null;
  }
}

/**
 * Hub list subscription (postgres_changes + local listeners).
 * @param {(list: object[]) => void} onChange
 * @returns {() => void}
 */
export function subscribeLiveMatchList(onChange) {
  if (typeof onChange === 'function') {
    listListeners.add(onChange);
    listLiveMatches().then((list) => {
      try {
        onChange(list);
      } catch (_) {
        /* ignore */
      }
    });
  }

  let channel = null;
  if (isSupabaseConfigured() && !isTableDisabled(TABLE)) {
    try {
      channel = supabase
        .channel('live-matches-hub')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLE },
          () => {
            listLiveMatches().then((list) => {
              listListeners.forEach((fn) => {
                try {
                  fn(list);
                } catch (_) {
                  /* ignore */
                }
              });
            });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            softFailWarn(
              'liveMatch:hubChannel',
              '[liveMatch] hub channel soft-fail',
              status
            );
          }
        });
    } catch (err) {
      softFailWarn(
        'liveMatch:hubSub',
        '[liveMatch] hub subscribe soft-fail',
        err?.message
      );
    }
  }

  return () => {
    if (typeof onChange === 'function') listListeners.delete(onChange);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    }
  };
}

function emitRoomHandlers(matchId, payload) {
  const room = rooms.get(String(matchId));
  if (!room) return;
  room.handlers.forEach((h) => {
    try {
      if (payload.type === 'score') h.onScore?.(payload.match);
      else if (payload.type === 'status') h.onStatus?.(payload.match);
      else if (payload.type === 'banter') h.onBanter?.(payload.data);
      else if (payload.type === 'reaction') h.onReaction?.(payload.data);
      else if (payload.type === 'vote_pulse') h.onVotePulse?.(payload.data);
      else if (payload.type === 'presence') h.onPresence?.(payload.count);
    } catch (err) {
      softFailWarn(
        'liveMatch:roomHandler',
        '[liveMatch] room handler soft-fail',
        err?.message || err
      );
    }
  });
}

/**
 * Join match room: broadcast + presence (+ optional postgres score sync).
 * @returns {() => void} unsubscribe
 */
export function joinLiveMatchRoom(matchId, handlers = {}) {
  const id = String(matchId || '').trim();
  if (!id) return () => {};

  let room = rooms.get(id);
  if (!room) {
    room = {
      channel: null,
      refCount: 0,
      handlers: new Set(),
      presenceCount: 1,
    };
    rooms.set(id, room);

    if (isSupabaseConfigured()) {
      try {
        const name = channelName(id);
        const channel = supabase.channel(name, {
          config: {
            broadcast: { self: false },
            presence: { key: `viewer-${Date.now()}-${Math.random()}` },
          },
        });

        channel.on('broadcast', { event: 'banter' }, (msg) => {
          emitRoomHandlers(id, { type: 'banter', data: msg?.payload || {} });
        });
        channel.on('broadcast', { event: 'reaction' }, (msg) => {
          emitRoomHandlers(id, { type: 'reaction', data: msg?.payload || {} });
        });
        channel.on('broadcast', { event: 'vote_pulse' }, (msg) => {
          emitRoomHandlers(id, {
            type: 'vote_pulse',
            data: msg?.payload || {},
          });
        });

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLE,
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const row = normalizeMatch(payload?.new || payload?.record);
            if (!row) return;
            localMatches.set(id, row);
            if (row.status === 'ended') {
              emitRoomHandlers(id, { type: 'status', match: row });
            } else {
              emitRoomHandlers(id, { type: 'score', match: row });
            }
            emitListListeners();
          }
        );

        channel.on('presence', { event: 'sync' }, () => {
          try {
            const state = channel.presenceState?.() || {};
            const count = Object.keys(state).reduce(
              (n, k) => n + (Array.isArray(state[k]) ? state[k].length : 1),
              0
            );
            room.presenceCount = Math.max(1, count);
            emitRoomHandlers(id, {
              type: 'presence',
              count: room.presenceCount,
            });
          } catch (_) {
            /* ignore */
          }
        });

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              await channel.track({
                online_at: new Date().toISOString(),
                role: handlers.role || 'viewer',
              });
            } catch (_) {
              /* soft-fail presence */
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            softFailWarn(
              'liveMatch:roomSub',
              '[liveMatch] room channel soft-fail',
              status
            );
          }
        });

        room.channel = channel;
      } catch (err) {
        softFailWarn(
          'liveMatch:join',
          '[liveMatch] join soft-fail',
          err?.message
        );
      }
    }
  }

  room.refCount += 1;
  room.handlers.add(handlers);
  // Immediate presence for local / first join
  try {
    handlers.onPresence?.(room.presenceCount || 1);
  } catch (_) {
    /* ignore */
  }

  return () => {
    const r = rooms.get(id);
    if (!r) return;
    r.handlers.delete(handlers);
    r.refCount = Math.max(0, r.refCount - 1);
    if (r.refCount <= 0) {
      if (r.channel) {
        try {
          supabase.removeChannel(r.channel);
        } catch (_) {
          /* ignore */
        }
      }
      rooms.delete(id);
    }
  };
}

async function sendBroadcast(matchId, event, payload) {
  const id = String(matchId || '').trim();
  const room = rooms.get(id);
  // Optimistic local emit (channel uses self:false so peers get remote only)
  emitRoomHandlers(id, { type: event, data: payload });

  if (!room?.channel || !isSupabaseConfigured()) {
    return { ok: true, local: true };
  }
  try {
    await room.channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    return { ok: true };
  } catch (err) {
    softFailWarn(
      'liveMatch:broadcast',
      '[liveMatch] broadcast soft-fail',
      err?.message
    );
    return { ok: true, local: true };
  }
}

export function broadcastBanter(matchId, { handle, message } = {}) {
  const text = String(message || '').trim().slice(0, 160);
  if (!text) return Promise.resolve({ ok: false });
  return sendBroadcast(matchId, 'banter', {
    handle: String(handle || 'fan').slice(0, 32),
    message: text,
    at: Date.now(),
  });
}

export function broadcastReaction(matchId, { emojiKey, handle } = {}) {
  const key = String(emojiKey || '').trim();
  if (!key) return Promise.resolve({ ok: false });
  return sendBroadcast(matchId, 'reaction', {
    emojiKey: key,
    handle: String(handle || 'fan').slice(0, 32),
    at: Date.now(),
  });
}

/**
 * High-frequency vote pulse — broadcast only; optional throttled DB flush.
 */
export function broadcastVotePulse(matchId, { team, handle } = {}) {
  const t = team === 'B' ? 'B' : 'A';
  const id = String(matchId || '').trim();
  queueVoteFlush(id, t);
  return sendBroadcast(id, 'vote_pulse', {
    team: t,
    handle: String(handle || 'fan').slice(0, 32),
    at: Date.now(),
  });
}

function queueVoteFlush(matchId, team) {
  const id = String(matchId || '').trim();
  if (!id) return;
  let buf = voteBuffers.get(id);
  if (!buf) {
    buf = { a: 0, b: 0, timer: null };
    voteBuffers.set(id, buf);
  }
  if (team === 'B') buf.b += 1;
  else buf.a += 1;

  const prev = localMatches.get(id);
  if (prev) {
    localMatches.set(id, {
      ...prev,
      votes_a: (prev.votes_a || 0) + (team === 'A' ? 1 : 0),
      votes_b: (prev.votes_b || 0) + (team === 'B' ? 1 : 0),
    });
  }

  if (buf.timer) return;
  buf.timer = setTimeout(() => {
    const pending = voteBuffers.get(id);
    voteBuffers.delete(id);
    if (!pending || shouldUseLocalOnly()) return;
    const cur = localMatches.get(id);
    if (!cur) return;
    supabase
      .from(TABLE)
      .update({ votes_a: cur.votes_a, votes_b: cur.votes_b })
      .eq('id', id)
      .then(({ error }) => {
        if (error && isMissingRelationError(error)) {
          markTableMissing(TABLE, 'liveMatch', error.message || error);
        }
      })
      .catch(() => {});
  }, VOTE_FLUSH_MS);
}

/** Cap banter array in UI memory. */
export function pushBanterCapped(list, item, cap = BANTER_CAP) {
  const next = [...(Array.isArray(list) ? list : []), item];
  if (next.length <= cap) return next;
  return next.slice(next.length - cap);
}

export { BANTER_CAP, channelName as liveMatchChannelName };
