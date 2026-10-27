import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import App from './App';

// Expo Go: hide native splash immediately so App can paint Entry/Main.
// Native builds: App.js calls preventAutoHideAsync and hideAsync after boot.
if (Constants.appOwnership === 'expo') {
  SplashScreen.hideAsync().catch(() => {});
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures the environment is set up appropriately whether in Expo Go or a native build.
registerRootComponent(App);
