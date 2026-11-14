/**
 * BAWAAL camera / video recording pipeline constants.
 * Live UI chrome stays in UniversalCamera (locked) — this module is the shared contract.
 *
 * Flow: permissions → CameraView preview → recordAsync → video.uri → ClipPreview → Arena post.
 * Do NOT re-add flash / torch chrome on the live lens (bawaal-challengecam-locked).
 */

/** SPARKS / sports-challenge soft cap shown in HUD. */
export const BAWAAL_SPARKS_MAX_SEC = 30;

/** Default challenge / battle clip length. */
export const BAWAAL_CHALLENGE_DEFAULT_SEC = 30;

/** Post-stop teardown before preview mounts a decoder (locked contract). */
export const BAWAAL_RECORDING_TEARDOWN_MS = 200;

/**
 * Resolve a usable local clip URI from expo-camera `recordAsync` / web MediaRecorder output.
 * @param {{ uri?: string } | null | undefined} video
 * @returns {string | null}
 */
export function extractRecordingUri(video) {
  const uri = typeof video?.uri === 'string' ? video.uri.trim() : '';
  return uri || null;
}
