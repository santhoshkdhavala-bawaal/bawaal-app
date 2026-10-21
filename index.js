import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

// Dismiss native splash before React mounts — JS Obsidian splash takes over in App.
SplashScreen.hideAsync().catch(() => {});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures the environment is set up appropriately whether in Expo Go or a native build.
registerRootComponent(App);
