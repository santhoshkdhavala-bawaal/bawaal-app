/**
 * Crash-safe teardown for video players.
 * Supports legacy expo-av refs (if any) and expo-video VideoPlayer.release().
 */

export async function safeUnloadExpoAvVideo(videoRefOrNode) {
  const node =
    videoRefOrNode && typeof videoRefOrNode === 'object' && 'current' in videoRefOrNode
      ? videoRefOrNode.current
      : videoRefOrNode;
  if (!node) return;

  // expo-video wrapper / player
  try {
    if (node.player) {
      safeReleaseExpoVideoPlayer(node.player);
      return;
    }
  } catch {
    /* ignore */
  }

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

/** Best-effort release for an expo-video VideoPlayer. */
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
  try {
    player.release?.();
  } catch {
    /* ignore */
  }
}
