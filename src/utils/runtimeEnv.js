/**
 * Runtime environment flags for BAWAAL.
 *
 * Expo Go cannot load custom native binaries (react-native-agora, expo-av /
 * ExponentAV). Use these flags to swap in JS-only placeholders so screens
 * keep navigating without native-module crashes.
 */
import Constants from 'expo-constants';

/**
 * True when the JS bundle is running inside the Expo Go client.
 * Covers both appOwnership === 'expo' and StoreClient executionEnvironment.
 */
export const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

/** Dev / production builds that ship with custom native modules. */
export const isNativeBuild = !isExpoGo;

/** Whether feed / AV playback should use a real native player. */
export const canUseNativeVideo = isNativeBuild;

/** Whether Agora RTC surfaces are expected to exist. */
export const canUseAgora = isNativeBuild;

export function getRuntimeLabel() {
  if (isExpoGo) return 'Expo Go';
  const env = Constants.executionEnvironment;
  if (env) return String(env);
  return 'native';
}

export default {
  isExpoGo,
  isNativeBuild,
  canUseNativeVideo,
  canUseAgora,
  getRuntimeLabel,
};
