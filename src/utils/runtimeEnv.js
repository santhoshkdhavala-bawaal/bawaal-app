/**
 * Runtime environment flags for BAWAAL.
 *
 * Expo Go cannot load custom native binaries (react-native-agora, custom
 * Fabric video views). Use these flags to swap in JS-only placeholders so
 * screens like AthleteDashboard / BattleScreen keep navigating in Expo Go.
 */
import Constants from 'expo-constants';

/**
 * True when the JS bundle is running inside the Expo Go client.
 * Preferred over executionEnvironment — StoreClient also covers dev-client.
 */
export const isExpoGo = Constants.appOwnership === 'expo';

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
