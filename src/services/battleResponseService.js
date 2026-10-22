import { persistLocalVideoUri, uploadBattleVideo } from './uploadService';
import { isCloudAuthError, isSupabaseConfigured, supabase } from './supabase';

const FALLBACK_BATTLE_ID = '123e4567-e89b-12d3-a456-426614174000';

function formatClockStamp(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function localOnlyResult(localUri, reason, error) {
  return {
    publicCloudUrl: null,
    data: null,
    skipped: true,
    reason,
    localUri,
    error: error ? String(error?.message || error) : undefined,
  };
}

/**
 * Upload local battle video + insert a `battle_responses` row.
 * Always returns a usable localUri for Arena when cloud is unavailable.
 */
export async function postBattleResponseToSupabase(localVideoUri, challengeDetails = {}) {
  const isMock =
    typeof localVideoUri === 'string' && localVideoUri.startsWith('emulator-mock://');

  if (isMock) {
    return localOnlyResult(localVideoUri, 'mock-clip');
  }

  let stableLocalUri = localVideoUri;
  try {
    stableLocalUri = await persistLocalVideoUri(localVideoUri);
  } catch (err) {
    return localOnlyResult(localVideoUri, 'missing-local-file', err);
  }

  // uploadBattleVideo never throws for Storage/JWS — returns local fallback
  const upload = await uploadBattleVideo(stableLocalUri);
  stableLocalUri = upload.localUri || stableLocalUri;

  if (upload.skipped || !upload.publicUrl) {
    return localOnlyResult(stableLocalUri, upload.reason || 'not-configured', upload.error);
  }

  if (!isSupabaseConfigured()) {
    return {
      publicCloudUrl: upload.publicUrl,
      data: null,
      skipped: false,
      localUri: stableLocalUri,
    };
  }

  try {
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
          video_url: upload.publicUrl,
          slow_mo_start: slowMoStart,
          slow_mo_end: slowMoEnd,
          slow_mo_speed: slowMoSpeed,
        },
      ])
      .select();

    if (error) {
      if (isCloudAuthError(error)) {
        console.warn('[battle] Insert auth error — Arena still gets cloud/local URL:', error.message);
        return {
          publicCloudUrl: upload.publicUrl,
          data: null,
          skipped: false,
          localUri: stableLocalUri,
          warning: error.message,
        };
      }
      // DB insert failed but file uploaded — still return URL; Arena uses it
      console.warn('[battle] Insert failed — returning uploaded URL:', error.message);
      return {
        publicCloudUrl: upload.publicUrl,
        data: null,
        skipped: false,
        localUri: stableLocalUri,
        warning: error.message,
      };
    }

    console.log('Successfully posted battle response to Arena!');
    return {
      publicCloudUrl: upload.publicUrl,
      data,
      skipped: false,
      localUri: stableLocalUri,
    };
  } catch (err) {
    console.warn('[battle] Post-insert error — returning upload result:', err?.message || err);
    return {
      publicCloudUrl: upload.publicUrl,
      data: null,
      skipped: false,
      localUri: stableLocalUri,
      warning: String(err?.message || err),
    };
  }
}
