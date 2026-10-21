/** Cross-screen handoff for the latest local battle clip (URI + meta). */
let latestBattleClip = null;

export function setLatestBattleClip(clip) {
  latestBattleClip = clip && clip.uri ? { ...clip } : null;
}

export function peekLatestBattleClip() {
  return latestBattleClip;
}

export function consumeLatestBattleClip() {
  const clip = latestBattleClip;
  latestBattleClip = null;
  return clip;
}
