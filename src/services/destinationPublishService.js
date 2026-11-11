/**
 * PostDestinationSelector → Supabase publish routes.
 * - dark_arena / pro_faceoff → public.challenges
 * - response to existing challenge → public.challenge_responses
 * - reel / story / group_battle → standard Arena post storage
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { getActiveUser } from './activeUserProfile';
import { uploadVideoToSupabase } from '../../services/videoUpload';
import { publishRecordedClipToArena } from './recordToPostService';
import { pushHotFeatureBattle } from '../../battlesFeedStore';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(s) ? s : null;
}

/**
 * Resolve logged-in auth user id (prefer UUID for FK columns).
 */
export async function resolveAuthUserId(explicitId = null) {
  const fromExplicit = asUuidOrNull(explicitId);
  if (fromExplicit) return fromExplicit;
  try {
    const { data } = await supabase.auth.getUser();
    return asUuidOrNull(data?.user?.id) || null;
  } catch {
    return null;
  }
}

function profileLooksPro(profile, authUser) {
  const meta = authUser?.user_metadata || authUser?.app_metadata || {};
  const role = String(
    profile?.role || meta.role || getActiveUser()?.role || ''
  ).toLowerCase();
  const status = String(
    profile?.status_badge || profile?.statusBadge || meta.status_badge || ''
  ).toLowerCase();
  const tier = String(profile?.tier || meta.tier || meta.plan || '').toLowerCase();

  if (
    profile?.is_pro === true ||
    profile?.isPro === true ||
    meta.is_pro === true ||
    meta.isPro === true ||
    meta.pro === true
  ) {
    return true;
  }
  if (profile?.verified === true && /pro|coach|gladiator/.test(role)) {
    return true;
  }
  if (/^pro$|pro_athlete|verified_pro|gladiator/.test(role)) return true;
  if (/pro/.test(status) || /pro/.test(tier)) return true;
  return false;
}

/**
 * Pro Faceoff / War Cry unlock — profiles row + auth metadata.
 */
export async function fetchIsProUser() {
  const active = getActiveUser?.() || {};
  let authUser = null;
  try {
    const { data } = await supabase.auth.getUser();
    authUser = data?.user || null;
  } catch {
    authUser = null;
  }

  if (!isSupabaseConfigured()) {
    return profileLooksPro(active, authUser);
  }

  const userId =
    asUuidOrNull(authUser?.id) ||
    asUuidOrNull(active.userId) ||
    asUuidOrNull(active.id) ||
    null;

  if (!userId) {
    return profileLooksPro(active, authUser);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, verified, status_badge, is_pro, tier')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Soft retry without optional is_pro / tier columns
      const { data: slim } = await supabase
        .from('profiles')
        .select('id, role, verified, status_badge')
        .eq('id', userId)
        .maybeSingle();
      return profileLooksPro(slim || active, authUser);
    }
    return profileLooksPro(data || active, authUser);
  } catch (err) {
    console.warn(
      '[destinationPublish] fetchIsProUser soft-fail:',
      err?.message || err
    );
    return profileLooksPro(active, authUser);
  }
}

async function uploadClip(videoUri, userId, caption) {
  const result = await uploadVideoToSupabase(
    videoUri,
    userId,
    'OTHERS',
    caption || ''
  );
  const publicUrl =
    result?.url ||
    result?.data?.video_url ||
    result?.data?.url ||
    null;
  if (!result?.success || !publicUrl || !/^https:\/\//i.test(String(publicUrl))) {
    return {
      ok: false,
      error: result?.error || 'Upload finished without a public HTTPS URL.',
      publicUrl: null,
      localUri: videoUri,
    };
  }
  return {
    ok: true,
    publicUrl,
    localUri: videoUri,
    data: result.data || null,
  };
}

async function insertChallengeRow({
  gladiatorId,
  title,
  hashtag,
  tier,
  videoUrl,
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, skipped: true, reason: 'supabase-not-configured' };
  }

  const row = {
    title: String(title || '').trim(),
    hashtag: String(hashtag || '')
      .replace(/^#/, '')
      .trim(),
    tier: String(tier || 'dark_arena'),
    created_at: new Date().toISOString(),
  };
  if (gladiatorId) row.gladiator_id = gladiatorId;
  if (videoUrl) row.video_url = videoUrl;

  try {
    let { data, error } = await supabase
      .from('challenges')
      .insert([row])
      .select()
      .maybeSingle();

    if (
      error &&
      row.gladiator_id &&
      /gladiator_id|foreign key|uuid|23503|22P02/i.test(
        String(error.message || error.code || '')
      )
    ) {
      const { gladiator_id: _omit, ...withoutGlad } = row;
      ({ data, error } = await supabase
        .from('challenges')
        .insert([withoutGlad])
        .select()
        .maybeSingle());
    }

    if (error) {
      console.warn(
        '[destinationPublish] challenges insert soft-fail:',
        error.message || error.code
      );
      return { ok: false, error, data: null };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn(
      '[destinationPublish] challenges insert threw:',
      err?.message || err
    );
    return { ok: false, error: err, data: null };
  }
}

async function insertChallengeResponseRow({
  challengeId,
  athleteId,
  videoUrl,
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, skipped: true, reason: 'supabase-not-configured' };
  }
  if (!challengeId || !videoUrl) {
    return { ok: false, error: new Error('Missing challenge_id or video_url') };
  }

  const row = {
    challenge_id: challengeId,
    video_url: videoUrl,
    created_at: new Date().toISOString(),
  };
  if (athleteId) row.athlete_id = athleteId;

  try {
    let { data, error } = await supabase
      .from('challenge_responses')
      .insert([row])
      .select()
      .maybeSingle();

    if (
      error &&
      row.athlete_id &&
      /athlete_id|foreign key|uuid|23503|22P02/i.test(
        String(error.message || error.code || '')
      )
    ) {
      const { athlete_id: _omit, ...withoutAthlete } = row;
      ({ data, error } = await supabase
        .from('challenge_responses')
        .insert([withoutAthlete])
        .select()
        .maybeSingle());
    }

    if (error) {
      console.warn(
        '[destinationPublish] challenge_responses insert soft-fail:',
        error.message || error.code
      );
      return { ok: false, error, data: null };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn(
      '[destinationPublish] challenge_responses insert threw:',
      err?.message || err
    );
    return { ok: false, error: err, data: null };
  }
}

/**
 * Publish from PostDestinationSelector.
 *
 * @param {{
 *   videoUri: string,
 *   tier: string,
 *   title: string,
 *   hashtag?: string,
 *   isChallengeResponse?: boolean,
 *   challengeId?: string | null,
 *   userId?: string | null,
 * }} input
 */
export async function publishToDestination(input) {
  const videoUri = typeof input?.videoUri === 'string' ? input.videoUri.trim() : '';
  const tier = String(input?.tier || 'reel');
  const title = String(input?.title || 'BAWAAL Drop').trim() || 'BAWAAL Drop';
  const hashtag = String(input?.hashtag || '')
    .replace(/^#/, '')
    .trim();
  const challengeId =
    asUuidOrNull(input?.challengeId) ||
    (typeof input?.challengeId === 'string' ? input.challengeId.trim() : null);

  if (!videoUri) {
    return { ok: false, error: 'Missing video URI' };
  }

  const userId = await resolveAuthUserId(input?.userId);
  const active = getActiveUser?.() || {};
  const author = active.handle || '@you';

  // Response to an existing challenge
  if (input?.isChallengeResponse && challengeId) {
    const uploaded = await uploadClip(videoUri, userId, title);
    const videoUrl = uploaded.publicUrl || videoUri;
    const inserted = await insertChallengeResponseRow({
      challengeId,
      athleteId: userId,
      videoUrl,
    });
    return {
      ok: true,
      kind: 'challenge_response',
      publicUrl: uploaded.publicUrl || null,
      localUri: videoUri,
      challengeId,
      data: inserted.data || null,
      softFail: !inserted.ok,
      feedTarget: 'ARENA',
      post: {
        id: inserted.data?.id || `response-${Date.now()}`,
        type: 'battle_thread',
        isBattleResponse: true,
        title,
        caption: title,
        videoUri: videoUrl,
        uri: videoUrl,
        publicCloudUrl: uploaded.publicUrl || null,
        localVideoUri: videoUri,
        challengeId,
        athlete: author,
        author,
        feedTarget: 'ARENA',
        timestamp: Date.now(),
        createdAt: Date.now(),
        _freshPublish: true,
      },
    };
  }

  // Open challenge tiers
  if (tier === 'dark_arena' || tier === 'pro_faceoff') {
    const uploaded = await uploadClip(videoUri, userId, title);
    const videoUrl = uploaded.publicUrl || null;
    const inserted = await insertChallengeRow({
      gladiatorId: userId,
      title,
      hashtag,
      tier,
      videoUrl,
    });
    const playable = videoUrl || videoUri;
    return {
      ok: true,
      kind: 'challenge',
      tier,
      publicUrl: videoUrl,
      localUri: videoUri,
      data: inserted.data || null,
      softFail: !inserted.ok || !uploaded.ok,
      feedTarget: 'BATTLES',
      post: {
        id: inserted.data?.id || `challenge-${Date.now()}`,
        type: 'open_challenge',
        mode: 'BATTLE_BAWAAL',
        title,
        caption: hashtag ? `${title} #${hashtag}` : title,
        hashtag,
        tier,
        videoUri: playable,
        uri: playable,
        publicCloudUrl: videoUrl,
        localVideoUri: videoUri,
        gladiator_id: userId,
        athlete: author,
        author,
        feedTarget: 'BATTLES',
        status: 'OPEN',
        timestamp: Date.now(),
        createdAt: Date.now(),
        _freshPublish: true,
      },
    };
  }

  // War Cry — live stream destination (no async post insert)
  if (tier === 'war_cry_live') {
    return {
      ok: false,
      kind: 'war_cry_live',
      error:
        'War Cry is a live 1v1 stream. Launch War Cry from Battles when the live room is ready.',
    };
  }

  // Reel / Story / Group Battle → standard Arena (or Battles for group) storage
  const mode =
    tier === 'story' ? 'SPARKS' : tier === 'group_battle' ? 'BATTLE_REWIND' : 'JOSH';
  const published = await publishRecordedClipToArena({
    localUri: videoUri,
    title,
    caption: hashtag ? `${title} #${hashtag}` : title,
    author,
    creator: 'You',
    mode,
    sport: 'OTHERS',
  });

  if (tier === 'group_battle' && published?.post) {
    try {
      pushHotFeatureBattle({
        ...published.post,
        feedTarget: 'BATTLES',
        type: 'group_battle',
      });
    } catch (err) {
      console.warn(
        '[destinationPublish] group battle feed soft-fail:',
        err?.message || err
      );
    }
  }

  return {
    ok: !!published?.ok,
    kind: tier,
    publicUrl: published?.publicUrl || null,
    localUri: published?.localUri || videoUri,
    error: published?.error || null,
    feedTarget: tier === 'group_battle' ? 'BATTLES' : 'ARENA',
    post: published?.post
      ? {
          ...published.post,
          tier,
          hashtag: hashtag || null,
          feedTarget: tier === 'group_battle' ? 'BATTLES' : 'ARENA',
          type:
            tier === 'story'
              ? 'story'
              : tier === 'group_battle'
                ? 'group_battle'
                : 'reel',
        }
      : null,
  };
}
