/**
 * Dynamic Expo config — reads static `app.json`, then injects env-backed
 * Google Maps Android API key + location permissions without touching
 * `./plugins/withAgora.js`.
 */
const appJson = require('./app.json');

const LOCATION_MSG =
  'Allow BAWAAL to use your location to find nearby sports hubs, gyms, and arenas.';

function ensurePlugin(plugins, entry) {
  const name = Array.isArray(entry) ? entry[0] : entry;
  const exists = plugins.some(
    (p) => p === name || (Array.isArray(p) && p[0] === name)
  );
  if (exists) return plugins;
  const agoraIdx = plugins.findIndex(
    (p) =>
      p === './plugins/withAgora.js' ||
      (Array.isArray(p) && p[0] === './plugins/withAgora.js')
  );
  if (agoraIdx >= 0) {
    const next = plugins.slice();
    next.splice(agoraIdx, 0, entry);
    return next;
  }
  return [...plugins, entry];
}

module.exports = () => {
  const expo = JSON.parse(JSON.stringify(appJson.expo || {}));
  const googleMapsAndroidKey = String(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || ''
  ).trim();

  expo.android = expo.android || {};
  expo.android.permissions = Array.from(
    new Set([
      ...(expo.android.permissions || []),
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ])
  );
  expo.android.config = {
    ...(expo.android.config || {}),
    googleMaps: {
      ...((expo.android.config && expo.android.config.googleMaps) || {}),
      apiKey: googleMapsAndroidKey,
    },
  };

  expo.ios = expo.ios || {};
  expo.ios.infoPlist = {
    ...(expo.ios.infoPlist || {}),
    NSLocationWhenInUseUsageDescription:
      expo.ios.infoPlist?.NSLocationWhenInUseUsageDescription || LOCATION_MSG,
  };

  let plugins = Array.isArray(expo.plugins) ? [...expo.plugins] : [];
  plugins = ensurePlugin(plugins, [
    'expo-location',
    {
      locationWhenInUsePermission: LOCATION_MSG,
      isAndroidBackgroundLocationEnabled: false,
      isIosBackgroundLocationEnabled: false,
    },
  ]);
  // Google Maps Android key is injected via android.config.googleMaps.apiKey
  // (react-native-maps has no Expo config plugin in this SDK pin).
  expo.plugins = plugins;

  return { expo };
};
