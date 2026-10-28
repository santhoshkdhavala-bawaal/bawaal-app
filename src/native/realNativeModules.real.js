/**
 * Dev-client / release resolution target.
 * Never used by Expo Go Metro (see metro.config.js blockList).
 * Guarded require so accidental Expo Go evaluation cannot throw ExponentAV.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV } from './nativeMocks';

const isExpoGo = Constants.appOwnership === 'expo';

function resolveExpoAv() {
  if (isExpoGo) return MOCK_EXPO_AV;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('expo-av');
    if (mod?.Video) {
      return { Video: mod.Video, ResizeMode: mod.ResizeMode };
    }
  } catch (err) {
    console.warn('[realNativeModules] expo-av unavailable:', err?.message || err);
  }
  return MOCK_EXPO_AV;
}

export const expoAv = resolveExpoAv();
export const agoraSdk = Agora;
export const isRealNativeModules = !isExpoGo;
