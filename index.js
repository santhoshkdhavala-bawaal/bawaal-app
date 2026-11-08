import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';
import Constants from 'expo-constants';

// Install global ErrorUtils crash file logger before App mounts
import './NativeLogger';
import { logStartup } from './NativeLogger';
import { CrashBoundary } from './src/components/CrashBoundary';
import {
  hideSplashSafe,
  preventAutoHideSafe,
} from './src/boot/safeSplash';
import App from './App';

const isExpoGo = Constants.appOwnership === 'expo';

logStartup('entry', {
  ownership: Constants.appOwnership,
  executionEnvironment: Constants.executionEnvironment,
});

try {
  if (isExpoGo) {
    void hideSplashSafe('expo-go-entry');
  } else {
    void preventAutoHideSafe();
  }
} catch (err) {
  console.warn('[boot] SplashScreen init threw:', err?.message || err);
} finally {
  // Absolute failsafe — never leave native splash covering a hung boot.
  setTimeout(() => {
    void hideSplashSafe('entry-failsafe-6s');
  }, 6000);
}

/**
 * Outermost root — CrashBoundary (ErrorBoundary) catches unhandled JS exceptions
 * on launch and renders raw error + stack in Text so the phone stays usable.
 */
function Root() {
  return (
    <CrashBoundary>
      <App />
    </CrashBoundary>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root).
registerRootComponent(Root);
