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
import { getCountryFlagForLocation } from '../utils/liveMatchLocationFlag';

const TABLE = 'live_matches';
const INVITES_TABLE = 'live_match_invites';
const BANTER_CAP = 40;
const VOTE_FLUSH_MS = 8000;
const INVITE_TTL_MS = 5 * 60 * 1000;

/** 6-char uppercase code — no ambiguous 0/O/1/I. */
function newInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

function sanitizeInviteCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function normalizeInviteHandle(value) {
  return String(value || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

function userInviteChannelName(userId, handle) {
  const id = String(userId || '').trim();
  if (id) return `live-user-invites-${id}`;
  const h = normalizeInviteHandle(handle);
  return h ? `live-user-invites-h-${h}` : '';
}

/**
 * High-octane labeled pills above banter (vault skull keys only — no unicode).
 * FIRE · ROAST · BEAST · WEAK · HYPE
 */
export const LIVE_MATCH_REACTION_PILLS = Object.freeze([
  { id: 'fire', label: 'FIRE', emojiKey: 'skull_fire' },
  { id: 'roast', label: 'ROAST', emojiKey: 'skull_devil' },
  { id: 'beast', label: 'BEAST', emojiKey: 'skull_rage' },
  { id: 'weak', label: 'WEAK', emojiKey: 'skull_dead_xx' },
  { id: 'hype', label: 'HYPE', emojiKey: 'skull_hyped' },
]);

/**
 * Banter-tray skull vibes: Fire · Devil · Winning · Sad · Scream.
 * Sources + labels live in liveMatchFlamingSkulls.js (static Metro requires).
 */
export const LIVE_MATCH_BANTER_EMOJIS = Object.freeze([
  { id: 'fire', emojiKey: 'skull_fire', label: 'FIRE' },
  { id: 'devil', emojiKey: 'skull_devil', label: 'DEVIL' },
  { id: 'winning', emojiKey: 'skull_champion', label: 'WIN' },
  { id: 'crying', emojiKey: 'skull_crying', label: 'SAD' },
  { id: 'screaming', emojiKey: 'skull_screaming', label: 'SCREAM' },
]);

/** Alias for Live Match skull-picker consumers. */
export { LIVE_MATCH_FLAMING_SKULLS } from '../constants/liveMatchFlamingSkulls';

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

function isMissingColumnError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(
    error.message || error.details || error.hint || error || ''
  );
  return (
    code === 'PGRST204' ||
    /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(
      msg
    )
  );
}

function truthyScoreboard(value) {
  if (value === false || value === 0 || value === 'false' || value === '0') {
    return false;
  }
  if (value === true || value === 1 || value === 'true' || value === '1') {
    return true;
  }
  // Unmigrated / legacy rows → keep scoreboard (prior default UX)
  return true;
}

/** Format legal balls as cricket overs.balls (e.g. 16 → "2.4"). */
export function formatCricketOvers(balls) {
  const total = Math.max(0, Math.floor(Number(balls) || 0));
  return `${Math.floor(total / 6)}.${total % 6}`;
}

export function isCricketSport(sport) {
  return (
    String(sport || '')
      .trim()
      .toUpperCase() === 'CRICKET'
  );
}

function normalizeActorLabel(value) {
  return String(value || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

/**
 * Host (starter) or designated admin/scorer may punch scores — audience never.
 * @param {object|null} match
 * @param {{ id?: string, userId?: string, handle?: string, username?: string, displayName?: string, name?: string }|null} actor
 */
export function canUserScoreMatch(match, actor = null) {
  if (!match || !actor) return false;
  const userId = String(actor.id || actor.userId || '').trim();
  const hostId = String(match.host_id || '').trim();
  if (userId && hostId && userId === hostId) return true;

  const adminLabel = normalizeActorLabel(
    match.admin_name || match.scorer_name || ''
  );
  if (!adminLabel) return false;

  const candidates = [
    actor.handle,
    actor.username,
    actor.displayName,
    actor.name,
  ]
    .map(normalizeActorLabel)
    .filter(Boolean);

  return candidates.some((c) => c === adminLabel);
}

function normalizeBattingTeam(value) {
  return String(value || '').toUpperCase() === 'B' ? 'B' : 'A';
}

/** @param {unknown} value */
function normalizeVisibility(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'private' || raw === 'invite' || raw === 'invite_only') {
    return 'private';
  }
  // Legacy / missing column → public (global roster)
  if (value === false || value === 0 || raw === 'false' || raw === '0') {
    return 'private';
  }
  return 'public';
}

function normalizeLocationLabel(value) {
  return String(value ?? '')
    .trim()
    .slice(0, 80);
}

/** True when match should appear on LIVE AROUND THE WORLD. */
export function isPublicLiveMatch(match) {
  if (!match || typeof match !== 'object') return false;
  if (match.status === 'ended') return false;
  if (typeof match.isPublic === 'boolean') return match.isPublic;
  return normalizeVisibility(match.visibility) === 'public';
}

function normalizeMatch(row) {
  if (!row || typeof row !== 'object') return null;
  const adminRaw =
    row.admin_name != null && String(row.admin_name).trim()
      ? String(row.admin_name).trim()
      : row.scorer_name != null
        ? String(row.scorer_name).trim()
        : '';
  const scorerRaw =
    row.scorer_name != null && String(row.scorer_name).trim()
      ? String(row.scorer_name).trim()
      : adminRaw;
  const battingTeam = normalizeBattingTeam(
    row.batting_team ?? row.battingTeam
  );
  const cricketRunsA = Math.max(0, Number(row.cricket_runs_a) || 0);
  const cricketRunsB = Math.max(0, Number(row.cricket_runs_b) || 0);
  const visibility = normalizeVisibility(
    row.visibility ?? row.isPublic ?? row.is_public
  );
  const locationLabel = normalizeLocationLabel(
    row.location_label ?? row.locationLabel ?? row.location
  );
  const derivedMeta = getCountryFlagForLocation(locationLabel);
  const storedIso = String(row.country_iso ?? row.countryIso ?? '')
    .trim()
    .toUpperCase();
  const storedFlag = String(
    row.country_flag ?? row.countryFlag ?? ''
  ).trim();
  const countryIso =
    (/^[A-Z]{2}$/.test(storedIso) ? storedIso : '') ||
    derivedMeta?.isoCode ||
    '';
  const countryFlag =
    (storedFlag && storedFlag !== '🌐' ? storedFlag : '') ||
    derivedMeta?.flagEmoji ||
    '';
  const countryName =
    String(row.country_name ?? row.countryName ?? '').trim() ||
    derivedMeta?.countryName ||
    '';
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
    has_scoreboard: truthyScoreboard(row.has_scoreboard),
    admin_name: adminRaw,
    scorer_name: scorerRaw,
    batting_team: battingTeam,
    cricket_runs_a: cricketRunsA,
    cricket_wickets_a: Math.max(
      0,
      Math.min(10, Number(row.cricket_wickets_a) || 0)
    ),
    cricket_balls_a: Math.max(0, Math.floor(Number(row.cricket_balls_a) || 0)),
    cricket_runs_b: cricketRunsB,
    cricket_wickets_b: Math.max(
      0,
      Math.min(10, Number(row.cricket_wickets_b) || 0)
    ),
    cricket_balls_b: Math.max(0, Math.floor(Number(row.cricket_balls_b) || 0)),
    invite_code: sanitizeInviteCode(row.invite_code) || '',
    visibility,
    location_label: locationLabel,
    country_flag: countryFlag,
    country_iso: countryIso,
    country_name: countryName,
    isPublic: visibility === 'public',
    // Convenience aliases for batting side (UI / docs)
    runs: battingTeam === 'B' ? cricketRunsB : cricketRunsA,
    wickets:
      battingTeam === 'B'
        ? Math.max(0, Math.min(10, Number(row.cricket_wickets_b) || 0))
        : Math.max(0, Math.min(10, Number(row.cricket_wickets_a) || 0)),
    balls:
      battingTeam === 'B'
        ? Math.max(0, Math.floor(Number(row.cricket_balls_b) || 0))
        : Math.max(0, Math.floor(Number(row.cricket_balls_a) || 0)),
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

function getLocalPublicLiveList() {
  return getLocalLiveList().filter(isPublicLiveMatch);
}

/** Public live match count for Arena header badge (local cache). */
export function getLiveMatchCount() {
  return getLocalPublicLiveList().length;
}

/**
 * Public-only live roster for LIVE AROUND THE WORLD.
 * @returns {Promise<object[]>}
 */
export async function listPublicLiveMatches() {
  const list = await listLiveMatches();
  return (Array.isArray(list) ? list : []).filter(isPublicLiveMatch);
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
  hasScoreboard = false,
  adminName = '',
  scorerName = '',
  visibility = 'public',
  locationLabel = '',
} = {}) {
  const id = newMatchId();
  const inviteCode = newInviteCode();
  const scoreboardOn = !!hasScoreboard;
  const adminLabel = String(adminName || scorerName || hostHandle || '')
    .trim()
    .replace(/^@/, '');
  const scorerLabel = String(scorerName || adminName || hostHandle || '')
    .trim()
    .replace(/^@/, '');
  const visibilityNorm = normalizeVisibility(visibility);
  const locationNorm = normalizeLocationLabel(locationLabel);
  const countryMeta = getCountryFlagForLocation(locationNorm);
  const row = normalizeMatch({
    id,
    host_id: String(hostId || `local:${Date.now()}`),
    host_handle: String(hostHandle || 'athlete'),
    sport: String(sport || DEFAULT_LIVE_MATCH_SPORT).toUpperCase(),
    title: scoreboardOn ? String(title || '').trim() : '',
    team_a_name: scoreboardOn
      ? String(teamAName || 'TEAM A').trim() || 'TEAM A'
      : 'TEAM A',
    team_b_name: scoreboardOn
      ? String(teamBName || 'TEAM B').trim() || 'TEAM B'
      : 'TEAM B',
    score_a: 0,
    score_b: 0,
    votes_a: 0,
    votes_b: 0,
    status: 'live',
    stream_room_id: id,
    created_at: new Date().toISOString(),
    has_scoreboard: scoreboardOn,
    admin_name: scoreboardOn ? adminLabel : '',
    scorer_name: scoreboardOn ? scorerLabel : '',
    batting_team: 'A',
    cricket_runs_a: 0,
    cricket_wickets_a: 0,
    cricket_balls_a: 0,
    cricket_runs_b: 0,
    cricket_wickets_b: 0,
    cricket_balls_b: 0,
    invite_code: inviteCode,
    visibility: visibilityNorm,
    location_label: locationNorm,
    country_flag: countryMeta?.flagEmoji || '',
    country_iso: countryMeta?.isoCode || '',
    country_name: countryMeta?.countryName || '',
  });

  localMatches.set(id, row);
  emitListListeners();

  if (shouldUseLocalOnly()) {
    return { ok: true, local: true, match: row };
  }

  const basePayload = {
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
  };
  const extendedPayload = {
    ...basePayload,
    has_scoreboard: row.has_scoreboard,
    admin_name: row.admin_name || null,
    scorer_name: row.scorer_name || null,
    batting_team: row.batting_team,
    cricket_runs_a: row.cricket_runs_a,
    cricket_wickets_a: row.cricket_wickets_a,
    cricket_balls_a: row.cricket_balls_a,
    cricket_runs_b: row.cricket_runs_b,
    cricket_wickets_b: row.cricket_wickets_b,
    cricket_balls_b: row.cricket_balls_b,
    invite_code: row.invite_code || null,
    visibility: row.visibility,
    location_label: row.location_label || null,
    country_flag: row.country_flag || null,
    country_iso: row.country_iso || null,
  };

  try {
    let { data, error } = await supabase
      .from(TABLE)
      .insert(extendedPayload)
      .select('*')
      .maybeSingle();

    // Unmigrated DB: strip new columns and retry once (local row keeps flags)
    if (error && isMissingColumnError(error)) {
      softFailWarn(
        'liveMatch:createCols',
        '[liveMatch] optional columns missing — retry base insert',
        error?.message || error
      );
      ({ data, error } = await supabase
        .from(TABLE)
        .insert(basePayload)
        .select('*')
        .maybeSingle());
      if (!error) {
        // Keep extended fields locally when DB strip-retry drops them
        const saved = normalizeMatch({
          ...(data || {}),
          has_scoreboard: row.has_scoreboard,
          admin_name: row.admin_name,
          scorer_name: row.scorer_name,
          invite_code: row.invite_code,
          batting_team: row.batting_team,
          cricket_runs_a: row.cricket_runs_a,
          cricket_wickets_a: row.cricket_wickets_a,
          cricket_balls_a: row.cricket_balls_a,
          cricket_runs_b: row.cricket_runs_b,
          cricket_wickets_b: row.cricket_wickets_b,
          cricket_balls_b: row.cricket_balls_b,
          visibility: row.visibility,
          location_label: row.location_label,
          country_flag: row.country_flag,
          country_iso: row.country_iso,
          country_name: row.country_name,
        }) || row;
        localMatches.set(saved.id, saved);
        emitListListeners();
        return { ok: true, local: true, match: saved };
      }
    }

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

async function broadcastScoreSync(matchId, match) {
  const id = String(matchId || '').trim();
  const room = rooms.get(id);
  if (!room?.channel || !isSupabaseConfigured()) return;
  try {
    await room.channel.send({
      type: 'broadcast',
      event: 'score_sync',
      payload: match,
    });
  } catch (_) {
    /* soft-fail score broadcast */
  }
}

/**
 * @param {string} matchId
 * @param {{ score_a?: number, score_b?: number }} scores
 * @param {object|null} [actor] — when provided, rejects non-host / non-admin
 */
export async function updateMatchScore(matchId, scores = {}, actor = null) {
  const id = String(matchId || '').trim();
  if (!id) return { ok: false, reason: 'no-id' };

  const prev = localMatches.get(id) || { id, score_a: 0, score_b: 0 };
  if (actor && !canUserScoreMatch(prev, actor)) {
    return { ok: false, reason: 'forbidden' };
  }
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
  void broadcastScoreSync(id, localMatches.get(id));

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
    const saved = normalizeMatch({ ...next, ...(data || {}) }) || localMatches.get(id);
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
 * Cricket score sync — runs / wickets / balls / batting_team.
 * Soft-fails when DB columns are missing; peers still get score_sync broadcast.
 * @param {string} matchId
 * @param {object} patch
 * @param {object|null} [actor] — when provided, rejects non-host / non-admin
 */
export async function updateMatchCricket(matchId, patch = {}, actor = null) {
  const id = String(matchId || '').trim();
  if (!id) return { ok: false, reason: 'no-id' };

  const prev = localMatches.get(id) || {
    id,
    batting_team: 'A',
    cricket_runs_a: 0,
    cricket_wickets_a: 0,
    cricket_balls_a: 0,
    cricket_runs_b: 0,
    cricket_wickets_b: 0,
    cricket_balls_b: 0,
    score_a: 0,
    score_b: 0,
  };
  if (actor && !canUserScoreMatch(prev, actor)) {
    return { ok: false, reason: 'forbidden' };
  }

  const battingTeam = normalizeBattingTeam(
    patch.batting_team != null ? patch.batting_team : prev.batting_team
  );
  const runsA =
    patch.cricket_runs_a != null
      ? Math.max(0, Number(patch.cricket_runs_a) || 0)
      : prev.cricket_runs_a || 0;
  const wicketsA =
    patch.cricket_wickets_a != null
      ? Math.max(0, Math.min(10, Number(patch.cricket_wickets_a) || 0))
      : prev.cricket_wickets_a || 0;
  const ballsA =
    patch.cricket_balls_a != null
      ? Math.max(0, Math.floor(Number(patch.cricket_balls_a) || 0))
      : prev.cricket_balls_a || 0;
  const runsB =
    patch.cricket_runs_b != null
      ? Math.max(0, Number(patch.cricket_runs_b) || 0)
      : prev.cricket_runs_b || 0;
  const wicketsB =
    patch.cricket_wickets_b != null
      ? Math.max(0, Math.min(10, Number(patch.cricket_wickets_b) || 0))
      : prev.cricket_wickets_b || 0;
  const ballsB =
    patch.cricket_balls_b != null
      ? Math.max(0, Math.floor(Number(patch.cricket_balls_b) || 0))
      : prev.cricket_balls_b || 0;

  const next = normalizeMatch({
    ...prev,
    batting_team: battingTeam,
    cricket_runs_a: runsA,
    cricket_wickets_a: wicketsA,
    cricket_balls_a: ballsA,
    cricket_runs_b: runsB,
    cricket_wickets_b: wicketsB,
    cricket_balls_b: ballsB,
    // Keep hub scoreline aligned with cricket runs
    score_a: runsA,
    score_b: runsB,
  });

  localMatches.set(id, { ...prev, ...next });
  emitListListeners();
  emitRoomHandlers(id, { type: 'score', match: localMatches.get(id) });
  void broadcastScoreSync(id, localMatches.get(id));

  if (shouldUseLocalOnly()) {
    return { ok: true, local: true, match: localMatches.get(id) };
  }

  const cricketPayload = {
    batting_team: next.batting_team,
    cricket_runs_a: next.cricket_runs_a,
    cricket_wickets_a: next.cricket_wickets_a,
    cricket_balls_a: next.cricket_balls_a,
    cricket_runs_b: next.cricket_runs_b,
    cricket_wickets_b: next.cricket_wickets_b,
    cricket_balls_b: next.cricket_balls_b,
    score_a: next.score_a,
    score_b: next.score_b,
  };

  try {
    let { data, error } = await supabase
      .from(TABLE)
      .update(cricketPayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      softFailWarn(
        'liveMatch:cricketCols',
        '[liveMatch] cricket columns missing — score_a/b only',
        error?.message || error
      );
      ({ data, error } = await supabase
        .from(TABLE)
        .update({ score_a: next.score_a, score_b: next.score_b })
        .eq('id', id)
        .select('*')
        .maybeSingle());
      if (!error) {
        const saved =
          normalizeMatch({ ...next, ...(data || {}) }) || localMatches.get(id);
        if (saved) localMatches.set(id, saved);
        emitListListeners();
        return { ok: true, local: true, match: saved };
      }
    }

    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(TABLE, 'liveMatch', error.message || error);
      } else {
        softFailWarn(
          'liveMatch:cricket',
          '[liveMatch] cricket update soft-fail',
          error
        );
      }
      return { ok: true, local: true, match: localMatches.get(id) };
    }
    const saved =
      normalizeMatch({ ...next, ...(data || {}) }) || localMatches.get(id);
    if (saved) localMatches.set(id, saved);
    emitListListeners();
    return { ok: true, match: saved };
  } catch (err) {
    softFailWarn(
      'liveMatch:cricketEx',
      '[liveMatch] cricket exception',
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
        channel.on('broadcast', { event: 'score_sync' }, (msg) => {
          const row = normalizeMatch(msg?.payload);
          if (!row?.id) return;
          const merged = { ...(localMatches.get(id) || {}), ...row, id };
          localMatches.set(id, merged);
          emitRoomHandlers(id, { type: 'score', match: merged });
          emitListListeners();
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

export function broadcastReaction(matchId, { emojiKey, handle, label } = {}) {
  const key = String(emojiKey || '').trim();
  if (!key) return Promise.resolve({ ok: false });
  const at = Date.now();
  const reactionId = `rx-${at}-${Math.random().toString(36).slice(2, 9)}`;
  return sendBroadcast(matchId, 'reaction', {
    reactionId,
    emojiKey: key,
    handle: String(handle || 'fan').slice(0, 32),
    label: label ? String(label).slice(0, 16) : undefined,
    at,
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

export function getLiveMatchInviteCode(match) {
  const existing = sanitizeInviteCode(match?.invite_code);
  if (existing.length === 6) return existing;
  // Persist a clean code on the in-memory match when missing (legacy rows)
  const generated = newInviteCode();
  if (match?.id && localMatches.has(String(match.id))) {
    const prev = localMatches.get(String(match.id));
    localMatches.set(String(match.id), { ...prev, invite_code: generated });
  }
  return generated;
}

export function buildLiveMatchInviteLink(match) {
  const id = String(match?.id || '').trim();
  const code = getLiveMatchInviteCode(match);
  if (!id) return `bawaal://live?code=${encodeURIComponent(code)}`;
  return `bawaal://live/${id}?code=${encodeURIComponent(code)}`;
}

/**
 * Soft athlete picker for invites — profiles search + local FOLLOWING/SUGGESTED.
 */
export async function searchLiveInviteAthletes(query = '') {
  const q = String(query || '').trim().toLowerCase();
  let remote = [];
  if (isSupabaseConfigured() && !isTableDisabled('profiles')) {
    try {
      let req = supabase
        .from('profiles')
        .select('id, username, real_name, category')
        .limit(24);
      if (q) {
        req = req.or(
          `username.ilike.%${q}%,real_name.ilike.%${q}%`
        );
      }
      const { data, error } = await req;
      if (error) {
        if (isMissingRelationError(error)) {
          markTableMissing('profiles', 'liveInvite', error.message || error);
        }
      } else {
        remote = (Array.isArray(data) ? data : []).map((row) => ({
          id: String(row.id || ''),
          handle: String(row.username || '')
            .replace(/^@/, '')
            .trim(),
          displayName: String(row.real_name || row.username || 'Athlete'),
          sport: String(row.category || '').toUpperCase(),
          source: 'profiles',
        }));
      }
    } catch (err) {
      softFailWarn(
        'liveInvite:search',
        '[liveInvite] profile search soft-fail',
        err?.message
      );
    }
  }

  let local = [];
  try {
    const { FOLLOWING, SUGGESTED } = require('../data/athleteSocial');
    local = [...(FOLLOWING || []), ...(SUGGESTED || [])].map((a) => ({
      id: String(a.id || ''),
      handle: String(a.handle || '')
        .replace(/^@/, '')
        .trim(),
      displayName: String(a.displayName || a.handle || 'Athlete'),
      sport: String(a.sport || '').toUpperCase(),
      source: 'local',
    }));
  } catch (_) {
    local = [];
  }

  const merged = [...remote, ...local];
  const seen = new Set();
  const filtered = merged.filter((a) => {
    const key = `${a.id}|${normalizeInviteHandle(a.handle)}`;
    if (!a.handle || seen.has(key)) return false;
    seen.add(key);
    if (!q) return true;
    return (
      normalizeInviteHandle(a.handle).includes(q) ||
      String(a.displayName || '')
        .toLowerCase()
        .includes(q) ||
      String(a.sport || '')
        .toLowerCase()
        .includes(q)
    );
  });
  return filtered.slice(0, 30);
}

function buildInvitePayload(match, sender, recipient) {
  const at = Date.now();
  const senderHandle = String(
    sender?.handle || sender?.username || match?.host_handle || 'fan'
  ).replace(/^@/, '');
  return {
    inviteId: `inv-${at}-${Math.random().toString(36).slice(2, 8)}`,
    matchId: String(match?.id || ''),
    inviteCode: getLiveMatchInviteCode(match),
    // Match host id stays on the room; banner uses inviter handle
    hostId: String(match?.host_id || sender?.id || sender?.userId || ''),
    hostHandle: senderHandle,
    inviterHandle: senderHandle,
    recipientId: String(recipient?.id || ''),
    recipientHandle: normalizeInviteHandle(recipient?.handle),
    sport: String(match?.sport || 'LIVE').toUpperCase(),
    teamA: String(match?.team_a_name || 'TEAM A'),
    teamB: String(match?.team_b_name || 'TEAM B'),
    hasScoreboard: match?.has_scoreboard !== false,
    at,
    expiresAt: at + INVITE_TTL_MS,
  };
}

/**
 * Targeted invites only — per-recipient Realtime channel (never global fanout).
 * `host` / `sender` = whoever is inviting (host or viewer); scoring stays canScore-gated.
 */
export async function sendLiveMatchInvites({
  match,
  host,
  sender,
  recipients = [],
} = {}) {
  const inviter = sender || host;
  const list = (Array.isArray(recipients) ? recipients : []).filter(
    (r) => r && (r.id || r.handle)
  );
  if (!match?.id || list.length === 0) {
    return { ok: false, reason: 'no-recipients', sent: 0 };
  }

  const payloads = list.map((recipient) =>
    buildInvitePayload(match, inviter, recipient)
  );

  // Soft DB insert (best-effort; never blocks broadcast)
  if (isSupabaseConfigured() && !isTableDisabled(INVITES_TABLE)) {
    try {
      const rows = payloads.map((p) => ({
        match_id: p.matchId,
        host_id: p.hostId,
        host_handle: p.inviterHandle || p.hostHandle,
        recipient_id: p.recipientId || null,
        recipient_handle: p.recipientHandle || null,
        sport: p.sport,
        team_a_name: p.teamA,
        team_b_name: p.teamB,
        expires_at: new Date(p.expiresAt).toISOString(),
      }));
      const { error } = await supabase.from(INVITES_TABLE).insert(rows);
      if (error) {
        if (isMissingRelationError(error)) {
          markTableMissing(INVITES_TABLE, 'liveInvite', error.message || error);
        } else {
          softFailWarn(
            'liveInvite:insert',
            '[liveInvite] insert soft-fail',
            error
          );
        }
      }
    } catch (err) {
      softFailWarn(
        'liveInvite:insertEx',
        '[liveInvite] insert exception',
        err?.message
      );
    }
  }

  let sent = 0;
  for (const payload of payloads) {
    const channelName = userInviteChannelName(
      payload.recipientId,
      payload.recipientHandle
    );
    if (!channelName) continue;

    // Local same-runtime delivery (filtered per subscribed user — never global spam)
    deliverLocalInvite(payload);

    if (isSupabaseConfigured()) {
      try {
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: true } },
        });
        await new Promise((resolve) => {
          channel.subscribe((status) => {
            if (
              status === 'SUBSCRIBED' ||
              status === 'CHANNEL_ERROR' ||
              status === 'TIMED_OUT'
            ) {
              resolve(status);
            }
          });
        });
        await channel.send({
          type: 'broadcast',
          event: 'live_invite',
          payload,
        });
        try {
          supabase.removeChannel(channel);
        } catch (_) {
          /* ignore */
        }
        sent += 1;
      } catch (err) {
        softFailWarn(
          'liveInvite:send',
          '[liveInvite] targeted send soft-fail',
          err?.message
        );
        sent += 1; // local listeners still notified
      }
    } else {
      sent += 1;
    }
  }

  return { ok: true, sent, invites: payloads };
}

/** @type {Set<{ user: object, onInvite: Function }>} */
const inviteListeners = new Set();

function inviteIsForUser(payload, user) {
  if (!payload?.matchId || !user) return false;
  const now = Date.now();
  if (payload.expiresAt && now > Number(payload.expiresAt)) return false;
  const toId = String(payload.recipientId || '').trim();
  const toHandle = normalizeInviteHandle(payload.recipientHandle);
  const myId = String(user?.id || user?.userId || '').trim();
  const myHandle = normalizeInviteHandle(user?.handle || user?.username);
  return (
    (toId && myId && toId === myId) ||
    (toHandle && myHandle && toHandle === myHandle)
  );
}

function deliverLocalInvite(payload) {
  inviteListeners.forEach((entry) => {
    if (!inviteIsForUser(payload, entry.user)) return;
    try {
      entry.onInvite?.(payload);
    } catch (_) {
      /* ignore */
    }
  });
}

/**
 * Subscribe to invites addressed to the current user only.
 * @returns {() => void}
 */
export function subscribeLiveMatchInvites(user, onInvite) {
  const entry = {
    user: user || {},
    onInvite: typeof onInvite === 'function' ? onInvite : () => {},
  };
  inviteListeners.add(entry);

  const channels = [];
  const id = String(user?.id || user?.userId || '').trim();
  const handle = normalizeInviteHandle(user?.handle || user?.username);
  const names = [
    userInviteChannelName(id, ''),
    userInviteChannelName('', handle),
  ].filter(Boolean);

  if (isSupabaseConfigured()) {
    names.forEach((name) => {
      try {
        const channel = supabase.channel(name, {
          config: { broadcast: { self: true } },
        });
        channel.on('broadcast', { event: 'live_invite' }, (msg) => {
          const payload = msg?.payload || {};
          if (!inviteIsForUser(payload, user)) return;
          try {
            onInvite?.(payload);
          } catch (_) {
            /* ignore */
          }
        });
        channel.subscribe();
        channels.push(channel);
      } catch (err) {
        softFailWarn(
          'liveInvite:sub',
          '[liveInvite] subscribe soft-fail',
          err?.message
        );
      }
    });
  }

  return () => {
    inviteListeners.delete(entry);
    channels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {
        /* ignore */
      }
    });
  };
}

function isMissingRpcError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(
    error.message || error.details || error.hint || error || ''
  );
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /Could not find the function|function .* does not exist|schema cache/i.test(
      msg
    )
  );
}

export async function fetchLiveMatchByInviteCode(code) {
  const raw = sanitizeInviteCode(
    String(code || '').replace(/^BAWAAL-?LIVE-?/i, '')
  );
  if (raw.length !== 6) return null;

  const localHit = getLocalLiveList().find(
    (m) => sanitizeInviteCode(m.invite_code) === raw
  );
  if (localHit) return localHit;

  if (shouldUseLocalOnly()) return null;

  // Prefer SECURITY DEFINER RPC so private matches stay off the public SELECT list
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_live_match_by_invite_code',
      { p_code: raw }
    );
    if (!rpcError) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const m = normalizeMatch(row);
      if (m) {
        localMatches.set(m.id, m);
        return m;
      }
      return null;
    }
    if (!isMissingRpcError(rpcError)) {
      softFailWarn(
        'liveMatch:inviteRpc',
        '[liveMatch] invite RPC soft-fail',
        rpcError?.message || rpcError
      );
    }
  } catch (err) {
    softFailWarn(
      'liveMatch:inviteRpcEx',
      '[liveMatch] invite RPC exception',
      err?.message
    );
  }

  // Fallback: direct table lookup (pre-harden DBs) then local list scan
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'live')
      .eq('invite_code', raw)
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        const list = await listLiveMatches();
        return (
          list.find((m) => sanitizeInviteCode(m.invite_code) === raw) || null
        );
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
 * Mint a LiveKit access token via Supabase Edge Function `livekit-token`.
 * Soft-fails (returns null) when EXPO_PUBLIC_LIVEKIT_URL / secrets / function
 * are not configured yet — never throws into LIVE UX.
 *
 * @param {{
 *   roomName?: string,
 *   matchId?: string,
 *   participantName: string,
 *   isHost?: boolean,
 *   role?: 'host'|'viewer',
 *   inviteCode?: string,
 * }} input
 * @returns {Promise<{ token: string, url: string, wsUrl: string }|null>}
 */
export async function fetchLiveKitToken({
  roomName,
  matchId,
  participantName,
  isHost,
  role,
  inviteCode,
} = {}) {
  const id = String(roomName || matchId || '').trim();
  const name = String(participantName || '')
    .trim()
    .replace(/^@/, '')
    .slice(0, 64);
  const host =
    isHost === true || String(role || '').toLowerCase() === 'host';
  const code = String(inviteCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const publicWsUrl = String(
    process.env.EXPO_PUBLIC_LIVEKIT_URL || ''
  ).trim();

  if (!id || !name) return null;
  if (!publicWsUrl) return null;
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: {
        roomName: id,
        matchId: id,
        participantName: name,
        isHost: host,
        role: host ? 'host' : 'viewer',
        ...(code ? { inviteCode: code } : null),
      },
    });
    if (error) {
      softFailWarn(
        'liveMatch:livekitToken',
        '[liveMatch] livekit-token soft-fail',
        error?.message || error
      );
      return null;
    }
    const token = String(data?.token || '').trim();
    const url = String(data?.url || data?.wsUrl || publicWsUrl).trim();
    if (!token || !url) return null;
    return { token, url, wsUrl: url };
  } catch (err) {
    softFailWarn(
      'liveMatch:livekitTokenEx',
      '[liveMatch] livekit-token exception',
      err?.message || err
    );
    return null;
  }
}

export { BANTER_CAP, channelName as liveMatchChannelName, INVITE_TTL_MS };
