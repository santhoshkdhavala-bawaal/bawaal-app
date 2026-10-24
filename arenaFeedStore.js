/**
 * BAWAAL Arena feed store — persistent list so posts survive camera modal / freezeOnBlur.
 */
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

/**
 * Safely prepend a reel/challenge to the Arena feed.
 * Alias: addPost (used by SPARKS / JOSH publish path).
 */
export function pushArenaPost(post) {
  try {
    if (!post || typeof post !== 'object') return null;
    const ts = Number(post.timestamp || post.createdAt) || Date.now();
    const id = String(post.id || `arena-${ts}`);
    const videoUri =
      (typeof post.videoUri === 'string' && post.videoUri) ||
      (typeof post.recordedVideoUri === 'string' && post.recordedVideoUri) ||
      (typeof post.uri === 'string' && post.uri) ||
      (typeof post.localVideoUri === 'string' && post.localVideoUri) ||
      null;
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
    };

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
