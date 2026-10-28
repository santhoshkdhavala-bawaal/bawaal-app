const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

/**
 * Expo Go (`npm run start:go` → BAWAAL_EXPO_GO=1):
 *   - safeNative → mock-only file (no Agora / expo-av)
 *   - expo-av → stub (blocks ExponentAV native lookup)
 *   - react-native-agora → stub
 * Dev-client (`npm start`):
 *   - safeNative → safeNative.real.js (guarded expo-av require)
 */
const lifecycle = process.env.npm_lifecycle_event || '';
const stubNativeModules =
  process.env.BAWAAL_EXPO_GO === '1' ||
  lifecycle === 'start:go' ||
  lifecycle === 'web';

const PROJECT_ROOT = __dirname;
const SAFE_NATIVE_MOCK = path.resolve(PROJECT_ROOT, 'src/native/safeNative.js');
const SAFE_NATIVE_REAL = path.resolve(
  PROJECT_ROOT,
  'src/native/safeNative.real.js'
);
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
const EXPO_AV_STUB = path.resolve(
  PROJECT_ROOT,
  'src/native/stubs/expo-av.js'
);

function isSafeNativeModule(moduleName) {
  const normalized = String(moduleName || '').replace(/\\/g, '/');
  if (normalized.includes('safeNative.real')) return false;
  return (
    normalized === './safeNative' ||
    normalized === '../native/safeNative' ||
    normalized.endsWith('/native/safeNative') ||
    normalized.endsWith('/safeNative') ||
    normalized.endsWith('/safeNative.js')
  );
}

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
  if (isSafeNativeModule(moduleName)) {
    return {
      type: 'sourceFile',
      // Expo Go keeps the mock file; remapping to itself is intentional + cache-bust friendly
      filePath: stubNativeModules ? SAFE_NATIVE_MOCK : SAFE_NATIVE_REAL,
    };
  }

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

  // Keep real expo-av (ExponentAV) out of the Expo Go graph entirely.
  if (
    stubNativeModules &&
    (moduleName === 'expo-av' || String(moduleName).startsWith('expo-av/'))
  ) {
    return {
      type: 'sourceFile',
      filePath: EXPO_AV_STUB,
    };
  }

  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (stubNativeModules) {
  const agoraRoot = path
    .resolve(PROJECT_ROOT, 'node_modules/react-native-agora')
    .replace(/\\/g, '/');
  const expoAvRoot = path
    .resolve(PROJECT_ROOT, 'node_modules/expo-av')
    .replace(/\\/g, '/');
  const realSafe = SAFE_NATIVE_REAL.replace(/\\/g, '/');
  const realBridge = REAL_BRIDGE.replace(/\\/g, '/');

  const toRegex = (filePath) =>
    new RegExp(
      `^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[/\\\\]')}`
    );

  const patterns = [
    toRegex(agoraRoot),
    toRegex(expoAvRoot),
    toRegex(realSafe),
    toRegex(realBridge),
  ];
  const prev = config.resolver.blockList;

  if (Array.isArray(prev)) {
    config.resolver.blockList = [...prev, ...patterns];
  } else if (prev instanceof RegExp) {
    config.resolver.blockList = [prev, ...patterns];
  } else {
    config.resolver.blockList = patterns;
  }

  console.log(
    '[metro] BAWAAL Expo Go stubs active — safeNative mock, expo-av + Agora blocked'
  );
}

module.exports = config;
