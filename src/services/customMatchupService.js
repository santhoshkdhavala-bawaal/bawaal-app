/**
 * Custom Matchup Roster — fetch challenge_responses + challenge_votes,
 * cast pairwise votes for a selected head-to-head.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(s) ? s : null;
}

async function resolveVoterId(explicitId = null) {
  const fromExplicit = asUuidOrNull(explicitId);
  if (fromExplicit) return fromExplicit;
  try {
    const { data } = await supabase.auth.getUser();
    return asUuidOrNull(data?.user?.id) || null;
  } catch {
    return null;
  }
}

function normalizeHandle(raw, fallback = 'athlete') {
  const h = String(raw || fallback)
    .trim()
    .replace(/^@+/, '');
  return h ? `@${h}` : `@${fallback}`;
}

/**
 * Aggregate vote counts keyed by response id (voted_for_id).
 */
function tallyVotes(voteRows = []) {
  const map = new Map();
  for (const row of voteRows) {
    const key = String(row?.voted_for_id || row?.response_id || '');
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/**
 * Pairwise vote tallies for a specific A vs B matchup.
 */
export function tallyMatchupVotes(voteRows = [], fighterAId, fighterBId) {
  const a = String(fighterAId || '');
  const b = String(fighterBId || '');
  let votesA = 0;
  let votesB = 0;
  for (const row of voteRows) {
    const forId = String(row?.voted_for_id || '');
    const left = String(row?.fighter_a_id || '');
    const right = String(row?.fighter_b_id || '');
    const samePair =
      (left === a && right === b) || (left === b && right === a);
    if (!samePair) continue;
    if (forId === a) votesA += 1;
    else if (forId === b) votesB += 1;
  }
  return { votesA, votesB };
}

function mapResponseRow(row, voteMap, meta = {}) {
  if (!row) return null;
  const id = String(row.id);
  const handle = normalizeHandle(
    row.handle ||
      row.athlete_handle ||
      row.display_name ||
      row.athlete_id ||
      'athlete'
  );
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
  return {
    id,
    challengeId: row.challenge_id ? String(row.challenge_id) : null,
    athleteId: row.athlete_id ? String(row.athlete_id) : null,
    handle,
    displayName: String(row.display_name || handle.replace(/^@/, '')),
    videoUri: row.video_url || row.videoUri || null,
    video_url: row.video_url || null,
    uri: row.video_url || null,
    votes: voteMap.get(id) || Number(row.votes) || 0,
    createdAt,
    isGladiator: Boolean(
      meta.gladiatorId &&
        row.athlete_id &&
        String(row.athlete_id) === String(meta.gladiatorId)
    ),
    isFirstBlood: Boolean(meta.firstBloodId && id === String(meta.firstBloodId)),
    raw: row,
  };
}

/**
 * Fetch roster + votes for an active challenge.
 * Soft-fails to [] when offline / schema missing.
 *
 * @param {string} challengeId
 * @returns {Promise<{
 *   ok: boolean,
 *   responses: Array,
 *   votes: Array,
 *   gladiatorId: string|null,
 *   error?: unknown
 * }>}
 */
export async function fetchChallengeMatchupRoster(challengeId) {
  const id = asUuidOrNull(challengeId) || String(challengeId || '').trim();
  if (!id) {
    return { ok: false, responses: [], votes: [], gladiatorId: null, error: 'missing-challenge-id' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      responses: [],
      votes: [],
      gladiatorId: null,
      error: 'supabase-not-configured',
    };
  }

  let gladiatorId = null;
  try {
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, gladiator_id, title, hashtag, tier')
      .eq('id', id)
      .maybeSingle();
    gladiatorId = challenge?.gladiator_id
      ? String(challenge.gladiator_id)
      : null;
  } catch {
    /* soft */
  }

  let responseRows = [];
  try {
    const { data, error } = await supabase
      .from('challenge_responses')
      .select(
        'id, challenge_id, athlete_id, video_url, created_at, handle, display_name, votes'
      )
      .eq('challenge_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      const retry = await supabase
        .from('challenge_responses')
        .select('id, challenge_id, athlete_id, video_url, created_at')
        .eq('challenge_id', id)
        .order('created_at', { ascending: true });
      if (retry.error) throw retry.error;
      responseRows = retry.data || [];
    } else {
      responseRows = data || [];
    }
  } catch (err) {
    console.warn(
      '[customMatchup] fetch responses soft-fail:',
      err?.message || err
    );
    return {
      ok: false,
      responses: [],
      votes: [],
      gladiatorId,
      error: err,
    };
  }

  let voteRows = [];
  try {
    const { data, error } = await supabase
      .from('challenge_votes')
      .select(
        'id, challenge_id, fighter_a_id, fighter_b_id, voted_for_id, response_id, voter_id, created_at'
      )
      .eq('challenge_id', id);

    if (error) {
      const slim = await supabase
        .from('challenge_votes')
        .select('id, challenge_id, voted_for_id, response_id, voter_id, created_at')
        .eq('challenge_id', id);
      if (!slim.error) voteRows = slim.data || [];
      else {
        console.warn(
          '[customMatchup] fetch votes soft-fail:',
          error.message || error.code
        );
      }
    } else {
      voteRows = data || [];
    }
  } catch (err) {
    console.warn('[customMatchup] votes query threw:', err?.message || err);
  }

  const voteMap = tallyVotes(voteRows);
  const firstBloodId = responseRows[0]?.id ? String(responseRows[0].id) : null;
  const responses = responseRows
    .map((row) =>
      mapResponseRow(row, voteMap, { gladiatorId, firstBloodId })
    )
    .filter(Boolean);

  // Enrich handles from profiles when missing
  const athleteIds = [
    ...new Set(
      responses
        .map((r) => asUuidOrNull(r.athleteId))
        .filter(Boolean)
    ),
  ];
  if (athleteIds.length) {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, handle, display_name')
        .in('id', athleteIds);
      const byId = new Map(
        (profiles || []).map((p) => [String(p.id), p])
      );
      for (const r of responses) {
        const p = byId.get(String(r.athleteId));
        if (!p) continue;
        if (!r.handle || r.handle === '@athlete' || /^@[0-9a-f-]{8,}$/i.test(r.handle)) {
          r.handle = normalizeHandle(p.handle || p.display_name || r.handle);
          r.displayName = String(p.display_name || r.handle.replace(/^@/, ''));
        }
      }
    } catch {
      /* soft */
    }
  }

  return {
    ok: true,
    responses,
    votes: voteRows,
    gladiatorId,
    error: null,
  };
}

/**
 * Cast a pairwise matchup vote for fighterA vs fighterB.
 * Soft-fails offline — still returns optimistic local counts.
 */
export async function castCustomMatchupVote({
  challengeId,
  fighterAId,
  fighterBId,
  votedForId,
  voterId: explicitVoterId = null,
}) {
  const challenge = asUuidOrNull(challengeId) || String(challengeId || '').trim();
  const a = String(fighterAId || '');
  const b = String(fighterBId || '');
  const forId = String(votedForId || '');
  if (!challenge || !a || !b || !forId) {
    return { ok: false, error: 'missing-fields' };
  }
  if (forId !== a && forId !== b) {
    return { ok: false, error: 'voted_for must be fighter A or B' };
  }

  const voterId =
    (await resolveVoterId(explicitVoterId)) ||
    asUuidOrNull(getActiveUser()?.userId) ||
    asUuidOrNull(getActiveUser()?.id);

  const row = {
    challenge_id: challenge,
    fighter_a_id: a,
    fighter_b_id: b,
    voted_for_id: forId,
    response_id: forId,
    created_at: new Date().toISOString(),
  };
  if (voterId) row.voter_id = voterId;

  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, data: row };
  }

  try {
    // Replace prior vote for this voter + unordered pair (soft)
    if (voterId) {
      const { data: prior } = await supabase
        .from('challenge_votes')
        .select('id, fighter_a_id, fighter_b_id')
        .eq('challenge_id', challenge)
        .eq('voter_id', voterId);
      const staleIds = (prior || [])
        .filter((v) => {
          const left = String(v.fighter_a_id || '');
          const right = String(v.fighter_b_id || '');
          return (
            (left === a && right === b) || (left === b && right === a)
          );
        })
        .map((v) => v.id)
        .filter(Boolean);
      if (staleIds.length) {
        await supabase.from('challenge_votes').delete().in('id', staleIds);
      }
    }

    let { data, error } = await supabase
      .from('challenge_votes')
      .insert([row])
      .select()
      .maybeSingle();

    if (
      error &&
      row.voter_id &&
      /voter_id|foreign key|uuid|23503|22P02/i.test(
        String(error.message || error.code || '')
      )
    ) {
      const { voter_id: _omit, ...withoutVoter } = row;
      ({ data, error } = await supabase
        .from('challenge_votes')
        .insert([withoutVoter])
        .select()
        .maybeSingle());
    }

    if (error) {
      console.warn(
        '[customMatchup] vote insert soft-fail:',
        error.message || error.code
      );
      return { ok: false, error, data: null };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn('[customMatchup] vote threw:', err?.message || err);
    return { ok: false, error: err };
  }
}
