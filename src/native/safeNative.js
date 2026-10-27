/**
 * Safe dynamic requires for modules that crash Expo Go when linked natively.
 * Never call these for packages that are OK in Expo Go unless you also gate
 * with `isExpoGo` / `canUseNativeVideo`.
 */
import { isExpoGo } from '../utils/runtimeEnv';

/**
 * @param {string} moduleId
 * @param {{ skipInExpoGo?: boolean }} [opts]
 * @returns {any|null}
 */
export function safeRequire(moduleId, opts = {}) {
  const skipInExpoGo = opts.skipInExpoGo !== false;
  if (skipInExpoGo && isExpoGo) return null;
  try {
    return require(moduleId);
  } catch (err) {
    console.warn(`[safeNative] ${moduleId} unavailable:`, err?.message || err);
    return null;
  }
}

/**
 * Load expo-av only outside Expo Go (avoids decoder / Fabric tears while UI-dev'ing).
 * @returns {{ Video: any, ResizeMode: any }|null}
 */
export function loadExpoAv() {
  if (isExpoGo) return null;
  try {
    const av = require('expo-av');
    if (!av?.Video) return null;
    return { Video: av.Video, ResizeMode: av.ResizeMode };
  } catch (err) {
    console.warn('[safeNative] expo-av unavailable:', err?.message || err);
    return null;
  }
}

/**
 * Load react-native-agora only outside Expo Go.
 * @returns {any|null}
 */
export function loadAgoraSdk() {
  if (isExpoGo) return null;
  try {
    return require('react-native-agora');
  } catch (err) {
    console.warn('[safeNative] react-native-agora unavailable:', err?.message || err);
    return null;
  }
}

export default { safeRequire, loadExpoAv, loadAgoraSdk };
