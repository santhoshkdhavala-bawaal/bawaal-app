const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

/**
 * Expo Go (`npm run start:go`) must never pull react-native-agora / real expo-av
 * bridges into the graph. Dev-client (`npm start`) keeps the real modules.
 *
 * Set by scripts/startExpoGo.js → BAWAAL_EXPO_GO=1
 */
const lifecycle = process.env.npm_lifecycle_event || '';
const stubNativeModules =
  process.env.BAWAAL_EXPO_GO === '1' ||
  lifecycle === 'start:go' ||
  lifecycle === 'web';

const MOCK_BRIDGE = path.resolve(
  __dirname,
  'src/native/realNativeModules.mock.js'
);
const REAL_BRIDGE = path.resolve(
  __dirname,
  'src/native/realNativeModules.real.js'
);
const AGORA_STUB = path.resolve(
  __dirname,
  'src/native/stubs/react-native-agora.js'
);

const previousResolveRequest = defaultConfig.resolver.resolveRequest;

defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolveDefault = () => {
    if (typeof previousResolveRequest === 'function') {
      return previousResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  const normalized = String(moduleName || '').replace(/\\/g, '/');
  const isBridge =
    normalized === './realNativeModules' ||
    normalized === '../native/realNativeModules' ||
    normalized.endsWith('/native/realNativeModules') ||
    normalized.endsWith('/realNativeModules') ||
    normalized.endsWith('/realNativeModules.js');

  if (isBridge) {
    return {
      filePath: stubNativeModules ? MOCK_BRIDGE : REAL_BRIDGE,
      type: 'sourceFile',
    };
  }

  if (stubNativeModules && moduleName === 'react-native-agora') {
    return {
      filePath: AGORA_STUB,
      type: 'sourceFile',
    };
  }

  return resolveDefault();
};

if (stubNativeModules) {
  // Visible in the Expo CLI terminal when Expo Go stubs are on
  console.log(
    '[metro] BAWAAL Expo Go stubs active — react-native-agora + realNativeModules → mocks'
  );
}

module.exports = defaultConfig;
