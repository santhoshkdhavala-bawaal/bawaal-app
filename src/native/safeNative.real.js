/**
 * Dev-client / release gate — static imports only (never dynamic).
 * Metro loads this instead of safeNative.js when BAWAAL_EXPO_GO is unset.
 */
import Constants from 'expo-constants';
import { Video, ResizeMode } from 'expo-av';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

export const isExpoGo = Constants.appOwnership === 'expo';

const realExpoAv = { Video, ResizeMode };
const realAgora = Agora;

export const ExpoAvModule = isExpoGo ? MOCK_EXPO_AV : realExpoAv;
export const AgoraSdkModule = isExpoGo ? MOCK_AGORA_SDK : realAgora;

export function loadExpoAv() {
  if (isExpoGo) return null;
  return realExpoAv?.Video ? realExpoAv : null;
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
    hasExpoAv: Boolean(realExpoAv?.Video) && !isExpoGo,
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
