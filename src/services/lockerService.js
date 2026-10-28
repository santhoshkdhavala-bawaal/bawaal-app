/**
 * Locker Room ↔ Supabase `squads` + `sparring_logs`.
 * Inserts retry with progressive optional-field payloads; schema-cache misses
 * fall back to a local hub so the UI never surfaces PGRST204 popups.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { ACTIVE_USER } from './activeUserProfile';

export const LOCKER_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_LOCKER_CLINIC_PROFILES.sql';

function normalizeHandle(raw) {
  const h = String(raw || ACTIVE_USER?.handle || '@athlete').trim();
  if (!h) return '@athlete';
  return h.startsWith('@') ? h : `@${h}`;
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

function mapSquadRow(row) {
  if (!row) return null;
  const members = Number(row.member_count) || 1;
  const privacy = String(row.privacy || 'Invite only');
  const kind = String(row.kind || 'TRAINING SQUAD').toUpperCase();
  const action =
    kind.includes('GYM')
      ? 'JOIN CIRCLE'
      : kind.includes('SPAR')
        ? 'OPEN LOG'
        : 'VIEW SQUAD';
  return {
    id: String(row.id),
    kind,
    title: String(row.name || 'Untitled Squad'),
    meta: `${members} athlete${members === 1 ? '' : 's'} · ${privacy}`,
    detail: String(row.last_message || 'New hub · tap to open'),
    action,
    source: 'squad',
    createdAt: row.created_at || null,
    localOnly: Boolean(row.localOnly),
  };
}

function mapSparringRow(row) {
  if (!row) return null;
  const sessions = Number(row.sessions_logged) || 1;
  return {
    id: String(row.id),
    kind: 'SPARRING LOG',
    title: String(row.title || 'Sparring Log'),
    meta: `${sessions} session${sessions === 1 ? '' : 's'} logged`,
    detail: String(row.last_note || 'Log started · notes open'),
    action: 'OPEN LOG',
    source: 'sparring',
    createdAt: row.created_at || null,
    localOnly: Boolean(row.localOnly),
  };
}

/** Try insert payloads in order; ignore schema-cache column mismatches. */
async function insertWithFallbacks(table, variants) {
  let lastError = null;
  for (const payload of variants) {
    try {
      const { data, error } = await supabase.from(table).insert(payload).select('*').single();
      if (!error && data) return { data, error: null };
      lastError = error || lastError;
      if (error && !isSchemaCacheError(error)) {
        // Non-schema failure (RLS, network) — stop early
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

/** Active hubs = squads + sparring logs, newest first. */
export async function fetchActiveHubs() {
  if (!isSupabaseConfigured()) {
    return { hubs: [], error: new Error('Supabase not configured') };
  }

  try {
    const [squadsRes, logsRes] = await Promise.all([
      supabase
        .from('squads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('sparring_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    if (squadsRes.error && !isSchemaCacheError(squadsRes.error)) throw squadsRes.error;
    if (logsRes.error && !isSchemaCacheError(logsRes.error)) throw logsRes.error;

    const hubs = [
      ...((squadsRes.data || []).map(mapSquadRow).filter(Boolean)),
      ...((logsRes.data || []).map(mapSparringRow).filter(Boolean)),
    ];

    hubs.sort((a, b) => {
      const tb = Date.parse(String(b.createdAt || '')) || 0;
      const ta = Date.parse(String(a.createdAt || '')) || 0;
      return tb - ta;
    });
    return { hubs, error: null };
  } catch (error) {
    console.warn('[lockerService] fetchActiveHubs:', error?.message || error);
    return { hubs: [], error };
  }
}

export async function createTrainingSquad({
  name,
  kind = 'TRAINING SQUAD',
  privacy = 'Invite only',
  createdBy,
} = {}) {
  const title = String(name || '').trim() || 'New Training Squad';
  const created_by = String(createdBy || ACTIVE_USER?.handle || 'athlete').trim();
  const kindValue = String(kind || 'TRAINING SQUAD').toUpperCase();
  const privacyValue = String(privacy || 'Invite only');

  const localHub = mapSquadRow({
    id: localId('squad'),
    name: title,
    kind: kindValue,
    privacy: privacyValue,
    member_count: 1,
    last_message: 'Squad created · welcome to the hub',
    created_by,
    created_at: new Date().toISOString(),
    localOnly: true,
  });

  if (!isSupabaseConfigured()) {
    return { hub: localHub, error: null, localOnly: true };
  }

  const { data, error } = await insertWithFallbacks('squads', [
    {
      name: title,
      kind: kindValue,
      privacy: privacyValue,
      member_count: 1,
      last_message: 'Squad created · welcome to the hub',
      created_by,
    },
    { name: title, kind: kindValue, created_by },
    { name: title, kind: kindValue },
    { name: title, created_by },
    { name: title },
  ]);

  if (data) return { hub: mapSquadRow(data), error: null, localOnly: false };

  // Schema cache / transient column mismatch — keep UI flowing with local hub
  if (!error || isSchemaCacheError(error)) {
    console.warn(
      '[lockerService] createTrainingSquad soft-fallback:',
      error?.message || 'schema cache'
    );
    return { hub: localHub, error: null, localOnly: true };
  }

  console.warn('[lockerService] createTrainingSquad:', error?.message || error);
  return { hub: localHub, error: null, localOnly: true };
}

export async function createSparringLog({
  title,
  lastNote = 'First session logged',
  createdBy,
  athleteHandle,
} = {}) {
  const name = String(title || '').trim() || 'New Sparring Log';
  const created_by = String(createdBy || ACTIVE_USER?.handle || 'athlete').trim();
  const athlete_handle = normalizeHandle(athleteHandle || created_by);

  const localHub = mapSparringRow({
    id: localId('spar'),
    title: name,
    sessions_logged: 1,
    last_note: lastNote,
    created_by,
    athlete_handle,
    created_at: new Date().toISOString(),
    localOnly: true,
  });

  if (!isSupabaseConfigured()) {
    return { hub: localHub, error: null, localOnly: true };
  }

  const { data, error } = await insertWithFallbacks('sparring_logs', [
    {
      title: name,
      sessions_logged: 1,
      last_note: lastNote,
      created_by,
      athlete_handle,
    },
    {
      title: name,
      sessions_logged: 1,
      last_note: lastNote,
      created_by,
    },
    { title: name, created_by, athlete_handle },
    { title: name, created_by },
    { title: name, athlete_handle },
    { title: name },
  ]);

  if (data) return { hub: mapSparringRow(data), error: null, localOnly: false };

  if (!error || isSchemaCacheError(error)) {
    console.warn(
      '[lockerService] createSparringLog soft-fallback:',
      error?.message || 'schema cache'
    );
    return { hub: localHub, error: null, localOnly: true };
  }

  console.warn('[lockerService] createSparringLog:', error?.message || error);
  return { hub: localHub, error: null, localOnly: true };
}
