import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';

// Install global ErrorUtils crash file logger before App mounts
import './NativeLogger';
import App from './App';

const isExpoGo = Constants.appOwnership === 'expo';

try {
  if (isExpoGo) {
    // Expo Go: never block on native splash
    SplashScreen.hideAsync().catch(() => {});
  } else {
    // Native / APK: keep splash until AppBoot finally/hide
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }
} catch (err) {
  console.warn(
    '[boot] SplashScreen init failed:',
    err?.message || err
  );
}

// Absolute failsafe — never leave the white/native splash covering a hung boot.
setTimeout(() => {
  try {
    SplashScreen.hideAsync().catch(() => {});
  } catch (_) {
    /* soft-fail */
  }
}, 6000);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures the environment is set up appropriately whether in Expo Go or a native build.
registerRootComponent(App);
