/**
 * Disable native autolinking for react-native-agora.
 * Prevents InitializationProvider / WorkDatabase cold-start crashes on Android.
 * JS continues via Metro stub → src/native/stubs/react-native-agora.js
 */
module.exports = {
  dependencies: {
    'react-native-agora': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
