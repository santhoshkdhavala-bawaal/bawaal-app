/**
 * Dev-client / release gate.
 * Metro loads this ONLY when BAWAAL_DEV_CLIENT=1 (see metro.config.js).
 *
 * Video playback uses expo-video (imported by BawaalExpoVideo) — no expo-av.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

const ownership = Constants.appOwnership;
const executionEnvironment = Constants.executionEnvironment;

export const isExpoGo =
  ownership === 'expo' || executionEnvironment === 'storeClient';

export const ExpoAvModule = MOCK_EXPO_AV;
export const AgoraSdkModule = isExpoGo ? MOCK_AGORA_SDK : Agora;

/** @deprecated expo-av removed — callers should use BawaalExpoVideo / expo-video. */
export function loadExpoAv() {
  return null;
}

export function loadAgoraSdk() {
  if (isExpoGo) return null;
  return Agora?.createAgoraRtcEngine ? Agora : null;
}

export function safeRequire() {
  return null;
}

export function getNativeBridgeInfo() {
  return {
    isExpoGo,
    isRealNativeModules: !isExpoGo,
    hasExpoAv: false,
    hasExpoVideo: !isExpoGo,
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
