/**
 * Configure expo-audio session so Arena / publish video can play
 * (incl. iOS silent switch). Soft-fails when native audio is unavailable.
 */
export async function configureGlobalAudioSession() {
  try {
     
    const audio = require('expo-audio');
    const setAudioModeAsync = audio?.setAudioModeAsync;
    if (typeof setAudioModeAsync !== 'function') return false;

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
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
