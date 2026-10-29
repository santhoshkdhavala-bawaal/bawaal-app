/**
 * Locked record → local persist → Supabase Storage → bawaal_posts → Arena feed.
 * Soft-success when Storage is live even if table schema upsert is noisy.
 */
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  persistLocalVideoUri,
  sanitizeVideoUriForUpload,
  uploadVideoToSupabase,
} from './uploadService';
import { pushArenaPostAndPersist, pushArenaPost } from '../../arenaFeedStore';
import { resolvePostSport } from '../utils/sportCategory';

/** Canonical Storage object name for every BAWAAL clip. */
export function makeBawaalClipFileName() {
  return `bawaal_${Date.now()}.mp4`;
}

/**
 * Copy a camera/cache/gallery URI into durable app storage.
 * @param {string} rawUri
 * @returns {Promise<string|null>} stable file:// URI
 */
export async function lockLocalRecording(rawUri) {
  const sanitized = sanitizeVideoUriForUpload(rawUri);
  if (!sanitized) return null;
  if (isRemoteHttpsUri(sanitized)) {
    return ensurePublicBawaalVideoUrl(sanitized) || sanitized;
  }
  try {
    const stable = await persistLocalVideoUri(sanitized);
    return sanitizeVideoUriForUpload(stable) || stable || sanitized;
  } catch (err) {
    console.warn(
      '[recordToPost] lockLocalRecording failed:',
      err?.message || err
    );
    return sanitized;
  }
}

/**
 * Upload local clip → public HTTPS URL in `bawaalvideos`.
 * @returns {Promise<{ ok: boolean, publicUrl?: string, localUri?: string, error?: string }>}
 */
export async function uploadLockedClip(localUri, options = {}) {
  const locked = await lockLocalRecording(localUri);
  if (!locked) {
    return { ok: false, error: 'missing-local-uri' };
  }
  if (isRemoteHttpsUri(locked)) {
    const publicUrl = ensurePublicBawaalVideoUrl(locked) || locked;
    return { ok: true, publicUrl, localUri: locked };
  }

  const fileName = options.fileName || makeBawaalClipFileName();
  const publicUrl = await uploadVideoToSupabase(locked, fileName, {
    onProgress: options.onProgress,
    onError: options.onError,
  });

  if (!publicUrl || !isRemoteHttpsUri(publicUrl)) {
    return {
      ok: false,
      localUri: locked,
      error: 'storage-upload-failed',
    };
  }

  return {
    ok: true,
    publicUrl: ensurePublicBawaalVideoUrl(publicUrl) || publicUrl,
    localUri: locked,
    fileName,
  };
}

/**
 * Full Arena publish: Storage upload + bawaal_posts upsert + feed prepend.
 * Never surfaces schema warnings to the caller when the clip URL is live.
 *
 * @param {{
 *   localUri: string,
 *   title?: string,
 *   caption?: string,
 *   sport?: string,
 *   category?: string,
 *   author?: string,
 *   creator?: string,
 *   mode?: string,
 *   tagline?: string,
 *   durationSec?: number,
 *   onProgress?: (pct: number) => void,
 *   onError?: (msg: string) => void,
 * }} input
 */
export async function publishRecordedClipToArena(input) {
  const title = String(input?.title || 'BAWAAL Drop').trim() || 'BAWAAL Drop';
  const sport = resolvePostSport(input, 'GYM');
  const mode = input?.mode || 'SPARKS';
  const timestamp = Date.now();
  const author = input?.author?.startsWith?.('@')
    ? input.author
    : `@${String(input?.author || input?.creator || 'you').replace(/^@/, '')}`;

  const uploaded = await uploadLockedClip(input?.localUri, {
    onProgress: input?.onProgress,
    onError: input?.onError,
  });

  const caption = String(
    input?.caption ||
      (input?.tagline ? `${title} ${input.tagline}` : title)
  );
  const lockedLocal =
    uploaded.localUri ||
    (typeof input?.localUri === 'string' ? input.localUri.trim() : null);

  // Cloud miss / null URL → still publish local file:// into the Arena feed
  if (!uploaded.ok || !uploaded.publicUrl) {
    if (!lockedLocal) {
      return {
        ok: false,
        error: uploaded.error || 'upload-failed',
        localUri: null,
      };
    }
    const localPayload = {
      id: `arena-${String(mode).toLowerCase()}-local-${timestamp}`,
      type: 'reel',
      mode,
      title,
      caption,
      tagline: input?.tagline || null,
      creator: input?.creator || 'You',
      author,
      category: sport,
      sport,
      videoUri: lockedLocal,
      uri: lockedLocal,
      recordedVideoUri: lockedLocal,
      publicCloudUrl: null,
      remoteVideoUri: null,
      localVideoUri: lockedLocal,
      cloudUploaded: false,
      hypeCount: 0,
      durationSec: Number(input?.durationSec) || 30,
      feed: 'ARENA',
      feedTarget: 'ARENA',
      timestamp,
      createdAt: timestamp,
      _freshPublish: true,
      _skipPersist: true,
    };
    const localCard = pushArenaPost(localPayload) || localPayload;
    console.warn(
      '[recordToPost] cloud upload missed — Arena playing local URI',
      lockedLocal
    );
    return {
      ok: true,
      publicUrl: null,
      localUri: lockedLocal,
      localOnly: true,
      post: {
        ...localCard,
        _persistOk: false,
        _persistWarning: uploaded.error || 'storage-upload-failed',
        _freshPublish: true,
        videoUri: lockedLocal,
        localVideoUri: lockedLocal,
        publicCloudUrl: null,
      },
      feedTarget: 'ARENA',
    };
  }

  const publicUrl = uploaded.publicUrl;

  const arenaPayload = {
    id: `arena-${String(mode).toLowerCase()}-${timestamp}`,
    type: 'reel',
    mode,
    title,
    caption,
    tagline: input?.tagline || null,
    creator: input?.creator || 'You',
    author,
    category: sport,
    sport,
    videoUri: publicUrl,
    uri: publicUrl,
    recordedVideoUri: publicUrl,
    publicCloudUrl: publicUrl,
    remoteVideoUri: publicUrl,
    localVideoUri: lockedLocal || null,
    hypeCount: 0,
    durationSec: Number(input?.durationSec) || 30,
    feed: 'ARENA',
    feedTarget: 'ARENA',
    timestamp,
    createdAt: timestamp,
    _freshPublish: true,
  };

  let card = null;
  try {
    card =
      (await pushArenaPostAndPersist(arenaPayload)) ||
      pushArenaPost(arenaPayload) ||
      arenaPayload;
  } catch (err) {
    console.warn(
      '[recordToPost] persist threw (clip is live):',
      err?.message || err
    );
    card = pushArenaPost(arenaPayload) || arenaPayload;
  }

  // Storage success = product success (schema noise never fails the loop)
  return {
    ok: true,
    publicUrl,
    post: {
      ...card,
      _persistOk: true,
      _persistWarning: null,
      _freshPublish: true,
      videoUri: publicUrl,
      publicCloudUrl: publicUrl,
      localVideoUri: lockedLocal || null,
    },
    feedTarget: 'ARENA',
  };
}

export default {
  makeBawaalClipFileName,
  lockLocalRecording,
  uploadLockedClip,
  publishRecordedClipToArena,
};
