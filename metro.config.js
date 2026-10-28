const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

/**
 * Expo Go / plain packager → stub expo-av (no ExponentAV).
 * Dev-client / EAS / run:android|ios → real native modules.
 *
 *   npm run start:go  → stubs
 *   npm start         → real (BAWAAL_DEV_CLIENT=1)
 *   npx expo start    → stubs (safe Expo Go default)
 *   eas build         → real (EAS_BUILD=true)
 */
const lifecycle = process.env.npm_lifecycle_event || '';

const forceStub =
  process.env.BAWAAL_EXPO_GO === '1' ||
  lifecycle === 'start:go' ||
  lifecycle === 'web';

const allowRealNative =
  process.env.BAWAAL_DEV_CLIENT === '1' ||
  process.env.BAWAAL_USE_NATIVE_AV === '1' ||
  process.env.EAS_BUILD === 'true' ||
  lifecycle === 'android' ||
  lifecycle === 'ios' ||
  lifecycle === 'prebuild' ||
  lifecycle === 'build:android:dev';

const stubNativeModules = forceStub || !allowRealNative;

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

function isExpoAvModule(moduleName) {
  const name = String(moduleName || '');
  return name === 'expo-av' || name.startsWith('expo-av/');
}

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isSafeNativeModule(moduleName)) {
    return {
      type: 'sourceFile',
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

  // Always keep real expo-av out of Expo Go / default bundles.
  if (stubNativeModules && isExpoAvModule(moduleName)) {
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
    '[metro] BAWAAL stubs ON — expo-av → placeholder, Agora blocked (Expo Go safe)'
  );
} else {
  console.log(
    '[metro] BAWAAL native modules ON — real expo-av + Agora (dev-client)'
  );
}

module.exports = config;
