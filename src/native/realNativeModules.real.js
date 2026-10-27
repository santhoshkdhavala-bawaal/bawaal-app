/**
 * Dev-client / release resolution target.
 * Static imports only — never used by Expo Go Metro (see metro.config.js).
 */
import { Video, ResizeMode } from 'expo-av';
import * as Agora from 'react-native-agora';

export const expoAv = { Video, ResizeMode };
export const agoraSdk = Agora;
export const isRealNativeModules = true;
