/**
 * Crash-safe teardown for expo-av Video instances.
 * Pause → stop → unload in sequence; never throw into React unmount.
 */

export async function safeUnloadExpoAvVideo(videoRefOrNode) {
  const node =
    videoRefOrNode && typeof videoRefOrNode === 'object' && 'current' in videoRefOrNode
      ? videoRefOrNode.current
      : videoRefOrNode;
  if (!node) return;
  try {
    await Promise.resolve(node.setStatusAsync?.({ shouldPlay: false })).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    await Promise.resolve(node.pauseAsync?.()).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    await Promise.resolve(node.stopAsync?.()).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    await Promise.resolve(node.unloadAsync?.()).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Best-effort release for expo-video VideoPlayer. */
export function safeReleaseExpoVideoPlayer(player) {
  if (!player) return;
  try {
    player.pause?.();
  } catch {
    /* ignore */
  }
  try {
    if (typeof player.replace === 'function') {
      player.replace(null);
    } else if (typeof player.replaceAsync === 'function') {
      void player.replaceAsync(null).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
