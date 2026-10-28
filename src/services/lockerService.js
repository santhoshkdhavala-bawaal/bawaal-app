/**
 * Locker Room ↔ Supabase `squads` + `squad_briefs`.
 * Squad Briefs pin onto squad cards as live tactical headers.
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

function mapBrief(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    squadId: row.squad_id ? String(row.squad_id) : null,
    title: String(row.title || 'Squad Brief'),
    sportTag: String(row.sport_tag || 'Other').toUpperCase(),
    intel: String(row.intel || row.brief_intel || ''),
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    localOnly: Boolean(row.localOnly),
  };
}

function mapSquadRow(row, brief = null) {
  if (!row) return null;
  const members = Number(row.member_count) || 1;
  const privacy = String(row.privacy || 'Invite only');
  const kind = String(row.kind || 'TRAINING SQUAD').toUpperCase();
  const pinned =
    brief ||
    (row.brief_title
      ? {
          id: `pinned-${row.id}`,
          title: String(row.brief_title),
          sportTag: String(row.brief_sport || 'Other').toUpperCase(),
          intel: String(row.brief_intel || ''),
        }
      : null);

  const action = kind.includes('GYM') ? 'JOIN CIRCLE' : 'VIEW SQUAD';
  return {
    id: String(row.id),
    kind,
    title: String(row.name || 'Untitled Squad'),
    meta: `${members} athlete${members === 1 ? '' : 's'} · ${privacy}`,
    detail: pinned?.intel
      ? pinned.intel
      : String(row.last_message || 'New hub · tap to open'),
    action,
    source: 'squad',
    createdAt: row.created_at || null,
    localOnly: Boolean(row.localOnly),
    brief: pinned
      ? {
          id: pinned.id,
          title: pinned.title,
          sportTag: pinned.sportTag,
          intel: pinned.intel || '',
        }
      : null,
  };
}

/** Standalone brief card when no squad exists to pin onto. */
function mapBriefAsHub(brief) {
  if (!brief) return null;
  return {
    id: String(brief.id),
    kind: 'SQUAD BRIEF',
    title: String(brief.title || 'Squad Brief'),
    meta: `Sport · ${brief.sportTag || 'OTHER'}`,
    detail: String(brief.intel || 'Tactical brief pinned'),
    action: 'OPEN BRIEF',
    source: 'brief',
    createdAt: brief.createdAt || null,
    localOnly: Boolean(brief.localOnly),
    brief: {
      id: brief.id,
      title: brief.title,
      sportTag: brief.sportTag,
      intel: brief.intel || '',
    },
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

async function updateSquadBriefFields(squadId, { title, sportTag, intel }) {
  if (!squadId || !isSupabaseConfigured()) return;
  const variants = [
    {
      brief_title: title,
      brief_sport: sportTag,
      brief_intel: intel,
      last_message: title,
    },
    { brief_title: title, brief_sport: sportTag, last_message: title },
    { last_message: `${sportTag}: ${title}` },
  ];
  for (const patch of variants) {
    try {
      const { error } = await supabase.from('squads').update(patch).eq('id', squadId);
      if (!error) return;
      if (!isSchemaCacheError(error)) break;
    } catch {
      break;
    }
  }
}

/** Active hubs = squads (with pinned briefs) + orphan briefs. */
export async function fetchActiveHubs() {
  if (!isSupabaseConfigured()) {
    return { hubs: [], error: new Error('Supabase not configured') };
  }

  try {
    const [squadsRes, briefsRes, legacySparRes] = await Promise.all([
      supabase
        .from('squads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('squad_briefs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('sparring_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (squadsRes.error && !isSchemaCacheError(squadsRes.error)) throw squadsRes.error;

    const briefs = (briefsRes.data || []).map(mapBrief).filter(Boolean);
    const briefsBySquad = {};
    const orphanBriefs = [];
    for (const b of briefs) {
      if (b.squadId) {
        if (!briefsBySquad[b.squadId]) briefsBySquad[b.squadId] = b;
      } else {
        orphanBriefs.push(b);
      }
    }

    const squadHubs = (squadsRes.data || [])
      .map((row) => mapSquadRow(row, briefsBySquad[String(row.id)] || null))
      .filter(Boolean);

    // Prefer pinning orphan briefs onto the newest squad without a brief
    const needsBrief = squadHubs.filter((h) => !h.brief);
    const stillOrphan = [];
    for (const b of orphanBriefs) {
      const target = needsBrief.shift();
      if (target) {
        target.brief = {
          id: b.id,
          title: b.title,
          sportTag: b.sportTag,
          intel: b.intel || '',
        };
        if (b.intel) target.detail = b.intel;
      } else {
        stillOrphan.push(b);
      }
    }

    // Legacy sparring_logs → treat as squad briefs if table still has rows
    const legacyHubs = [];
    if (!legacySparRes.error && legacySparRes.data?.length) {
      for (const row of legacySparRes.data) {
        legacyHubs.push(
          mapBriefAsHub({
            id: String(row.id),
            title: String(row.title || 'Squad Brief'),
            sportTag: 'OTHER',
            intel: String(row.last_note || ''),
            createdAt: row.created_at,
          })
        );
      }
    }

    const hubs = [
      ...squadHubs,
      ...stillOrphan.map(mapBriefAsHub).filter(Boolean),
      ...legacyHubs,
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

/**
 * Post a universal Squad Brief and pin it onto a squad (newest by default).
 */
export async function createSquadBrief({
  title,
  sportTag = 'Other',
  intel = '',
  squadId = null,
  createdBy,
  athleteHandle,
} = {}) {
  const briefTitle = String(title || '').trim() || 'Squad Brief';
  const sport = String(sportTag || 'Other').trim() || 'Other';
  const briefIntel = String(intel || '').trim();
  const created_by = String(createdBy || ACTIVE_USER?.handle || 'athlete').trim();
  const athlete_handle = normalizeHandle(athleteHandle || created_by);

  let targetSquadId = squadId ? String(squadId) : null;

  if (!targetSquadId && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('squads')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) targetSquadId = String(data.id);
    } catch {
      /* ignore */
    }
  }

  const localBrief = mapBrief({
    id: localId('brief'),
    squad_id: targetSquadId,
    title: briefTitle,
    sport_tag: sport,
    intel: briefIntel,
    created_by,
    created_at: new Date().toISOString(),
    localOnly: true,
  });

  const buildHub = (brief, squadRow = null) => {
    if (squadRow || targetSquadId) {
      return mapSquadRow(
        squadRow || {
          id: targetSquadId || localId('squad'),
          name: 'Active Squad',
          kind: 'TRAINING SQUAD',
          privacy: 'Invite only',
          member_count: 1,
          last_message: briefTitle,
          created_at: new Date().toISOString(),
          localOnly: true,
        },
        brief
      );
    }
    return mapBriefAsHub(brief);
  };

  if (!isSupabaseConfigured()) {
    return { hub: buildHub(localBrief), brief: localBrief, error: null, localOnly: true };
  }

  const { data, error } = await insertWithFallbacks('squad_briefs', [
    {
      title: briefTitle,
      sport_tag: sport,
      intel: briefIntel,
      squad_id: targetSquadId,
      created_by,
      athlete_handle,
    },
    {
      title: briefTitle,
      sport_tag: sport,
      intel: briefIntel,
      squad_id: targetSquadId,
      created_by,
    },
    {
      title: briefTitle,
      sport_tag: sport,
      intel: briefIntel,
      created_by,
    },
    { title: briefTitle, sport_tag: sport, intel: briefIntel },
    { title: briefTitle, sport_tag: sport },
    { title: briefTitle },
    // Legacy sparring_logs fallback if squad_briefs not provisioned yet
  ]);

  let brief = data ? mapBrief(data) : null;

  if (!brief) {
    // Fall back to sparring_logs table for transitional schemas
    const legacy = await insertWithFallbacks('sparring_logs', [
      {
        title: briefTitle,
        sessions_logged: 1,
        last_note: `[${sport}] ${briefIntel || briefTitle}`,
        created_by,
        athlete_handle,
      },
      {
        title: briefTitle,
        last_note: briefIntel || briefTitle,
        created_by,
      },
      { title: briefTitle },
    ]);
    if (legacy.data) {
      brief = mapBrief({
        id: legacy.data.id,
        squad_id: targetSquadId,
        title: legacy.data.title,
        sport_tag: sport,
        intel: legacy.data.last_note || briefIntel,
        created_by,
        created_at: legacy.data.created_at,
      });
    }
  }

  if (!brief) {
    console.warn(
      '[lockerService] createSquadBrief soft-fallback:',
      error?.message || 'schema cache'
    );
    brief = localBrief;
  }

  if (targetSquadId) {
    await updateSquadBriefFields(targetSquadId, {
      title: briefTitle,
      sportTag: sport,
      intel: briefIntel,
    });
  }

  let squadRow = null;
  if (targetSquadId) {
    try {
      const { data: s } = await supabase
        .from('squads')
        .select('*')
        .eq('id', targetSquadId)
        .maybeSingle();
      squadRow = s || null;
    } catch {
      /* ignore */
    }
  }

  return {
    hub: buildHub(brief, squadRow),
    brief,
    error: null,
    localOnly: Boolean(brief.localOnly),
  };
}

/** @deprecated Use createSquadBrief */
export async function createSparringLog(args = {}) {
  return createSquadBrief({
    title: args.title,
    sportTag: 'Combat',
    intel: args.lastNote || '',
    createdBy: args.createdBy,
    athleteHandle: args.athleteHandle,
  });
}
