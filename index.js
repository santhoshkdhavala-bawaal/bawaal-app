import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { Component } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { registerRootComponent } from 'expo';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Install global ErrorUtils crash file logger before App mounts
import './NativeLogger';
import { logStartup } from './NativeLogger';
import { CrashBoundary } from './src/components/CrashBoundary';
import {
  hideSplashSafe,
  preventAutoHideSafe,
} from './src/boot/safeSplash';
import { injectWebScrollbarStyles } from './src/styles/injectWebScrollbar';
import { registerLiveKitGlobalsSafe } from './src/boot/registerLiveKitGlobals';

// LiveKit WebRTC globals (native only — web stub is a no-op)
registerLiveKitGlobalsSafe();

// Web-only: replace default light grey scrollbars with BAWAAL orange/black chrome
injectWebScrollbarStyles();

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
 * Lazy App load — keeps CrashBoundary mounted even if App.js or a transitive
 * native import throws during module evaluation (common APK cold-start killer).
 */
class LazyApp extends Component {
  state = { App: null, loadError: null };

  componentDidMount() {
    try {
      const mod = require('./App');

      const App = mod?.default || mod;
      if (typeof App !== 'function' && typeof App !== 'object') {
        throw new Error('App module did not export a React component');
      }
      this.setState({ App });
    } catch (err) {
      console.error('[boot] LazyApp require failed:', err?.message || err);
      this.setState({ loadError: err });
      void hideSplashSafe('lazy-app-require-fail');
    }
  }

  render() {
    if (this.state.loadError) {
      const err = this.state.loadError;
      return (
        <View style={lazyStyles.box}>
          <Text style={lazyStyles.title}>BAWAAL Module Load Crash</Text>
          <Text style={lazyStyles.body}>
            {String(err?.message || err || 'Unknown require() failure')}
          </Text>
          {!!err?.stack && (
            <Text style={lazyStyles.stack}>{String(err.stack)}</Text>
          )}
        </View>
      );
    }
    const App = this.state.App;
    if (!App) {
      return <View style={lazyStyles.boot} />;
    }
    return <App />;
  }
}

/**
 * Outermost root — CrashBoundary catches unhandled JS exceptions on launch
 * and renders raw error + stack in Text so the phone stays usable.
 * GestureHandlerRootView is required for RNGH + React Navigation on Android.
 */
function Root() {
  return (
    <GestureHandlerRootView style={lazyStyles.boot}>
      <CrashBoundary>
        <LazyApp />
      </CrashBoundary>
    </GestureHandlerRootView>
  );
}

const lazyStyles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: '#000000' },
  box: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#FF3333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  body: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  stack: { color: '#AAAAAA', fontSize: 11, fontFamily: 'monospace' },
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root).
registerRootComponent(Root);
