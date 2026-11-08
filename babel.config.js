/**
 * Expo Babel config.
 * `react-native-reanimated/plugin` MUST remain last (Reanimated 4 → worklets plugin).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Keep last — transforms worklets; must run after every other Babel plugin.
      'react-native-reanimated/plugin',
    ],
  };
};
