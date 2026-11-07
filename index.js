import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
// Install global ErrorUtils crash file logger before App mounts
import './NativeLogger';
import App from './App';

// Expo Go: hide native splash immediately so App can paint Entry/Main.
// Native builds: App.js calls preventAutoHideAsync and hideAsync after boot.
if (Constants.appOwnership === 'expo') {
  SplashScreen.hideAsync().catch(() => {});
}

// Absolute failsafe — never leave the white/native splash covering a hung boot.
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 6000);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures the environment is set up appropriately whether in Expo Go or a native build.
registerRootComponent(App);
