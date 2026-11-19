/**
 * Dev-client / release resolution target.
 * Metro only loads this when BAWAAL_DEV_CLIENT=1 (see metro.config.js).
 * Video uses expo-video — no expo-av require.
 */
import Constants from 'expo-constants';
import * as Agora from 'react-native-agora';
import { MOCK_EXPO_AV } from './nativeMocks';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

export const expoAv = MOCK_EXPO_AV;
export const agoraSdk = Agora;
export const isRealNativeModules = !isExpoGo;
