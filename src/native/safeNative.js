/**
 * Safe native-module gate for BAWAAL.
 *
 * No dynamic require() anywhere — Metro rejects `require(moduleId)`.
 * Runtime gate: Constants.appOwnership === 'expo' ? mocks : bridge
 * Bundle gate:  metro.config.js remaps ./nativeBridge (+ stubs Agora) on start:go
 */
import Constants from 'expo-constants';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';
import {
  expoAv as bridgedExpoAv,
  agoraSdk as bridgedAgoraSdk,
  isRealNativeModules,
} from './nativeBridge';

export const isExpoGo = Constants.appOwnership === 'expo';

const mockExpoAv = MOCK_EXPO_AV;
const mockAgoraSdk = MOCK_AGORA_SDK;

/** Expo Go → mocks; native build → Metro-bridged static modules. */
export const ExpoAvModule = isExpoGo ? mockExpoAv : bridgedExpoAv;
export const AgoraSdkModule = isExpoGo ? mockAgoraSdk : bridgedAgoraSdk;

/** @returns {{ Video: any, ResizeMode: any }|null} */
export function loadExpoAv() {
  if (isExpoGo) return null;
  if (!bridgedExpoAv?.Video) return null;
  return bridgedExpoAv;
}

/** @returns {any|null} */
export function loadAgoraSdk() {
  if (isExpoGo) return null;
  if (!bridgedAgoraSdk?.createAgoraRtcEngine) return null;
  return bridgedAgoraSdk;
}

/** @deprecated Dynamic require is forbidden — always returns null. */
export function safeRequire() {
  return null;
}

export function getNativeBridgeInfo() {
  return {
    isExpoGo,
    isRealNativeModules: Boolean(isRealNativeModules) && !isExpoGo,
    hasExpoAv: Boolean(ExpoAvModule?.Video) && !isExpoGo,
    hasAgora: Boolean(AgoraSdkModule?.createAgoraRtcEngine) && !isExpoGo,
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
