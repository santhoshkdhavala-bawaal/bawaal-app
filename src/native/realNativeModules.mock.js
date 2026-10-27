/**
 * Metro Expo Go / stub resolution target.
 * Zero native package imports — keeps the bundle graph clean.
 */
import { MOCK_EXPO_AV, MOCK_AGORA_SDK } from './nativeMocks';

export const expoAv = MOCK_EXPO_AV;
export const agoraSdk = MOCK_AGORA_SDK;
export const isRealNativeModules = false;
