/**
 * Arena dashboard shelves — war_cry_matches / sparks_josh_clips /
 * battle_bawaal_reels / face_off_challenges.
 *
 * Soft-fails when tables are missing or empty (local-dev / cold start).
 * Never throws into Arena UX — returns clean mock seeds instead.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { softFailWarn } from '../utils/softFailLog';
import {
  BAWAAL_BACKEND_SETUP_HINT,
  isTableDisabled,
  softSelect as softSelectShared,
} from '../utils/supabaseSoftFail';

export const ARENA_DASHBOARD_SETUP_HINT = BAWAAL_BACKEND_SETUP_HINT;

const TABLES = Object.freeze({
  warCry: 'war_cry_matches',
  sparks: 'sparks_josh_clips',
  battle: 'battle_bawaal_reels',
  faceOff: 'face_off_challenges',
});

/** Clean local seeds — never crash shelves on cold start / empty tables. */
export const MOCK_WAR_CRY_MATCH = Object.freeze({
  id: 'mock-war-cry-live',
  status: 'LIVE',
  sport: 'COMBAT',
  host_handle: '@blade_a',
  rival_handle: '@storm_b',
  host_score: 12,
  rival_score: 9,
  spectator_count: 128,
  room_id: 'war-cry-mock',
  title: 'WAR CRY · LIVE',
  thumbnail_url: null,
  _mock: true,
});

export const MOCK_SPARKS_JOSH = Object.freeze([
  {
    id: 'mock-spark-1',
    title: 'SPARK · WARMUP',
    sport: 'GYM',
    mode: 'SPARK',
    author: '@spark_01',
    video_url: null,
    thumbnail_url: null,
    type: 'reel',
    _mock: true,
  },
  {
    id: 'mock-josh-1',
    title: 'JOSH · HIGHLIGHT',
    sport: 'FOOTBALL',
    mode: 'JOSH',
    author: '@josh_01',
    video_url: null,
    thumbnail_url: null,
    type: 'reel',
    _mock: true,
  },
  {
    id: 'mock-spark-2',
    title: 'SPARK · CLIP',
    sport: 'COMBAT',
    mode: 'SPARK',
    author: '@spark_02',
    video_url: null,
    thumbnail_url: null,
    type: 'reel',
    _mock: true,
  },
  {
    id: 'mock-josh-2',
    title: 'JOSH · DROP',
    sport: 'CRICKET',
    mode: 'JOSH',
    author: '@josh_02',
    video_url: null,
    thumbnail_url: null,
    type: 'reel',
    _mock: true,
  },
]);

export const MOCK_BATTLE_BAWAAL = Object.freeze([
  {
    id: 'mock-battle-1',
    title: 'BATTLE BAWAAL · SQUAD',
    sport: 'COMBAT',
    author: '@squad_a',
    video_url: null,
    thumbnail_url: null,
    type: 'battle_thread',
    mode: 'BAWAAL BATTLE',
    _mock: true,
  },
  {
    id: 'mock-battle-2',
    title: 'BATTLE BAWAAL · CREW',
    sport: 'GYM',
    author: '@crew_b',
    video_url: null,
    thumbnail_url: null,
    type: 'battle_thread',
    mode: 'BAWAAL BATTLE',
    _mock: true,
  },
  {
    id: 'mock-battle-3',
    title: 'BATTLE BAWAAL · PACK',
    sport: 'FOOTBALL',
    author: '@pack_c',
    video_url: null,
    thumbnail_url: null,
    type: 'battle_thread',
    mode: 'BAWAAL BATTLE',
    _mock: true,
  },
  {
    id: 'mock-battle-4',
    title: 'BATTLE BAWAAL · UNIT',
    sport: 'KABADDI',
    author: '@unit_d',
    video_url: null,
    thumbnail_url: null,
    type: 'battle_thread',
    mode: 'BAWAAL BATTLE',
    _mock: true,
  },
]);

export const MOCK_FACE_OFF = Object.freeze([
  {
    id: 'mock-faceoff-1',
    title: 'FACE OFF · OPEN',
    sport: 'COMBAT',
    author: '@challenger_a',
    status: 'OPEN',
    video_url: null,
    thumbnail_url: null,
    type: 'faceoff',
    isOpenChallenge: true,
    _mock: true,
  },
  {
    id: 'mock-faceoff-2',
    title: 'FACE OFF · CALL',
    sport: 'GYM',
    author: '@challenger_b',
    status: 'OPEN',
    video_url: null,
    thumbnail_url: null,
    type: 'faceoff',
    isOpenChallenge: true,
    _mock: true,
  },
  {
    id: 'mock-faceoff-3',
    title: 'FACE OFF · DARE',
    sport: 'FOOTBALL',
    author: '@challenger_c',
    status: 'OPEN',
    video_url: null,
    thumbnail_url: null,
    type: 'faceoff',
    isOpenChallenge: true,
    _mock: true,
  },
]);

function mapClipRow(row, defaults = {}) {
  if (!row) return null;
  const id = String(row.id || '');
  if (!id) return null;
  return {
    id,
    title: row.title || defaults.title || 'CLIP',
    caption: row.title || defaults.title || 'CLIP',
    sport: row.sport || defaults.sport || 'ARENA',
    category: row.sport || defaults.sport || 'ARENA',
    mode: row.mode || defaults.mode || 'SPARK',
    author: row.author || defaults.author || '@athlete',
    video_url: row.video_url || null,
    videoUri: row.video_url || null,
    uri: row.video_url || null,
    thumbnail_url: row.thumbnail_url || null,
    type: defaults.type || 'reel',
    status: row.status || defaults.status || null,
    isOpenChallenge: defaults.isOpenChallenge === true,
    participant_count: Number(row.participant_count) || 0,
    _fromDashboard: true,
    _mock: false,
  };
}

function mapWarCryRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status || 'LIVE').toUpperCase(),
    sport: row.sport || 'COMBAT',
    host_handle: row.host_handle || '@host',
    rival_handle: row.rival_handle || '@rival',
    host_score: Number(row.host_score) || 0,
    rival_score: Number(row.rival_score) || 0,
    spectator_count: Number(row.spectator_count) || 0,
    room_id: row.room_id || String(row.id),
    title: row.title || 'WAR CRY · LIVE',
    thumbnail_url: row.thumbnail_url || null,
    _fromDashboard: true,
    _mock: false,
  };
}

/**
 * Soft select from a dashboard table. Returns [] on missing table / error.
 * @param {string} table
 * @param {string} select
 * @param {(q: any) => any} [build]
 */
async function softSelect(table, select, build) {
  if (!isSupabaseConfigured() || isTableDisabled(table)) {
    return [];
  }
  return softSelectShared(
    supabase,
    table,
    select,
    build,
    'arenaDashboard'
  );
}

export async function fetchWarCryMatches(limit = 4) {
  const rows = await softSelect(
    TABLES.warCry,
    'id, status, sport, host_handle, rival_handle, host_score, rival_score, spectator_count, room_id, title, thumbnail_url, updated_at, created_at',
    (q) =>
      q
        .order('updated_at', { ascending: false })
        .limit(Math.max(1, limit))
  );
  const mapped = rows.map(mapWarCryRow).filter(Boolean);
  if (mapped.length) return mapped;
  return [{ ...MOCK_WAR_CRY_MATCH }];
}

export async function fetchSparksJoshClips(limit = 16) {
  const rows = await softSelect(
    TABLES.sparks,
    'id, title, sport, mode, author, video_url, thumbnail_url, created_at',
    (q) => q.order('created_at', { ascending: false }).limit(Math.max(1, limit))
  );
  const mapped = rows
    .map((r) =>
      mapClipRow(r, {
        title: 'SPARK',
        sport: 'ARENA',
        mode: String(r.mode || 'SPARK').toUpperCase().includes('JOSH')
          ? 'JOSH'
          : 'SPARK',
        type: 'reel',
      })
    )
    .filter(Boolean);
  if (mapped.length) return mapped;
  return MOCK_SPARKS_JOSH.map((m) => ({ ...m }));
}

export async function fetchBattleBawaalReels(limit = 16) {
  const rows = await softSelect(
    TABLES.battle,
    'id, title, sport, author, video_url, thumbnail_url, participant_count, created_at',
    (q) => q.order('created_at', { ascending: false }).limit(Math.max(1, limit))
  );
  const mapped = rows
    .map((r) =>
      mapClipRow(r, {
        title: 'BATTLE BAWAAL',
        sport: 'COMBAT',
        mode: 'BAWAAL BATTLE',
        type: 'battle_thread',
      })
    )
    .filter(Boolean);
  if (mapped.length) return mapped;
  return MOCK_BATTLE_BAWAAL.map((m) => ({ ...m }));
}

export async function fetchFaceOffChallenges(limit = 16) {
  const rows = await softSelect(
    TABLES.faceOff,
    'id, title, sport, author, status, video_url, thumbnail_url, created_at',
    (q) => q.order('created_at', { ascending: false }).limit(Math.max(1, limit))
  );
  const mapped = rows
    .map((r) =>
      mapClipRow(r, {
        title: 'FACE OFF',
        sport: 'ARENA',
        mode: 'FACEOFF',
        type: 'faceoff',
        status: r.status || 'OPEN',
        isOpenChallenge: true,
      })
    )
    .filter(Boolean);
  if (mapped.length) return mapped;
  return MOCK_FACE_OFF.map((m) => ({ ...m }));
}

/**
 * Hydrate all Arena dashboard sections in parallel.
 * Always resolves — never throws.
 */
export async function fetchArenaDashboardSections() {
  try {
    const [warCryMatches, sparksJosh, battleBawaal, faceOff] =
      await Promise.all([
        fetchWarCryMatches(4),
        fetchSparksJoshClips(16),
        fetchBattleBawaalReels(16),
        fetchFaceOffChallenges(16),
      ]);
    return {
      warCryMatches: warCryMatches || [{ ...MOCK_WAR_CRY_MATCH }],
      sparksJosh: sparksJosh || MOCK_SPARKS_JOSH.map((m) => ({ ...m })),
      battleBawaal: battleBawaal || MOCK_BATTLE_BAWAAL.map((m) => ({ ...m })),
      faceOff: faceOff || MOCK_FACE_OFF.map((m) => ({ ...m })),
      fromMock:
        (warCryMatches?.[0]?._mock === true) ||
        (sparksJosh?.[0]?._mock === true),
    };
  } catch (err) {
    softFailWarn(
      'arenaDashboard:hydrate',
      '[arenaDashboard] hydrate soft-fail — full mock pack',
      err?.message || err
    );
    return {
      warCryMatches: [{ ...MOCK_WAR_CRY_MATCH }],
      sparksJosh: MOCK_SPARKS_JOSH.map((m) => ({ ...m })),
      battleBawaal: MOCK_BATTLE_BAWAAL.map((m) => ({ ...m })),
      faceOff: MOCK_FACE_OFF.map((m) => ({ ...m })),
      fromMock: true,
    };
  }
}

export const ARENA_DASHBOARD_TABLES = TABLES;
