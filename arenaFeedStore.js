/**
 * BAWAAL Arena feed store — in-memory + Supabase-backed persistence.
 * Hydrate from `bawaal_posts` on Arena mount; prepend locally on publish.
 */
import {
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
} from './src/services/uploadService';
import {
  cacheLocalArenaPost,
  fetchArenaPostsFromSupabase,
  loadLocalArenaPosts,
  mapChallengeClipToFeedPost,
  persistArenaPostToSupabase,
} from './src/services/arenaPostsService';
import { resolvePostSport } from './src/utils/sportCategory';

/** @type {object[]} */
let arenaPosts = [];
const listeners = new Set();
/** @type {Promise<object[]>|null} */
let hydratePromise = null;

function emit(post) {
  listeners.forEach((fn) => {
    try {
      fn(post);
    } catch (_) {
      /* ignore subscriber errors */
    }
  });
}

function emitBatch(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;
  posts.forEach((p) => emit(p));
}

function pickPublicVideoUri(post) {
  const candidates = [
    post.publicCloudUrl,
    post.remoteVideoUri,
    post.videoUrl,
    post.video_url,
    post.videoUri,
    post.recordedVideoUri,
    post.uri,
    post.localVideoUri,
  ];
  const httpsUri = candidates.find(
    (u) => typeof u === 'string' && /^https:\/\//i.test(u)
  );
  const rawUri =
    httpsUri ||
    candidates.find((u) => typeof u === 'string' && u.length > 0) ||
    null;
  return ensurePublicBawaalVideoUrl(rawUri) || rawUri || null;
}

/** Same battles/*.mp4 should not appear twice under different post ids. */
function videoIdentityKey(uri) {
  if (!uri || typeof uri !== 'string') return '';
  const clean = uri.split('?')[0].trim().toLowerCase();
  const battles = clean.match(/\/battles\/([^/]+)$/);
  if (battles) return `battles/${battles[1]}`;
  return clean;
}

function normalizeArenaPost(post) {
  if (!post || typeof post !== 'object') return null;
  const ts = Number(post.timestamp || post.createdAt) || Date.now();
  // OPEN challenge cards may ship without a clip — keep battle_thread shape
  if (
    post.type === 'battle_thread' ||
    post.isOpenChallenge === true ||
    (post.status === 'OPEN' && (post.challengeId || post.battleId || post.isBattle))
  ) {
    const sport = resolvePostSport(post, 'GYM');
    const opener = pickPublicVideoUri(post) || post.challengeVideoUri || null;
    const id = String(post.id || post.challengeId || post.battleId || `open-${ts}`);
    return {
      ...post,
      id,
      challengeId: String(post.challengeId || post.battleId || id),
      battleId: String(post.battleId || post.challengeId || id),
      type: 'battle_thread',
      isOpenChallenge: true,
      isBattle: true,
      status: post.status || 'OPEN',
      sport,
      category: sport,
      timestamp: ts,
      createdAt: ts,
      challengeVideoUri: opener || post.challengeVideoUri || null,
      videoUri: opener || post.videoUri || null,
      uri: opener || post.uri || null,
      responses: Array.isArray(post.responses) ? post.responses : [],
      feedTarget: 'ARENA',
    };
  }
  const videoUri = pickPublicVideoUri(post);
  const videoKey = videoIdentityKey(videoUri);
  const id = String(
    post.id || (videoKey ? `arena-${videoKey}` : `arena-${ts}`)
  );
  const sport = resolvePostSport(post, 'GYM');
  const localVideoUri =
    typeof post.localVideoUri === 'string' && post.localVideoUri.trim()
      ? post.localVideoUri.trim()
      : videoUri && !isRemoteHttpsUri(videoUri)
        ? videoUri
        : null;
  const cloudUri = isRemoteHttpsUri(videoUri)
    ? ensurePublicBawaalVideoUrl(videoUri) || videoUri
    : typeof post.publicCloudUrl === 'string' &&
        isRemoteHttpsUri(post.publicCloudUrl)
      ? ensurePublicBawaalVideoUrl(post.publicCloudUrl) || post.publicCloudUrl
      : null;
  // Prefer cloud for network playback; keep file:// as playable fallback (no black card)
  const playUri = cloudUri || localVideoUri || videoUri;
  return {
    type: 'reel',
    author:
      post.author ||
      (post.creator === 'You' || post.creator === 'YOU'
        ? '@you'
        : post.creator
          ? `@${String(post.creator).replace(/^@/, '')}`
          : '@you'),
    caption: String(post.caption || post.title || post.target || 'Arena drop'),
    title: String(post.title || post.caption || 'Arena drop'),
    hypeCount: Number(post.hypeCount) || 0,
    createdAt: ts,
    ...post,
    id,
    sport,
    category: sport,
    timestamp: ts,
    videoUri: playUri,
    uri: playUri,
    recordedVideoUri: playUri,
    publicCloudUrl: cloudUri,
    remoteVideoUri: cloudUri,
    localVideoUri,
    cloudUploaded: Boolean(cloudUri || post.cloudUploaded),
  };
}

function mergeIntoStore(normalized, { emitEvent = true } = {}) {
  if (!normalized?.id) return null;
  const videoKey = videoIdentityKey(normalized.videoUri);
  arenaPosts = [
    normalized,
    ...arenaPosts.filter((p) => {
      if (!p) return false;
      if (p.id === normalized.id) return false;
      if (videoKey && videoIdentityKey(p.videoUri) === videoKey) return false;
      return true;
    }),
  ];
  // Keep newest-first by timestamp
  arenaPosts.sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
  );
  if (emitEvent) emit(normalized);
  return normalized;
}

/**
 * Prepend an OPEN challenge card to the Arena feed (no video required).
 * Used by the + BATTLE FAB → CreateBattleSheet publish path.
 */
export function pushOpenChallenge(challenge) {
  try {
    if (!challenge || typeof challenge !== 'object') return null;
    const ts = Number(challenge.timestamp || challenge.createdAt) || Date.now();
    const sport = resolvePostSport(challenge, 'GYM');
    const hostRaw = String(
      challenge.host || challenge.author || challenge.opponent || '@you'
    );
    const host = hostRaw.startsWith('@')
      ? hostRaw
      : `@${hostRaw.replace(/^@/, '')}`;
    const target = String(
      challenge.target || challenge.title || 'OPEN CHALLENGE'
    );
    const opener =
      (typeof challenge.challengeVideoUri === 'string' &&
        challenge.challengeVideoUri.trim()) ||
      (typeof challenge.openerVideoUri === 'string' &&
        challenge.openerVideoUri.trim()) ||
      (typeof challenge.videoUri === 'string' && challenge.videoUri.trim()) ||
      null;
    const id = String(
      challenge.id ||
        challenge.challengeId ||
        challenge.battleId ||
        `open-${ts}`
    );

    const card = {
      ...challenge,
      id,
      challengeId: String(challenge.challengeId || challenge.battleId || id),
      battleId: String(challenge.battleId || challenge.challengeId || id),
      type: 'battle_thread',
      isOpenChallenge: true,
      isBattle: true,
      status: 'OPEN',
      sport,
      category: sport,
      author: 'CHALLENGE',
      opponent: host,
      host,
      challengerLabel: 'YOU',
      leaderLabel: host,
      target,
      title: target,
      challengeVideoUri: opener,
      videoUri: opener,
      uri: opener,
      localVideoUri:
        opener && !isRemoteHttpsUri(opener) ? opener : challenge.localVideoUri || null,
      publicCloudUrl:
        opener && isRemoteHttpsUri(opener) ? opener : challenge.publicCloudUrl || null,
      responses: Array.isArray(challenge.responses) ? challenge.responses : [],
      timestamp: ts,
      createdAt: ts,
      _freshPublish: challenge._freshPublish !== false,
      feedTarget: 'ARENA',
    };

    mergeIntoStore(card, { emitEvent: true });
    return card;
  } catch (err) {
    console.warn('[arenaFeedStore] pushOpenChallenge failed:', err?.message || err);
    return null;
  }
}

/**
 * Safely prepend a reel/challenge to the Arena feed and persist to Supabase.
 * Alias: addPost (used by SPARKS / JOSH publish path).
 */
export function pushArenaPost(post) {
  try {
    const mapped = mapChallengeClipToFeedPost(post) || post;
    const normalized = normalizeArenaPost(mapped);
    if (!normalized || !normalized.videoUri) {
      console.warn('[arenaFeedStore] push skipped — missing playable videoUri');
      return null;
    }

    console.log(
      '[arenaFeedStore] prepend post',
      normalized.id,
      'videoUri ->',
      normalized.videoUri
    );
    mergeIntoStore(normalized, { emitEvent: true });

    // Device cache for local file:// + https so cards survive reload
    if (!post?._fromRemote) {
      void cacheLocalArenaPost(normalized);
    }

    // Only cloud-persist when we have a verified public HTTPS video_url
    const httpsReady =
      isRemoteHttpsUri(normalized.publicCloudUrl) ||
      isRemoteHttpsUri(normalized.videoUri);
    if (!post?._fromRemote && !post?._skipPersist && httpsReady) {
      void persistArenaPostToSupabase(normalized).then((res) => {
        if (!res?.ok && !res?.skipped) {
          console.warn('[arenaFeedStore] cloud persist missed:', res?.error);
        } else if (res?.ok) {
          console.log('[arenaFeedStore] row persisted to bawaal_posts');
        }
      });
    } else if (!post?._fromRemote && !post?._skipPersist && !httpsReady) {
      console.warn(
        '[arenaFeedStore] defer cloud persist — local URI cached for feed playback'
      );
    }

    return normalized;
  } catch (err) {
    console.warn('[arenaFeedStore] pushArenaPost failed:', err?.message || err);
    return null;
  }
}

/** @alias pushArenaPost — stable name for SPARKS/JOSH publish */
export function addPost(post) {
  return pushArenaPost(post);
}

/**
 * Prepend to local feed AND await Supabase `bawaal_posts` upsert.
 * Use from PostCreationSheet so DB write finishes before success UI.
 */
export async function pushArenaPostAndPersist(post) {
  const normalized = pushArenaPost(
    post ? { ...post, _skipPersist: true } : post
  );
  if (!normalized) return null;

  const attemptPersist = async () =>
    persistArenaPostToSupabase({
      ...normalized,
      _fromRemote: false,
      _skipPersist: false,
    });

  try {
    let res = await attemptPersist();
    // One automatic retry — transient network / RLS race
    if (!res?.ok && !res?.skipped) {
      console.warn(
        '[arenaFeedStore] DB persist failed, retrying once:',
        res?.error || res?.reason
      );
      await new Promise((r) => setTimeout(r, 400));
      res = await attemptPersist();
    }
    const hasLiveVideo =
      typeof normalized.videoUri === 'string' &&
      /^https:\/\//i.test(normalized.videoUri);

    if (!res?.ok && !res?.skipped) {
      // Video is already public in Storage — never surface schema/upsert noise to UI
      if (hasLiveVideo) {
        console.warn(
          '[arenaFeedStore] DB persist missed (clip is live in Storage):',
          res?.error || res?.reason
        );
        return {
          ...normalized,
          _persistOk: true,
          _persistReason: 'storage-live',
          _persistWarning: null,
          _freshPublish: true,
        };
      }
      console.warn(
        '[arenaFeedStore] DB persist failed after retry:',
        res?.error || res?.reason
      );
      return {
        ...normalized,
        _persistOk: false,
        _persistError: res?.error || res?.reason || 'cloud-persist-failed',
        _persistWarning: null,
      };
    }
    // Treat storage-meta fallback as full success for UX (video is already public)
    return {
      ...normalized,
      _persistOk: true,
      _persistReason: res?.reason || 'db',
      _persistWarning: null,
      _freshPublish: true,
    };
  } catch (err) {
    const hasLiveVideo =
      typeof normalized.videoUri === 'string' &&
      /^https:\/\//i.test(normalized.videoUri);
    console.warn(
      '[arenaFeedStore] DB persist threw:',
      err?.message || err
    );
    if (hasLiveVideo) {
      return {
        ...normalized,
        _persistOk: true,
        _persistReason: 'storage-live',
        _persistWarning: null,
        _freshPublish: true,
      };
    }
    return {
      ...normalized,
      _persistOk: false,
      _persistError: err?.message || String(err),
      _persistWarning: null,
    };
  }
}

export function getArenaPosts() {
  return arenaPosts.slice();
}

export function subscribeArenaPosts(fn) {
  listeners.add(fn);
  // Do NOT catch-up emit every post here — that caused N setState storms on Arena mount.
  // ArenaFeed already drains via drainPendingArenaPosts() before subscribe.
  return () => listeners.delete(fn);
}

/** @deprecated Prefer getArenaPosts(); kept for ArenaFeed mount drain */
export function drainPendingArenaPosts() {
  return arenaPosts.slice();
}

/**
 * Load posts from Supabase into the store (deduped, newest first).
 * Safe to call multiple times — shares one in-flight promise.
 *
 * @param {{ silent?: boolean }} [opts] When silent, skip per-post emit so the
 *   Arena screen can apply one batched setState (avoids cold-start stutter).
 * @returns {Promise<object[]>}
 */
export async function hydrateArenaPostsFromSupabase(opts = {}) {
  if (hydratePromise) return hydratePromise;

  const silent = !!opts.silent;

  hydratePromise = (async () => {
    try {
      // 1) Device cache first — ChallengeCam local URIs play immediately
      const localCached = await loadLocalArenaPosts();
      const incoming = [];
      for (const row of localCached) {
        const normalized = normalizeArenaPost({
          ...row,
          _fromRemote: false,
          _skipPersist: true,
        });
        if (!normalized?.videoUri) continue;
        mergeIntoStore(normalized, { emitEvent: false });
        incoming.push(normalized);
      }

      // 2) Cloud rows (https) merge on top without wiping local-only clips
      const remote = await fetchArenaPostsFromSupabase();
      if (Array.isArray(remote) && remote.length > 0) {
        for (const row of remote) {
          const normalized = normalizeArenaPost({ ...row, _fromRemote: true });
          if (!normalized?.videoUri) continue;
          mergeIntoStore(normalized, { emitEvent: false });
          incoming.push(normalized);
        }
      }

      if (!silent && incoming.length) emitBatch(incoming);
      console.log(
        '[arenaFeedStore] hydrated',
        'local=',
        localCached.length,
        'remote=',
        Array.isArray(remote) ? remote.length : 0,
        silent ? '(silent)' : ''
      );
      return arenaPosts.slice();
    } catch (err) {
      console.warn(
        '[arenaFeedStore] hydrate failed:',
        err?.message || err
      );
      return arenaPosts.slice();
    } finally {
      // Allow a later refresh (e.g. pull-to-refresh) to fetch again
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

/**
 * Force a fresh fetch (e.g. on Arena focus after a long background).
 */
export async function refreshArenaPostsFromSupabase() {
  hydratePromise = null;
  return hydrateArenaPostsFromSupabase();
}

const arenaFeedStore = {
  pushArenaPost,
  pushArenaPostAndPersist,
  pushOpenChallenge,
  addPost,
  getArenaPosts,
  subscribeArenaPosts,
  drainPendingArenaPosts,
  hydrateArenaPostsFromSupabase,
  refreshArenaPostsFromSupabase,
};

export default arenaFeedStore;
