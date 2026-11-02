/**
 * Configure expo-av Audio so Arena / publish video can play (incl. iOS silent switch).
 * Soft-fails in Expo Go when expo-av is Metro-stubbed / unavailable.
 */
export async function configureGlobalAudioSession() {
  try {
    let Audio = null;
    try {
      // eslint-disable-next-line global-require
      const { loadExpoAv } = require('../native/safeNative');
      const mod = typeof loadExpoAv === 'function' ? loadExpoAv() : null;
      Audio = mod?.Audio || null;
    } catch (_) {
      /* fall through */
    }
    if (!Audio) {
      try {
        // eslint-disable-next-line global-require
        const mod = require('expo-av');
        Audio = mod?.Audio || null;
      } catch (_) {
        return false;
      }
    }
    if (!Audio?.setAudioModeAsync) return false;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return true;
  } catch (err) {
    console.warn(
      '[audio] setAudioModeAsync failed:',
      err?.message || err
    );
    return false;
  }
}

export default configureGlobalAudioSession;
