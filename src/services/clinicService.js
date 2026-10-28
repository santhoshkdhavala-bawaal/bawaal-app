/**
 * Clinic ↔ Supabase `clinic_questions` + `clinic_replies`.
 * Inserts retry question_text / question variants; schema-cache misses
 * fall back to a local feed item so the UI never surfaces PGRST204 popups.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { ACTIVE_USER } from './activeUserProfile';

export const CLINIC_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_LOCKER_CLINIC_PROFILES.sql';

function relativeTime(iso) {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return 'Just now';
  const delta = Math.max(0, Date.now() - ms);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function normalizeHandle(raw) {
  const h = String(raw || '').trim();
  if (!h) return '@athlete';
  return h.startsWith('@') ? h : `@${h}`;
}

function questionBody(row) {
  return String(row?.question_text || row?.question || '').trim();
}

function localId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  return /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(
    msg
  );
}

function mapFeedItem(question, reply) {
  if (!question) return null;
  const handle = normalizeHandle(question.athlete_handle || '@athlete');
  return {
    id: String(question.id),
    athlete: handle,
    sport: String(question.sport || 'GYM').toUpperCase(),
    question: questionBody(question),
    time: relativeTime(question.created_at || new Date().toISOString()),
    expert: reply
      ? {
          name: String(reply.expert_name || 'Verified Expert'),
          role: String(reply.expert_role || 'VERIFIED EXPERT'),
          response: String(reply.response || ''),
          hasVideo: Boolean(reply.has_video),
          videoLabel: reply.video_label || 'VIDEO ADVISORY',
        }
      : null,
    localOnly: Boolean(question.localOnly),
  };
}

async function insertWithFallbacks(table, variants) {
  let lastError = null;
  for (const payload of variants) {
    try {
      const { data, error } = await supabase.from(table).insert(payload).select('*').single();
      if (!error && data) return { data, error: null };
      lastError = error || lastError;
      if (error && !isSchemaCacheError(error)) {
        if (!/column|schema cache|PGRST/i.test(String(error.message || ''))) {
          break;
        }
      }
    } catch (err) {
      lastError = err;
      if (!isSchemaCacheError(err)) break;
    }
  }
  return { data: null, error: lastError };
}

export async function fetchClinicFeed() {
  if (!isSupabaseConfigured()) {
    return { feed: [], error: new Error('Supabase not configured') };
  }

  try {
    const { data: questions, error: qErr } = await supabase
      .from('clinic_questions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    if (qErr && !isSchemaCacheError(qErr)) throw qErr;
    if (qErr) return { feed: [], error: null };

    const ids = (questions || []).map((q) => q.id);
    let repliesByQ = {};
    if (ids.length) {
      const { data: replies, error: rErr } = await supabase
        .from('clinic_replies')
        .select('*')
        .in('question_id', ids)
        .order('created_at', { ascending: true });
      if (rErr && !isSchemaCacheError(rErr)) throw rErr;
      for (const r of replies || []) {
        const key = String(r.question_id);
        if (!repliesByQ[key]) repliesByQ[key] = r;
      }
    }

    const feed = (questions || [])
      .map((q) => mapFeedItem(q, repliesByQ[String(q.id)] || null))
      .filter(Boolean);

    return { feed, error: null };
  } catch (error) {
    console.warn('[clinicService] fetchClinicFeed:', error?.message || error);
    return { feed: [], error };
  }
}

export async function askClinicQuestion({
  question,
  sport = 'GYM',
  athleteHandle,
} = {}) {
  const question_text = String(question || '').trim();
  if (!question_text) {
    return { item: null, error: new Error('Question required') };
  }
  const athlete_handle = normalizeHandle(
    athleteHandle || ACTIVE_USER?.handle || ACTIVE_USER?.displayName || '@athlete'
  );
  const sportValue = String(sport || 'GYM').toUpperCase();

  const localItem = mapFeedItem(
    {
      id: localId('q'),
      athlete_handle,
      sport: sportValue,
      question_text,
      created_at: new Date().toISOString(),
      localOnly: true,
    },
    null
  );

  if (!isSupabaseConfigured()) {
    return { item: localItem, error: null, localOnly: true };
  }

  const { data, error } = await insertWithFallbacks('clinic_questions', [
    { athlete_handle, sport: sportValue, question_text },
    { athlete_handle, sport: sportValue, question: question_text },
    { athlete_handle, question_text },
    { athlete_handle, question: question_text },
    { question_text },
    { question: question_text },
  ]);

  if (data) return { item: mapFeedItem(data, null), error: null, localOnly: false };

  if (!error || isSchemaCacheError(error)) {
    console.warn(
      '[clinicService] askClinicQuestion soft-fallback:',
      error?.message || 'schema cache'
    );
    return { item: localItem, error: null, localOnly: true };
  }

  console.warn('[clinicService] askClinicQuestion:', error?.message || error);
  return { item: localItem, error: null, localOnly: true };
}

export async function postClinicReply({
  questionId,
  expertName,
  expertRole = 'VERIFIED EXPERT',
  response,
  hasVideo = false,
  videoLabel = null,
} = {}) {
  const text = String(response || '').trim();
  if (!questionId || !text) {
    return { reply: null, error: new Error('questionId and response required') };
  }

  const localReply = {
    id: localId('r'),
    question_id: questionId,
    expert_name: String(expertName || 'Verified Expert').trim(),
    expert_role: String(expertRole || 'VERIFIED EXPERT').trim(),
    response: text,
    has_video: Boolean(hasVideo),
    video_label: videoLabel,
    localOnly: true,
  };

  if (!isSupabaseConfigured()) {
    return { reply: localReply, error: null, localOnly: true };
  }

  try {
    const { data, error } = await insertWithFallbacks('clinic_replies', [
      {
        question_id: questionId,
        expert_name: localReply.expert_name,
        expert_role: localReply.expert_role,
        response: text,
        has_video: Boolean(hasVideo),
        video_label: videoLabel,
      },
      {
        question_id: questionId,
        expert_name: localReply.expert_name,
        expert_role: localReply.expert_role,
        response: text,
      },
      {
        question_id: questionId,
        expert_name: localReply.expert_name,
        response: text,
      },
    ]);

    if (data) return { reply: data, error: null, localOnly: false };

    if (!error || isSchemaCacheError(error)) {
      console.warn(
        '[clinicService] postClinicReply soft-fallback:',
        error?.message || 'schema cache'
      );
      return { reply: localReply, error: null, localOnly: true };
    }

    return { reply: localReply, error: null, localOnly: true };
  } catch (error) {
    console.warn('[clinicService] postClinicReply:', error?.message || error);
    return { reply: localReply, error: null, localOnly: true };
  }
}
