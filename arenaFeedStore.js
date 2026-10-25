/**
 * BAWAAL Arena feed store — in-memory + Supabase-backed persistence.
 * Hydrate from `bawaal_posts` on Arena mount; prepend locally on publish.
 */
import { ensurePublicBawaalVideoUrl } from './src/services/uploadService';
import {
  fetchArenaPostsFromSupabase,
  persistArenaPostToSupabase,
} from './src/services/arenaPostsService';

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

function normalizeArenaPost(post) {
  if (!post || typeof post !== 'object') return null;
  const ts = Number(post.timestamp || post.createdAt) || Date.now();
  const id = String(post.id || `arena-${ts}`);
  const videoUri = pickPublicVideoUri(post);
  return {
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
}

function mergeIntoStore(normalized, { emitEvent = true } = {}) {
  if (!normalized?.id) return null;
  arenaPosts = [
    normalized,
    ...arenaPosts.filter((p) => p && p.id !== normalized.id),
  ];
  // Keep newest-first by timestamp
  arenaPosts.sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
  );
  if (emitEvent) emit(normalized);
  return normalized;
}

/**
 * Safely prepend a reel/challenge to the Arena feed and persist to Supabase.
 * Alias: addPost (used by SPARKS / JOSH publish path).
 */
export function pushArenaPost(post) {
  try {
    const normalized = normalizeArenaPost(post);
    if (!normalized) return null;

    console.log('[arenaFeedStore] videoUri ->', normalized.videoUri);
    mergeIntoStore(normalized, { emitEvent: true });

    // Fire-and-forget cloud persist (skip rows that came from hydrate)
    if (!post?._fromRemote && !post?._skipPersist) {
      void persistArenaPostToSupabase(normalized).then((res) => {
        if (!res?.ok && !res?.skipped) {
          console.warn('[arenaFeedStore] cloud persist missed:', res?.error);
        }
      });
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
      const remote = await fetchArenaPostsFromSupabase();
      if (!Array.isArray(remote) || remote.length === 0) {
        return arenaPosts.slice();
      }

      const incoming = [];
      for (const row of remote) {
        const normalized = normalizeArenaPost({ ...row, _fromRemote: true });
        if (!normalized) continue;
        mergeIntoStore(normalized, { emitEvent: false });
        incoming.push(normalized);
      }

      // Default: notify listeners. Silent mode lets ArenaFeed do one render pass.
      if (!silent) emitBatch(incoming);
      console.log(
        '[arenaFeedStore] hydrated',
        incoming.length,
        'posts from Supabase',
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
  addPost,
  getArenaPosts,
  subscribeArenaPosts,
  drainPendingArenaPosts,
  hydrateArenaPostsFromSupabase,
  refreshArenaPostsFromSupabase,
};

export default arenaFeedStore;
