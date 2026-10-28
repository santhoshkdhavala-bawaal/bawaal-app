/**
 * Dev-client / release resolution target.
 * Metro only loads this when BAWAAL_DEV_CLIENT=1 (see metro.config.js).
 * Lazy expo-av require — never touches ExponentAV at import time.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV } from './nativeMocks';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

let cachedExpoAv = undefined;

function resolveExpoAv() {
  if (cachedExpoAv !== undefined) return cachedExpoAv;
  if (isExpoGo) {
    cachedExpoAv = MOCK_EXPO_AV;
    return cachedExpoAv;
  }
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('expo-av');
    if (mod?.Video) {
      cachedExpoAv = { Video: mod.Video, ResizeMode: mod.ResizeMode };
      return cachedExpoAv;
    }
  } catch (err) {
    console.warn('[realNativeModules] expo-av unavailable:', err?.message || err);
  }
  cachedExpoAv = MOCK_EXPO_AV;
  return cachedExpoAv;
}

export const expoAv = new Proxy(MOCK_EXPO_AV, {
  get(_target, prop) {
    return resolveExpoAv()[prop];
  },
});

export const agoraSdk = Agora;
export const isRealNativeModules = !isExpoGo;
