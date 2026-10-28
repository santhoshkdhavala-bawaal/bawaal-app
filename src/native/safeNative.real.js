/**
 * Dev-client / release gate.
 * Metro loads this ONLY when BAWAAL_DEV_CLIENT=1 (see metro.config.js).
 *
 * CRITICAL: never require('expo-av') at module top-level — ExponentAV is
 * missing in Expo Go and will crash boot if this file is evaluated there.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

const ownership = Constants.appOwnership;
const executionEnvironment = Constants.executionEnvironment;

export const isExpoGo =
  ownership === 'expo' || executionEnvironment === 'storeClient';

let cachedExpoAv = undefined;

function tryRequireExpoAv() {
  if (cachedExpoAv !== undefined) return cachedExpoAv;
  if (isExpoGo) {
    cachedExpoAv = null;
    return null;
  }
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('expo-av');
    if (mod?.Video) {
      cachedExpoAv = { Video: mod.Video, ResizeMode: mod.ResizeMode };
      return cachedExpoAv;
    }
  } catch (err) {
    console.warn('[safeNative] expo-av unavailable:', err?.message || err);
  }
  cachedExpoAv = null;
  return null;
}

export const ExpoAvModule = MOCK_EXPO_AV;
export const AgoraSdkModule = isExpoGo ? MOCK_AGORA_SDK : Agora;

export function loadExpoAv() {
  if (isExpoGo) return null;
  return tryRequireExpoAv();
}

export function loadAgoraSdk() {
  if (isExpoGo) return null;
  return Agora?.createAgoraRtcEngine ? Agora : null;
}

export function safeRequire() {
  return null;
}

export function getNativeBridgeInfo() {
  const av = tryRequireExpoAv();
  return {
    isExpoGo,
    isRealNativeModules: !isExpoGo,
    hasExpoAv: Boolean(av?.Video),
    hasAgora: Boolean(Agora?.createAgoraRtcEngine) && !isExpoGo,
  };
}

export default {
  isExpoGo,
  ExpoAvModule,
  AgoraSdkModule,
  loadExpoAv,
  loadAgoraSdk,
  safeRequire,
  getNativeBridgeInfo,
};
