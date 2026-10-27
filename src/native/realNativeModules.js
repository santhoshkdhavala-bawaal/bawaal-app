/**
 * Default entry for realNativeModules.
 * Metro remaps this to `.mock.js` (Expo Go) or `.real.js` (dev-client).
 * Fallback = mocks so a misconfigured Expo Go session never touches Agora.
 */
export { expoAv, agoraSdk, isRealNativeModules } from './realNativeModules.mock';
