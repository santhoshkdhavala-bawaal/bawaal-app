/**
 * Native LiveKit WebRTC globals — required before any Room / track usage.
 * Soft-fails in Expo Go or when native modules are not linked yet.
 */
export function registerLiveKitGlobalsSafe() {
  try {
    const livekit = require('@livekit/react-native');
    if (typeof livekit?.registerGlobals === 'function') {
      livekit.registerGlobals();
    }
  } catch (err) {
    console.warn(
      '[livekit] registerGlobals soft-fail:',
      err?.message || err
    );
  }
}
