/**
 * BAWAAL Arena feed store — persistent list so posts survive camera modal / freezeOnBlur.
 */
import { ensurePublicBawaalVideoUrl } from './src/services/uploadService';

/** @type {object[]} */
let arenaPosts = [];
const listeners = new Set();

function emit(post) {
  listeners.forEach((fn) => {
    try {
      fn(post);
    } catch (_) {
      /* ignore subscriber errors */
    }
  });
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

/**
 * Safely prepend a reel/challenge to the Arena feed.
 * Alias: addPost (used by SPARKS / JOSH publish path).
 */
export function pushArenaPost(post) {
  try {
    if (!post || typeof post !== 'object') return null;
    const ts = Number(post.timestamp || post.createdAt) || Date.now();
    const id = String(post.id || `arena-${ts}`);
    // Always store the /object/public/bawaalvideos/... form for Android playback
    const videoUri = pickPublicVideoUri(post);
    const normalized = {
      type: 'reel',
      sport: post.category || post.sport || 'GYM',
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
      timestamp: ts,
      videoUri,
      uri: videoUri,
      recordedVideoUri: videoUri,
      publicCloudUrl: videoUri,
      remoteVideoUri: videoUri,
      localVideoUri:
        typeof post.localVideoUri === 'string' ? post.localVideoUri : null,
    };

    console.log('[arenaFeedStore] videoUri ->', videoUri);

    arenaPosts = [
      normalized,
      ...arenaPosts.filter((p) => p && p.id !== normalized.id),
    ];
    emit(normalized);
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

export function getArenaPosts() {
  return arenaPosts.slice();
}

export function subscribeArenaPosts(fn) {
  listeners.add(fn);
  // Catch-up: deliver current list (newest first) without wiping the store
  arenaPosts.forEach((p) => {
    try {
      fn(p);
    } catch (_) {
      /* ignore */
    }
  });
  return () => listeners.delete(fn);
}

/** @deprecated Prefer getArenaPosts(); kept for ArenaFeed mount drain */
export function drainPendingArenaPosts() {
  return arenaPosts.slice();
}

const arenaFeedStore = {
  pushArenaPost,
  addPost,
  getArenaPosts,
  subscribeArenaPosts,
  drainPendingArenaPosts,
};

export default arenaFeedStore;
