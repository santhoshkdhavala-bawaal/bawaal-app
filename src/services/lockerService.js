/**
 * Locker Room ↔ Supabase `squads` + `sparring_logs`.
 * Payload fields match live table columns: kind / created_by / athlete_handle.
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
  };
}

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error || '');
  return /schema cache|PGRST204|Could not find .* column/i.test(msg);
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

    if (squadsRes.error) throw squadsRes.error;
    if (logsRes.error) throw logsRes.error;

    const hubs = [
      ...(squadsRes.data || []).map(mapSquadRow).filter(Boolean),
      ...(logsRes.data || []).map(mapSparringRow).filter(Boolean),
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
  if (!isSupabaseConfigured()) {
    return { hub: null, error: new Error('Supabase not configured') };
  }
  const title = String(name || '').trim() || 'New Training Squad';
  const created_by = String(createdBy || ACTIVE_USER?.handle || 'athlete').trim();
  const kindValue = String(kind || 'TRAINING SQUAD').toUpperCase();

  try {
    // Minimal payload aligned to live squads columns (kind + created_by required by schema)
    const { data, error } = await supabase
      .from('squads')
      .insert({
        name: title,
        kind: kindValue,
        privacy: String(privacy || 'Invite only'),
        member_count: 1,
        last_message: 'Squad created · welcome to the hub',
        created_by,
      })
      .select('*')
      .single();
    if (error) {
      if (isSchemaCacheError(error)) {
        return {
          hub: null,
          error: new Error(
            `${error.message}\n\n${LOCKER_SETUP_HINT} (re-run to reload schema cache)`
          ),
        };
      }
      throw error;
    }
    return { hub: mapSquadRow(data), error: null };
  } catch (error) {
    console.warn('[lockerService] createTrainingSquad:', error?.message || error);
    return { hub: null, error };
  }
}

export async function createSparringLog({
  title,
  lastNote = 'First session logged',
  createdBy,
  athleteHandle,
} = {}) {
  if (!isSupabaseConfigured()) {
    return { hub: null, error: new Error('Supabase not configured') };
  }
  const name = String(title || '').trim() || 'New Sparring Log';
  const created_by = String(createdBy || ACTIVE_USER?.handle || 'athlete').trim();
  const athlete_handle = normalizeHandle(athleteHandle || created_by);

  try {
    const { data, error } = await supabase
      .from('sparring_logs')
      .insert({
        title: name,
        sessions_logged: 1,
        last_note: lastNote,
        created_by,
        athlete_handle,
      })
      .select('*')
      .single();
    if (error) {
      if (isSchemaCacheError(error)) {
        return {
          hub: null,
          error: new Error(
            `${error.message}\n\n${LOCKER_SETUP_HINT} (re-run to reload schema cache)`
          ),
        };
      }
      throw error;
    }
    return { hub: mapSparringRow(data), error: null };
  } catch (error) {
    console.warn('[lockerService] createSparringLog:', error?.message || error);
    return { hub: null, error };
  }
}
