/**
 * Arena OPEN challenges — Supabase `arena_challenges` + Storage opener upload.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  uploadVideoToSupabase,
} from './uploadService';
import { resolvePostSport } from '../utils/sportCategory';
import { newBattleId } from './battleSyncService';

export const ARENA_CHALLENGES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_ARENA_CHALLENGES.sql';

const TABLE = 'arena_challenges';

function resolveHost(overrides = {}) {
  const user = getActiveUser?.() || {};
  const handleRaw = String(
    overrides.hostUsername || overrides.host || user.handle || '@YOU'
  ).trim();
  const handle = handleRaw
    ? handleRaw.startsWith('@')
      ? handleRaw
      : `@${handleRaw.replace(/^@/, '')}`
    : '@YOU';
  return {
    userId: String(overrides.hostId || user.userId || user.id || 'host-local'),
    handle,
    flag: overrides.hostFlag || user.flag || '🇮🇳',
  };
}

function mapRowToCard(row, extras = {}) {
  if (!row) return null;
  const ts = row.created_at
    ? Date.parse(row.created_at) || Date.now()
    : Number(extras.createdAt) || Date.now();
  const sport = resolvePostSport(
    { sport: row.sport, category: row.sport },
    'COMBAT'
  );
  const host = row.host_username
    ? String(row.host_username).startsWith('@')
      ? String(row.host_username)
      : `@${String(row.host_username).replace(/^@/, '')}`
    : '@YOU';
  const opener =
    ensurePublicBawaalVideoUrl(row.opener_video_url) ||
    row.opener_video_url ||
    extras.localOpenerUri ||
    null;
  const id = String(row.id);
  const target = String(row.target_title || 'OPEN CHALLENGE');
  return {
    id,
    challengeId: id,
    battleId: id,
    type: 'battle_thread',
    isOpenChallenge: true,
    isBattle: true,
    status: String(row.status || 'OPEN').toUpperCase() === 'OPEN' ? 'OPEN' : row.status,
    sport,
    category: sport,
    target,
    title: target,
    targetDetails: row.target_details || extras.targetDetails || null,
    host,
    opponent: host,
    author: 'CHALLENGE',
    challengerLabel: '@YOU',
    leaderLabel: 'OPEN',
    challengeVideoUri: opener,
    openerVideoUri: opener,
    videoUri: opener,
    uri: opener,
    localVideoUri: extras.localOpenerUri || null,
    publicCloudUrl: isRemoteHttpsUri(opener) ? opener : null,
    responses: [],
    responseCount: Number(row.response_count) || 0,
    timestamp: ts,
    createdAt: ts,
    feedTarget: 'ARENA',
    source: 'ARENA_CHALLENGE',
    _freshPublish: !!extras._freshPublish,
    ...extras,
  };
}

/**
 * Upload opener (if local) + insert OPEN row into `arena_challenges`.
 * Soft-falls back to a local feed card when cloud is offline / table missing.
 */
export async function publishArenaChallenge({
  id,
  sport = 'COMBAT',
  targetTitle,
  targetDetails = null,
  openerVideoUri = null,
  hostId,
  hostUsername,
  hostFlag,
  onUploadProgress,
} = {}) {
  const challengeId = id || newBattleId();
  const host = resolveHost({ hostId, hostUsername, hostFlag });
  const title = String(targetTitle || '').trim() || 'OPEN CHALLENGE';
  const details =
    targetDetails != null && String(targetDetails).trim()
      ? String(targetDetails).trim()
      : null;
  const category = resolvePostSport({ sport, category: sport }, 'COMBAT');
  const localOpener =
    typeof openerVideoUri === 'string' && openerVideoUri.trim()
      ? openerVideoUri.trim()
      : null;

  let publicOpenerUrl = null;
  if (localOpener) {
    if (isRemoteHttpsUri(localOpener)) {
      publicOpenerUrl = ensurePublicBawaalVideoUrl(localOpener) || localOpener;
    } else {
      try {
        const uploaded = await uploadVideoToSupabase(
          localOpener,
          `arena-opener-${challengeId}.mp4`,
          { onProgress: onUploadProgress }
        );
        publicOpenerUrl = uploaded
          ? ensurePublicBawaalVideoUrl(uploaded) || uploaded
          : null;
      } catch (err) {
        console.warn(
          '[arenaChallenge] opener upload failed:',
          err?.message || err
        );
      }
    }
  }

  const localRow = {
    id: challengeId,
    host_id: host.userId,
    host_username: host.handle,
    host_flag: host.flag,
    sport: category,
    target_title: title,
    target_details: details,
    opener_video_url: publicOpenerUrl || null,
    status: 'OPEN',
    response_count: 0,
    created_at: new Date().toISOString(),
  };

  const cardExtras = {
    localOpenerUri: localOpener,
    targetDetails: details,
    _freshPublish: true,
  };

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      skipped: true,
      reason: 'not-configured',
      challengeId,
      card: mapRowToCard(localRow, {
        ...cardExtras,
        // Prefer local file for instant playback when cloud is offline
        localOpenerUri: localOpener,
      }),
      localOnly: true,
    };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(localRow, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return {
      ok: true,
      challengeId,
      row: data,
      card: mapRowToCard(data || localRow, cardExtras),
    };
  } catch (error) {
    const msg = String(error?.message || error);
    console.warn('[arenaChallenge] insert soft-fallback:', msg);
    return {
      ok: true,
      softFallback: true,
      error: msg,
      challengeId,
      card: mapRowToCard(localRow, cardExtras),
      localOnly: true,
      setupHint: ARENA_CHALLENGES_SETUP_HINT,
    };
  }
}

export function mapArenaChallengeRowToCard(row) {
  return mapRowToCard(row);
}

export default {
  publishArenaChallenge,
  mapArenaChallengeRowToCard,
  ARENA_CHALLENGES_SETUP_HINT,
};
