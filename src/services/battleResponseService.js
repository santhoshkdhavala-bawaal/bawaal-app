import { persistLocalVideoUri, uploadBattleVideo } from './uploadService';
import { isSupabaseConfigured, supabase } from './supabase';

const FALLBACK_BATTLE_ID = '123e4567-e89b-12d3-a456-426614174000';

function formatClockStamp(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Upload local battle video + insert a `battle_responses` row.
 * Returns `{ publicCloudUrl, data, skipped, localUri }` — skipped when mock / unconfigured / missing file.
 */
export async function postBattleResponseToSupabase(localVideoUri, challengeDetails = {}) {
  const isMock =
    typeof localVideoUri === 'string' && localVideoUri.startsWith('emulator-mock://');

  if (isMock) {
    return {
      publicCloudUrl: null,
      data: null,
      skipped: true,
      reason: 'mock-clip',
      localUri: localVideoUri,
    };
  }

  let stableLocalUri = localVideoUri;
  try {
    stableLocalUri = await persistLocalVideoUri(localVideoUri);
  } catch (err) {
    console.warn(
      '[battle] local video verify failed — continuing with Arena mock/local preview:',
      err?.message || err
    );
    return {
      publicCloudUrl: null,
      data: null,
      skipped: true,
      reason: 'missing-local-file',
      localUri: localVideoUri,
      error: err?.message || String(err),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      publicCloudUrl: null,
      data: null,
      skipped: true,
      reason: 'not-configured',
      localUri: stableLocalUri,
    };
  }

  console.log('Uploading battle video to cloud...');
  const publicCloudUrl = await uploadBattleVideo(stableLocalUri);

  let responderId = challengeDetails.responderId || null;
  if (!responderId) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      responderId = userData?.user?.id || null;
    } catch (_) {
      responderId = null;
    }
  }

  const slowMoStart =
    challengeDetails.slowMoStart ||
    formatClockStamp(challengeDetails.slowMoStartSec ?? 0);
  const slowMoEnd =
    challengeDetails.slowMoEnd ||
    formatClockStamp(challengeDetails.slowMoEndSec ?? 15);
  const slowMoSpeed =
    challengeDetails.slowMoSpeed ||
    (challengeDetails.slowMoRate != null ? `${challengeDetails.slowMoRate}x` : '1x');

  const { data, error } = await supabase
    .from('battle_responses')
    .insert([
      {
        battle_id: challengeDetails.battleId || FALLBACK_BATTLE_ID,
        responder_id: responderId,
        video_url: publicCloudUrl,
        slow_mo_start: slowMoStart,
        slow_mo_end: slowMoEnd,
        slow_mo_speed: slowMoSpeed,
      },
    ])
    .select();

  if (error) throw error;

  console.log('Successfully posted battle response to Arena!');
  return { publicCloudUrl, data, skipped: false, localUri: stableLocalUri };
}
