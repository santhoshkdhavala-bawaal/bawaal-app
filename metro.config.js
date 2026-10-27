const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

/**
 * Expo Go (`npm run start:go` → BAWAAL_EXPO_GO=1) must never open
 * react-native-agora or realNativeModules.real.js.
 * Dev-client (`npm start`) keeps the real modules.
 */
const lifecycle = process.env.npm_lifecycle_event || '';
const stubNativeModules =
  process.env.BAWAAL_EXPO_GO === '1' ||
  lifecycle === 'start:go' ||
  lifecycle === 'web';

const PROJECT_ROOT = __dirname;
const MOCK_BRIDGE = path.resolve(
  PROJECT_ROOT,
  'src/native/realNativeModules.mock.js'
);
const REAL_BRIDGE = path.resolve(
  PROJECT_ROOT,
  'src/native/realNativeModules.real.js'
);
const AGORA_STUB = path.resolve(
  PROJECT_ROOT,
  'src/native/stubs/react-native-agora.js'
);

function isBridgeModule(moduleName) {
  const normalized = String(moduleName || '').replace(/\\/g, '/');
  return (
    normalized === './nativeBridge' ||
    normalized === '../native/nativeBridge' ||
    normalized.endsWith('/native/nativeBridge') ||
    normalized.endsWith('/nativeBridge') ||
    normalized.endsWith('/nativeBridge.js') ||
    normalized === './realNativeModules' ||
    normalized === '../native/realNativeModules' ||
    normalized.endsWith('/native/realNativeModules') ||
    normalized.endsWith('/realNativeModules') ||
    normalized.endsWith('/realNativeModules.js')
  );
}

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isBridgeModule(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: stubNativeModules ? MOCK_BRIDGE : REAL_BRIDGE,
    };
  }

  if (stubNativeModules && moduleName === 'react-native-agora') {
    return {
      type: 'sourceFile',
      filePath: AGORA_STUB,
    };
  }

  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Keep the real Agora package + real bridge out of the Expo Go graph entirely
if (stubNativeModules) {
  const agoraRoot = path
    .resolve(PROJECT_ROOT, 'node_modules/react-native-agora')
    .replace(/\\/g, '/');
  const realBridge = REAL_BRIDGE.replace(/\\/g, '/');

  const toRegex = (filePath) =>
    new RegExp(
      `^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[/\\\\]')}`
    );

  const patterns = [toRegex(agoraRoot), toRegex(realBridge)];
  const prev = config.resolver.blockList;

  if (Array.isArray(prev)) {
    config.resolver.blockList = [...prev, ...patterns];
  } else if (prev instanceof RegExp) {
    config.resolver.blockList = [prev, ...patterns];
  } else {
    config.resolver.blockList = patterns;
  }

  console.log(
    '[metro] BAWAAL Expo Go stubs active — nativeBridge→mock, Agora blocked'
  );
}

module.exports = config;
