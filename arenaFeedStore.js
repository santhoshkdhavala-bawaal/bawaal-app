/** Instant Arena feed handoff — push local clips without waiting on navigation params. */
let pendingPosts = [];
const listeners = new Set();

export function pushArenaPost(post) {
  if (!post) return;
  pendingPosts.push(post);
  listeners.forEach((fn) => {
    try {
      fn(post);
    } catch (_) {
      /* ignore subscriber errors */
    }
  });
}

export function subscribeArenaPosts(fn) {
  listeners.add(fn);
  // Deliver anything already queued
  pendingPosts.forEach((p) => {
    try {
      fn(p);
    } catch (_) {
      /* ignore */
    }
  });
  pendingPosts = [];
  return () => listeners.delete(fn);
}

export function drainPendingArenaPosts() {
  const out = pendingPosts.slice();
  pendingPosts = [];
  return out;
}
