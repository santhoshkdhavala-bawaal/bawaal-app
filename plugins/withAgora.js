/**
 * Expo config plugin — ensures Agora RTC native permissions land in Dev Client builds.
 * react-native-agora autolinks; this plugin hardens camera/mic Info.plist + Android perms.
 */
const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

const CAMERA_MSG =
  'Allow BAWAAL to access your camera for live battle streaming and responses.';
const MIC_MSG =
  'Allow BAWAAL to access your microphone for live battle audio and responses.';

function withAgoraIos(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription =
      cfg.modResults.NSCameraUsageDescription || CAMERA_MSG;
    cfg.modResults.NSMicrophoneUsageDescription =
      cfg.modResults.NSMicrophoneUsageDescription || MIC_MSG;
    return cfg;
  });
}

function withAgoraAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const perms = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.BLUETOOTH',
    ];
    for (const permission of perms) {
      AndroidConfig.Permissions.ensurePermission(cfg.modResults, permission);
    }
    return cfg;
  });
}

function withAgora(config) {
  config = withAgoraIos(config);
  config = withAgoraAndroid(config);
  return config;
}

module.exports = withAgora;
