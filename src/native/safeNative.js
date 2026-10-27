/**
 * Expo Go native gate — static mock fallback only.
 * Metro must never see a non-literal module load in this file.
 * Dev-client: metro.config.js remaps imports of this module to safeNative.real.js
 */
import Constants from 'expo-constants';
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

export const isExpoGo = Constants.appOwnership === 'expo';

export const ExpoAvModule = MOCK_EXPO_AV;
export const AgoraSdkModule = MOCK_AGORA_SDK;

export function loadExpoAv() {
  return null;
}

export function loadAgoraSdk() {
  return null;
}

export function safeRequire() {
  return null;
}

export function getNativeBridgeInfo() {
  return {
    isExpoGo,
    isRealNativeModules: false,
    hasExpoAv: false,
    hasAgora: false,
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
