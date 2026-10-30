/**
 * Validate camera-recorded clip URIs before preview / upload handoff.
 * Prevents black preview screens from empty or non-video paths.
 */

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;

/**
 * @param {unknown} uri
 * @returns {{
 *   ok: boolean,
 *   uri?: string,
 *   mock?: boolean,
 *   reason?: 'missing' | 'invalid-type' | 'bad-extension',
 *   message?: string,
 * }}
 */
export function validateRecordedVideoUri(uri) {
  if (uri == null) {
    return {
      ok: false,
      reason: 'missing',
      message: 'Recording finished without a clip. Tap shutter and try again.',
    };
  }
  if (typeof uri !== 'string') {
    return {
      ok: false,
      reason: 'invalid-type',
      message: 'Invalid recording result. Please retake.',
    };
  }

  const trimmed = uri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return {
      ok: false,
      reason: 'missing',
      message: 'Recording finished without a clip. Tap shutter and try again.',
    };
  }

  // ChallengeCam emulator / unavailable-camera mock clips
  if (/^emulator-mock:\/\//i.test(trimmed)) {
    return { ok: true, uri: trimmed, mock: true };
  }

  const pathOnly = trimmed.split('?')[0].split('#')[0];
  const hasVideoExt = VIDEO_EXT_RE.test(pathOnly);
  const isFile = /^file:\/\//i.test(trimmed);
  const isContent = /^content:\/\//i.test(trimmed);
  const isPh =
    /^ph:\/\//i.test(trimmed) || /^assets-library:\/\//i.test(trimmed);
  const isHttps = /^https:\/\//i.test(trimmed);
  // Metro / asset-server URIs for bundled sample_challenge.mp4
  const isAssetHttp =
    /^https?:\/\//i.test(trimmed) &&
    (/sample_challenge\.mp4/i.test(pathOnly) || hasVideoExt);

  // Prefer explicit video extension; allow content:// / ph:// (often no extension)
  if (
    hasVideoExt &&
    (isFile || isHttps || isContent || isPh || isAssetHttp || pathOnly.includes('/'))
  ) {
    return { ok: true, uri: trimmed, mock: isAssetHttp && /sample_challenge/i.test(pathOnly) };
  }
  if (isAssetHttp) {
    return { ok: true, uri: trimmed, mock: /sample_challenge/i.test(pathOnly) };
  }
  if (isContent || isPh) {
    return { ok: true, uri: trimmed };
  }
  if (isFile && hasVideoExt) {
    return { ok: true, uri: trimmed };
  }

  return {
    ok: false,
    reason: 'bad-extension',
    uri: trimmed,
    message:
      'Clip file looks invalid (need .mp4 or .mov). Please retake the recording.',
  };
}

/** True when URI is safe to open in preview / upload pipelines. */
export function isValidRecordedVideoUri(uri) {
  return validateRecordedVideoUri(uri).ok === true;
}
