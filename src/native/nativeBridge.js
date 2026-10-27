/**
 * Default native bridge = mocks.
 * Metro remaps this module to realNativeModules.real.js for dev-client builds.
 * If remapping fails, Expo Go still gets mocks and keeps booting.
 */
export {
  expoAv,
  agoraSdk,
  isRealNativeModules,
} from './realNativeModules.mock';
