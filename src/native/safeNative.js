/**
 * Safe native-module gate for BAWAAL.
 *
 * ZERO dynamic require() / import() of expo-av or react-native-agora.
 * Runtime: Constants.appOwnership === 'expo' ? mockFallback : realModule
 * Bundle:  Metro remaps realNativeModules → .mock.js on `npm run start:go`
 *          so Agora / expo-av never enter the Expo Go dependency graph.
 */
import Constants from 'expo-constants';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';
import {
  expoAv as bridgedExpoAv,
  agoraSdk as bridgedAgoraSdk,
  isRealNativeModules,
} from './realNativeModules';

/** Same gate as runtimeEnv — inlined so this file stays dependency-light. */
export const isExpoGo = Constants.appOwnership === 'expo';

const mockExpoAv = MOCK_EXPO_AV;
const mockAgoraSdk = MOCK_AGORA_SDK;

/**
 * Resolved once at module load:
 *   Expo Go  → always mocks (even if Metro accidentally bridged reals)
 *   Dev build → Metro-bridged static modules from realNativeModules.real.js
 */
export const ExpoAvModule = isExpoGo ? mockExpoAv : bridgedExpoAv;
export const AgoraSdkModule = isExpoGo ? mockAgoraSdk : bridgedAgoraSdk;

/** @returns {{ Video: any, ResizeMode: any }|null} */
export function loadExpoAv() {
  const mod = isExpoGo ? mockExpoAv : bridgedExpoAv;
  if (!mod?.Video) return null;
  // Expo Go callers should treat this as unavailable and use SportsFeedPlaceholder
  if (isExpoGo) return null;
  return mod;
}

/** @returns {any|null} */
export function loadAgoraSdk() {
  if (isExpoGo) return null;
  const mod = bridgedAgoraSdk;
  if (!mod?.createAgoraRtcEngine) return null;
  return mod;
}

/**
 * Former dynamic require helper — intentionally inert.
 * Callers must use loadExpoAv / loadAgoraSdk instead.
 */
export function safeRequire() {
  console.warn(
    '[safeNative] safeRequire() is disabled (no dynamic require). Use loadExpoAv / loadAgoraSdk.'
  );
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
