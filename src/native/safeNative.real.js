/**
 * Dev-client / release gate.
 * Metro loads this instead of safeNative.js when BAWAAL_EXPO_GO is unset.
 *
 * expo-av is loaded via guarded require (never a static import) so opening
 * this bundle inside Expo Go cannot throw `Cannot find native module ExponentAV`.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

export const isExpoGo = Constants.appOwnership === 'expo';

function resolveExpoAv() {
  if (isExpoGo) return MOCK_EXPO_AV;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('expo-av');
    if (mod?.Video) {
      return { Video: mod.Video, ResizeMode: mod.ResizeMode };
    }
  } catch (err) {
    console.warn('[safeNative] expo-av unavailable:', err?.message || err);
  }
  return MOCK_EXPO_AV;
}

const realExpoAv = resolveExpoAv();
const realAgora = Agora;

export const ExpoAvModule = isExpoGo ? MOCK_EXPO_AV : realExpoAv;
export const AgoraSdkModule = isExpoGo ? MOCK_AGORA_SDK : realAgora;

export function loadExpoAv() {
  if (isExpoGo) return null;
  return realExpoAv?.Video && realExpoAv !== MOCK_EXPO_AV ? realExpoAv : null;
}

export function loadAgoraSdk() {
  if (isExpoGo) return null;
  return realAgora?.createAgoraRtcEngine ? realAgora : null;
}

export function safeRequire() {
  return null;
}

export function getNativeBridgeInfo() {
  return {
    isExpoGo,
    isRealNativeModules: !isExpoGo,
    hasExpoAv: Boolean(realExpoAv?.Video) && realExpoAv !== MOCK_EXPO_AV && !isExpoGo,
    hasAgora: Boolean(realAgora?.createAgoraRtcEngine) && !isExpoGo,
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
