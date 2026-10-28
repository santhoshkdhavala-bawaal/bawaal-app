/**
 * Clinic ↔ Supabase `clinic_questions` + `clinic_replies`.
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

function mapFeedItem(question, reply) {
  if (!question) return null;
  const handle = String(question.athlete_handle || '@athlete');
  return {
    id: String(question.id),
    athlete: handle.startsWith('@') ? handle : `@${handle}`,
    sport: String(question.sport || 'GYM').toUpperCase(),
    question: String(question.question || ''),
    time: relativeTime(question.created_at),
    expert: reply
      ? {
          name: String(reply.expert_name || 'Verified Expert'),
          role: String(reply.expert_role || 'VERIFIED EXPERT'),
          response: String(reply.response || ''),
          hasVideo: Boolean(reply.has_video),
          videoLabel: reply.video_label || 'VIDEO ADVISORY',
        }
      : null,
  };
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
    if (qErr) throw qErr;

    const ids = (questions || []).map((q) => q.id);
    let repliesByQ = {};
    if (ids.length) {
      const { data: replies, error: rErr } = await supabase
        .from('clinic_replies')
        .select('*')
        .in('question_id', ids)
        .order('created_at', { ascending: true });
      if (rErr) throw rErr;
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
  if (!isSupabaseConfigured()) {
    return { item: null, error: new Error('Supabase not configured') };
  }
  const text = String(question || '').trim();
  if (!text) {
    return { item: null, error: new Error('Question required') };
  }
  const handle =
    athleteHandle ||
    ACTIVE_USER?.handle ||
    ACTIVE_USER?.displayName ||
    '@athlete';

  try {
    const { data, error } = await supabase
      .from('clinic_questions')
      .insert({
        athlete_handle: handle.startsWith('@') ? handle : `@${handle}`,
        sport: String(sport || 'GYM').toUpperCase(),
        question: text,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { item: mapFeedItem(data, null), error: null };
  } catch (error) {
    console.warn('[clinicService] askClinicQuestion:', error?.message || error);
    return { item: null, error };
  }
}

export async function postClinicReply({
  questionId,
  expertName,
  expertRole = 'VERIFIED EXPERT',
  response,
  hasVideo = false,
  videoLabel = null,
} = {}) {
  if (!isSupabaseConfigured()) {
    return { reply: null, error: new Error('Supabase not configured') };
  }
  const text = String(response || '').trim();
  if (!questionId || !text) {
    return { reply: null, error: new Error('questionId and response required') };
  }
  try {
    const { data, error } = await supabase
      .from('clinic_replies')
      .insert({
        question_id: questionId,
        expert_name: String(expertName || 'Verified Expert').trim(),
        expert_role: String(expertRole || 'VERIFIED EXPERT').trim(),
        response: text,
        has_video: Boolean(hasVideo),
        video_label: videoLabel,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { reply: data, error: null };
  } catch (error) {
    console.warn('[clinicService] postClinicReply:', error?.message || error);
    return { reply: null, error };
  }
}
