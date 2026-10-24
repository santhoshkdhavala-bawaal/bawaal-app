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

/** Prepend a reel/challenge to the Arena feed and notify subscribers. */
export function pushArenaPost(post) {
  if (!post) return null;
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
    caption: post.caption || post.title || post.target || 'Arena drop',
    hypeCount: post.hypeCount || 0,
    createdAt: post.timestamp || post.createdAt || Date.now(),
    ...post,
    id: post.id || `arena-${Date.now()}`,
    videoUri:
      post.videoUri || post.recordedVideoUri || post.uri || post.localVideoUri || null,
    uri: post.uri || post.videoUri || post.recordedVideoUri || null,
    recordedVideoUri: post.recordedVideoUri || post.videoUri || post.uri || null,
  };

  arenaPosts = [normalized, ...arenaPosts.filter((p) => p.id !== normalized.id)];
  emit(normalized);
  return normalized;
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
  getArenaPosts,
  subscribeArenaPosts,
  drainPendingArenaPosts,
};

export default arenaFeedStore;
