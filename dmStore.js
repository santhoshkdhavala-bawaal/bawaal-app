/**
 * 1v1 Athlete Direct Messaging — Supabase Realtime + local demo fallback.
 * Table: public.direct_messages (sender_id, receiver_id, body, read, created_at)
 */
import { isSupabaseConfigured, supabase } from './src/services/supabase';
import { getActiveUser } from './src/services/activeUserProfile';

export const DM_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_DIRECT_MESSAGES.sql';

const TABLE = 'direct_messages';

/** @type {Map<string, Array<object>>} */
const localThreads = new Map();
/** @type {Set<(msg: object) => void>} */
const localListeners = new Set();

function asId(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function threadKey(a, b) {
  return [String(a), String(b)].sort().join('::');
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    senderId: String(row.sender_id ?? row.senderId),
    receiverId: String(row.receiver_id ?? row.receiverId),
    text: String(row.body ?? row.text ?? ''),
    read: Boolean(row.read),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    local: Boolean(row.local),
  };
}

function getLocalThread(a, b) {
  const key = threadKey(a, b);
  if (!localThreads.has(key)) localThreads.set(key, []);
  return localThreads.get(key);
}

function emitLocal(msg) {
  localListeners.forEach((fn) => {
    try {
      fn(msg);
    } catch (_) {
      /* ignore subscriber errors */
    }
  });
}

/**
 * Resolve the active sender id (auth uuid when available, else ACTIVE_USER).
 */
export async function resolveSenderId() {
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.auth.getUser();
      const id = asId(data?.user?.id);
      if (id) return id;
    } catch (_) {
      /* fall through */
    }
  }
  const user = getActiveUser?.() || {};
  return asId(user.userId || user.id) || 'user-local';
}

function canUseCloud(senderId, receiverId) {
  return Boolean(isSupabaseConfigured() && senderId && receiverId);
}

/** Escape a value for PostgREST filter eq. */
function filterEq(value) {
  return String(value).replace(/[,.()]/g, '');
}

/**
 * Fetch message history between two user IDs (either direction).
 * @param {string} senderId
 * @param {string} receiverId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ messages: object[], fromCloud: boolean, error: Error|null }>}
 */
export async function fetchMessageHistory(senderId, receiverId, opts = {}) {
  const a = asId(senderId);
  const b = asId(receiverId);
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500);

  if (!a || !b) {
    return { messages: [], fromCloud: false, error: new Error('Missing user ids') };
  }

  if (canUseCloud(a, b)) {
    try {
      const fa = filterEq(a);
      const fb = filterEq(b);
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, sender_id, receiver_id, body, read, created_at')
        .or(
          `and(sender_id.eq.${fa},receiver_id.eq.${fb}),and(sender_id.eq.${fb},receiver_id.eq.${fa})`
        )
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      const messages = (data || []).map(normalizeRow).filter(Boolean);
      // Merge any optimistic local rows not yet mirrored
      const cloudIds = new Set(messages.map((m) => m.id));
      const localExtras = getLocalThread(a, b).filter((m) => !cloudIds.has(m.id));
      const merged = [...messages, ...localExtras].sort(
        (x, y) => new Date(x.createdAt) - new Date(y.createdAt)
      );
      return { messages: merged, fromCloud: true, error: null };
    } catch (error) {
      console.warn('[dmStore] fetchMessageHistory:', error?.message || error);
      const local = getLocalThread(a, b).map(normalizeRow).filter(Boolean);
      return { messages: local, fromCloud: false, error };
    }
  }

  const messages = getLocalThread(a, b).map(normalizeRow).filter(Boolean);
  return { messages, fromCloud: false, error: null };
}

/**
 * Insert a DM. Uses cloud when both ids are auth uuids; otherwise local thread.
 * @param {string} receiverId
 * @param {string} text
 * @param {{ senderId?: string }} [opts]
 * @returns {Promise<{ message: object|null, fromCloud: boolean, error: Error|null }>}
 */
export async function sendMessage(receiverId, text, opts = {}) {
  const body = String(text || '').trim();
  const receiver = asId(receiverId);
  if (!body) {
    return { message: null, fromCloud: false, error: new Error('Empty message') };
  }
  if (!receiver) {
    return { message: null, fromCloud: false, error: new Error('Missing receiver') };
  }

  const senderId = asId(opts.senderId) || (await resolveSenderId());
  if (!senderId) {
    return { message: null, fromCloud: false, error: new Error('Missing sender') };
  }
  if (senderId === receiver) {
    return {
      message: null,
      fromCloud: false,
      error: new Error('Cannot message yourself'),
    };
  }

  const createdAt = new Date().toISOString();

  if (canUseCloud(senderId, receiver)) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          sender_id: senderId,
          receiver_id: receiver,
          body,
          read: false,
          created_at: createdAt,
        })
        .select('id, sender_id, receiver_id, body, read, created_at')
        .single();

      if (error) throw error;
      return { message: normalizeRow(data), fromCloud: true, error: null };
    } catch (error) {
      console.warn('[dmStore] sendMessage cloud failed:', error?.message || error);
      // Fall through to local so UX still works before SQL is applied
    }
  }

  const localMsg = normalizeRow({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender_id: senderId,
    receiver_id: receiver,
    body,
    read: false,
    created_at: createdAt,
    local: true,
  });
  getLocalThread(senderId, receiver).push(localMsg);
  emitLocal(localMsg);
  return { message: localMsg, fromCloud: false, error: null };
}

/**
 * Mark inbound messages from peer as read.
 */
export async function markMessagesRead(peerId, opts = {}) {
  const peer = asId(peerId);
  const me = asId(opts.senderId) || (await resolveSenderId());
  if (!peer || !me) return { updated: 0, error: null };

  if (canUseCloud(me, peer)) {
    try {
      const { error, count } = await supabase
        .from(TABLE)
        .update({ read: true }, { count: 'exact' })
        .eq('sender_id', peer)
        .eq('receiver_id', me)
        .eq('read', false);
      if (error) throw error;
      return { updated: count || 0, error: null };
    } catch (error) {
      console.warn('[dmStore] markMessagesRead:', error?.message || error);
      return { updated: 0, error };
    }
  }

  let updated = 0;
  const thread = getLocalThread(me, peer);
  thread.forEach((m) => {
    if (m.senderId === peer && m.receiverId === me && !m.read) {
      m.read = true;
      updated += 1;
    }
  });
  return { updated, error: null };
}

/**
 * Realtime subscription for a 1v1 thread (postgres_changes + local listeners).
 * @param {string} userA
 * @param {string} userB
 * @param {(msg: object) => void} onMessage
 * @returns {() => void} unsubscribe
 */
export function subscribeToConversation(userA, userB, onMessage) {
  const a = asId(userA);
  const b = asId(userB);
  if (!a || !b || typeof onMessage !== 'function') {
    return () => {};
  }

  const belongs = (row) => {
    if (!row) return false;
    const s = String(row.sender_id ?? row.senderId);
    const r = String(row.receiver_id ?? row.receiverId);
    return (s === a && r === b) || (s === b && r === a);
  };

  const onLocal = (msg) => {
    if (belongs(msg)) onMessage(msg);
  };
  localListeners.add(onLocal);

  let channel = null;
  if (canUseCloud(a, b)) {
    const channelName = `dm:${threadKey(a, b)}`;
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE,
          filter: `receiver_id=eq.${a}`,
        },
        (payload) => {
          if (belongs(payload.new)) onMessage(normalizeRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE,
          filter: `receiver_id=eq.${b}`,
        },
        (payload) => {
          if (belongs(payload.new)) onMessage(normalizeRow(payload.new));
        }
      )
      .subscribe();
  }

  return () => {
    localListeners.delete(onLocal);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    }
  };
}

export default {
  DM_SETUP_HINT,
  resolveSenderId,
  fetchMessageHistory,
  sendMessage,
  markMessagesRead,
  subscribeToConversation,
};
