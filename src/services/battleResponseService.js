import {
  persistLocalVideoUri,
  uploadBattleVideo,
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
} from './uploadService';
import { isCloudAuthError, isSupabaseConfigured, supabase } from './supabase';
import { resolvePostSport } from '../utils/sportCategory';

const FALLBACK_BATTLE_ID = '123e4567-e89b-12d3-a456-426614174000';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveBattleUserId(explicitId = null) {
  const fromExplicit =
    typeof explicitId === 'string' && UUID_RE.test(explicitId.trim())
      ? explicitId.trim()
      : null;
  if (fromExplicit) return fromExplicit;
  try {
    const { data } = await supabase.auth.getUser();
    const id = data?.user?.id;
    return typeof id === 'string' && UUID_RE.test(id) ? id : null;
  } catch (_) {
    return null;
  }
}

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

function asUuidOrNull(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(s) ? s : null;
}

/**
 * Insert a `videos` row with public Storage URL + required FK fields.
 * Soft-fails — never blocks Arena handoff.
 */
async function insertVideosRowFromBattle(publicUrl, details = {}) {
  if (!publicUrl || !/^https:\/\//i.test(String(publicUrl))) return null;

  const userId = await resolveBattleUserId(
    details.user_id || details.userId || details.responderId
  );
  const sport = resolvePostSport(
    {
      category: details.sport_category || details.category || details.sport,
      sport: details.sport_category || details.sport || details.category,
    },
    'GYM'
  );
  const caption =
    String(details.caption || details.target || 'Battle response').trim() ||
    'Battle response';

  const row = {
    video_url: publicUrl,
    caption,
    category: sport,
    created_at: new Date().toISOString(),
  };
  if (userId) row.user_id = userId;

  try {
    let { error } = await supabase.from('videos').insert(row);
    if (
      error &&
      row.user_id &&
      /user_id|foreign key|violates|23503|42501|RLS/i.test(
        String(error.message || error.code || '')
      )
    ) {
      const { user_id: _omit, ...withoutUser } = row;
      ({ error } = await supabase.from('videos').insert(withoutUser));
    }
    if (error) {
      console.warn(
        '[battle] videos insert soft-fail:',
        error.message || error.code
      );
      return null;
    }
    console.log('[battle] videos row inserted', publicUrl);
    return row;
  } catch (err) {
    console.warn('[battle] videos insert threw:', err?.message || err);
    return null;
  }
}

/**
 * Upload local battle video + insert `videos` / `battle_responses`.
 * Accepts local file:// OR an already-public HTTPS Storage URL.
 * Always returns a usable localUri / publicCloudUrl for Arena when possible.
 */
export async function postBattleResponseToSupabase(
  localVideoUri,
  challengeDetails = {}
) {
  const isMock =
    typeof localVideoUri === 'string' &&
    localVideoUri.startsWith('emulator-mock://');

  if (isMock) {
    return localOnlyResult(localVideoUri, 'mock-clip');
  }

  // Already a public Storage URL — skip re-upload
  let publicUrl = null;
  let stableLocalUri = localVideoUri;

  if (isRemoteHttpsUri(localVideoUri)) {
    publicUrl =
      ensurePublicBawaalVideoUrl(localVideoUri) || localVideoUri;
  } else {
    try {
      stableLocalUri = await persistLocalVideoUri(localVideoUri);
    } catch (err) {
      return localOnlyResult(localVideoUri, 'missing-local-file', err);
    }

    // uploadBattleVideo never throws for Storage/JWS — returns local fallback
    const upload = await uploadBattleVideo(stableLocalUri);
    stableLocalUri = upload.localUri || stableLocalUri;

    if (upload.skipped || !upload.publicUrl) {
      return localOnlyResult(
        stableLocalUri,
        upload.reason || 'not-configured',
        upload.error
      );
    }
    publicUrl =
      ensurePublicBawaalVideoUrl(upload.publicUrl) || upload.publicUrl;
  }

  if (!isSupabaseConfigured()) {
    return {
      publicCloudUrl: publicUrl,
      data: null,
      skipped: false,
      localUri: stableLocalUri,
    };
  }

  try {
    let responderId =
      asUuidOrNull(challengeDetails.responderId) ||
      asUuidOrNull(challengeDetails.user_id) ||
      asUuidOrNull(challengeDetails.userId) ||
      null;
    if (!responderId) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        responderId = asUuidOrNull(userData?.user?.id) || null;
      } catch (_) {
        responderId = null;
      }
    }

    // Preferred: canonical `videos` row (user_id, category, caption, video_url)
    await insertVideosRowFromBattle(publicUrl, {
      ...challengeDetails,
      user_id: responderId || challengeDetails.user_id,
      responderId,
    });

    const slowMoStart =
      challengeDetails.slowMoStart ||
      formatClockStamp(challengeDetails.slowMoStartSec ?? 0);
    const slowMoEnd =
      challengeDetails.slowMoEnd ||
      formatClockStamp(challengeDetails.slowMoEndSec ?? 15);
    const slowMoSpeed =
      challengeDetails.slowMoSpeed ||
      (challengeDetails.slowMoRate != null
        ? `${challengeDetails.slowMoRate}x`
        : '1x');

    const battleId =
      asUuidOrNull(challengeDetails.battleId) || FALLBACK_BATTLE_ID;

    const insertPayload = {
      battle_id: battleId,
      video_url: publicUrl,
      slow_mo_start: slowMoStart,
      slow_mo_end: slowMoEnd,
      slow_mo_speed: slowMoSpeed,
    };
    if (responderId) insertPayload.responder_id = responderId;

    const { data, error } = await supabase
      .from('battle_responses')
      .insert([insertPayload])
      .select();

    if (error) {
      if (isCloudAuthError(error)) {
        console.warn(
          '[battle] Insert auth error — Arena still gets cloud/local URL:',
          error.message
        );
        return {
          publicCloudUrl: publicUrl,
          data: null,
          skipped: false,
          localUri: stableLocalUri,
          warning: error.message,
        };
      }
      // DB insert failed but file uploaded — still return URL; Arena uses it
      console.warn(
        '[battle] Insert failed — returning uploaded URL:',
        error.message
      );
      return {
        publicCloudUrl: publicUrl,
        data: null,
        skipped: false,
        localUri: stableLocalUri,
        warning: error.message,
      };
    }

    console.log('Successfully posted battle response to Arena!');
    return {
      publicCloudUrl: publicUrl,
      data,
      skipped: false,
      localUri: stableLocalUri,
    };
  } catch (err) {
    console.warn(
      '[battle] Post-insert error — returning upload result:',
      err?.message || err
    );
    return {
      publicCloudUrl: publicUrl,
      data: null,
      skipped: false,
      localUri: stableLocalUri,
      warning: String(err?.message || err),
    };
  }
}
