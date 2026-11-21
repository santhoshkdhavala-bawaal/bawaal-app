import React, { Component, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, StatusBar, ScrollView } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import MainTabs from './MainTabs';
import CameraPublishHost from './CameraPublishHost';
import BattleChallengeForm from './BattleChallengeForm';
import LeaderboardScreen from './LeaderboardScreen';
import WarCryScreen from './WarCryScreen';
import AthleteRegistrationScreen from './AthleteRegistrationScreen';
import AthleteDashboard from './AthleteDashboard';
import AthletePassportScreen from './AthletePassportScreen';
import ClinicScreen from './ClinicScreen';
import SportHubMapScreen from './SportHubMapScreen';
import LiveMatchRoomScreen from './LiveMatchRoomScreen';
import { COLORS } from './theme';
import {
  setRegisteredSession,
  getAuthLaunchState,
} from './sessionStore';
import { applyRegisteredProfile } from './src/services/activeUserProfile';
import { isExpoGo } from './src/utils/runtimeEnv';
import { configureGlobalAudioSession } from './src/utils/configureGlobalAudio';
import { BawaalAlertProvider } from './src/components/BawaalAlert';
import LiveMatchInviteHost from './src/components/LiveMatchInviteHost';
import { hasSupabaseEnv } from './src/services/supabase';
import { logStartup } from './NativeLogger';
import {
  hideSplashSafe,
  preventAutoHideSafe,
} from './src/boot/safeSplash';

export const navigationRef = createNavigationContainerRef();

const ROOT_BG = '#000000';
/** Brief boot / session-restore surface while deciding Entry vs Arena. */
const BOOT_BG = '#08120F';

/**
 * When true, always open Entry and ignore saved session (dev only).
 * Keep false so launch defaults to Arena (or OTP-only after Logout).
 */
const FORCE_ONBOARDING_ENTRY = false;

const Stack = createNativeStackNavigator();
const navTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.PLATINUM_BASE,
    background: ROOT_BG,
    card: ROOT_BG,
    text: COLORS.OFF_WHITE,
    border: COLORS.CARD_BORDER,
    notification: COLORS.PLATINUM_BASE,
  },
};

async function safeHideSplash(reason) {
  await hideSplashSafe(reason);
}

/** Surfaces render crashes instead of a blank / white freeze. */
export class RootErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn(
      'Root render error:',
      error?.message || error,
      info?.componentStack
    );
    this.setState({ info });
    // Never leave the native splash covering a crashed tree
    void safeHideSplash('error-boundary');
  }

  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || this.state.error);
      const jsStack = this.state.error?.stack
        ? String(this.state.error.stack)
        : null;
      return (
        <View style={styles.errorRoot}>
          <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
          <Text style={styles.errorTitle}>BAWAAL failed to start</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorBody}>{message}</Text>
            {!!jsStack && <Text style={styles.errorStack}>{jsStack}</Text>}
            {!!this.state.info?.componentStack && (
              <Text style={styles.errorStack}>
                {'\n'}Component stack:{'\n'}
                {this.state.info.componentStack}
              </Text>
            )}
          </ScrollView>
          <Text
            style={styles.errorRetry}
            onPress={() => this.setState({ error: null, info: null })}
          >
            TAP TO RETRY
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function EntryScreen({ navigation, route }) {
  const loginOnly = Boolean(route?.params?.loginOnly);
  return (
    <View style={styles.root}>
      <AthleteRegistrationScreen
        loginOnly={loginOnly}
        onCompleteRegistration={async (userData) => {
          try {
            applyRegisteredProfile(userData || {});
            await setRegisteredSession(userData || {});
          } catch (err) {
            console.warn('Failed to persist registration:', err?.message || err);
          }
          // Replace stack so registration cannot be reached via Back
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', params: { tab: 'Arena' } }],
          });
        }}
      />
    </View>
  );
}

/**
 * Launch routing:
 *   - Logged-in registered → Main (ARENA)
 *   - Logged-out but hasRegisteredPreviously → Entry (Phone + OTP only)
 *   - Fresh / guest → Main (ARENA) — never force a registration wall
 */
async function resolveLaunchRoute() {
  if (FORCE_ONBOARDING_ENTRY) {
    return { route: 'Entry', loginOnly: false };
  }

  try {
    const state = await getAuthLaunchState();
    if (state.loginOnly) {
      return { route: 'Entry', loginOnly: true, session: state.session };
    }
    if (state.isLoggedIn && state.session) {
      try {
        applyRegisteredProfile(state.session);
      } catch (_) {
        /* soft-fail profile apply */
      }
    }
    return { route: 'Main', loginOnly: false, session: state.session };
  } catch (_) {
    return { route: 'Main', loginOnly: false };
  }
}

function AppBoot() {
  // Wait for AsyncStorage session restore before choosing Entry vs Main
  const [showSplash, setShowSplash] = useState(true);
  const [bootReady, setBootReady] = useState(false);
  /** Default ARENA — never block first paint with a registration wall. */
  const [initialRoute, setInitialRoute] = useState('Main');
  const [entryLoginOnly, setEntryLoginOnly] = useState(false);
  const [bootError, setBootError] = useState(null);
  const navRef = useRef(navigationRef);

  // Post-mount only — no heavy sync init at App.js module top-level
  useEffect(() => {
    try {
      enableScreens(true);
    } catch (err) {
      console.warn('[App] enableScreens failed:', err?.message || err);
    }

    try {
      if (isExpoGo) {
        void hideSplashSafe('expo-go-app');
      } else {
        void preventAutoHideSafe();
      }
    } catch (err) {
      console.warn('[App] SplashScreen init failed:', err?.message || err);
    } finally {
      logStartup('App mounted', { isExpoGo, hasSupabaseEnv: hasSupabaseEnv() });
    }
  }, []);

  // Global AV session — unlocks Arena / publish video under iOS silent switch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await configureGlobalAudioSession();
      } catch (err) {
        console.warn('[App] audio session init failed:', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    const dismissSplash = async () => {
      if (finished) return;
      finished = true;
      if (!cancelled) {
        setBootReady(true);
        setShowSplash(false);
      }
      // Always hide native splash — even if this effect already cleaned up
      await safeHideSplash('boot-dismiss');
    };

    (async () => {
      try {
        // AsyncStorage + flags — short race so Expo Go never hangs
        const bootTimeoutMs = isExpoGo ? 900 : 3500;
        let resolved = { route: 'Main', loginOnly: false };
        try {
          resolved = await Promise.race([
            resolveLaunchRoute(),
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ route: 'Main', loginOnly: false }),
                bootTimeoutMs
              )
            ),
          ]);
        } catch (sessionErr) {
          console.warn(
            'Session hydrate failed — defaulting to Arena:',
            sessionErr?.message || sessionErr
          );
          resolved = { route: 'Main', loginOnly: false };
        }
        if (!cancelled) {
          const route = resolved?.route === 'Entry' ? 'Entry' : 'Main';
          setInitialRoute(route);
          setEntryLoginOnly(Boolean(resolved?.loginOnly));
        }
      } catch (err) {
        console.warn('Session boot check failed:', err?.message || err);
        // Soft-fail — never crash; open Arena (Landing)
        if (!cancelled) {
          setInitialRoute('Main');
          setEntryLoginOnly(false);
          setBootError(null);
        }
      } finally {
        await dismissSplash();
      }
    })();

    // Hard failsafe: never stay on splash / white logo screen
    const failsafeMs = isExpoGo ? 1200 : 4500;
    const failsafe = setTimeout(() => {
      void dismissSplash();
    }, failsafeMs);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      // Cleanup still tries hide — covers fast unmount / Fast Refresh
      void safeHideSplash('boot-cleanup');
    };
  }, []);

  if (bootError) {
    return (
      <View style={styles.errorRoot}>
        <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
        <Text style={styles.errorTitle}>Boot error</Text>
        <Text style={styles.errorBody}>
          {String(bootError?.message || bootError)}
        </Text>
        <Text
          style={styles.errorRetry}
          onPress={() => {
            setBootError(null);
            setInitialRoute('Main');
            setEntryLoginOnly(false);
            setBootReady(true);
            setShowSplash(false);
            void safeHideSplash('boot-error-retry');
          }}
        >
          TAP TO CONTINUE
        </Text>
      </View>
    );
  }

  if (showSplash || !bootReady) {
    return (
      <View style={styles.jsSplash}>
        <StatusBar barStyle="light-content" backgroundColor={BOOT_BG} hidden />
        <Image
          source={require('./assets/splash_android_PROPER_1080x1920_black.png')}
          style={styles.splashImage}
          resizeMode="contain"
          onError={(e) => {
            console.warn('Splash image failed:', e?.nativeEvent?.error);
          }}
        />
        <Text style={styles.splashFallback}>BAWAAL</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
      <SafeAreaProvider style={styles.root}>
        <BawaalAlertProvider>
          <NavigationContainer theme={navTheme} ref={navigationRef}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: styles.root,
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen
                name="Entry"
                component={EntryScreen}
                initialParams={{ loginOnly: entryLoginOnly }}
              />
              <Stack.Screen name="Main" component={MainTabs} />
              {/* Central "+" create → camera + VideoPublishModal host (SPARKS / JOSH / …) */}
              <Stack.Screen
                name="UniversalCamera"
                component={CameraPublishHost}
                options={{
                  animation: 'fade',
                  presentation: 'fullScreenModal',
                  animationDuration: 150,
                }}
              />
              {/* Legacy "Challenge" route name → same camera + publish host */}
              <Stack.Screen
                name="Challenge"
                component={CameraPublishHost}
                options={{
                  animation: 'fade',
                  presentation: 'fullScreenModal',
                  animationDuration: 150,
                }}
              />
              {/* Arena / Battles RESPOND → locked viewfinder + VideoPublishModal */}
              <Stack.Screen
                name="ChallengeCam"
                component={CameraPublishHost}
                options={{
                  animation: 'fade',
                  presentation: 'fullScreenModal',
                  animationDuration: 150,
                }}
              />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen
                name="Live1v1Battle"
                component={WarCryScreen}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              {/* Alias used by UniversalCamera / BattleChallengeForm */}
              <Stack.Screen
                name="ChallengerArena"
                component={WarCryScreen}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              {/* ⚔️ BATTLE BAWAAL → challenge setup (title / reps / timer) before live arena */}
              <Stack.Screen
                name="BattleChallengeForm"
                component={BattleChallengeForm}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen name="AthleteDashboard" component={AthleteDashboard} />
              <Stack.Screen
                name="AthletePassport"
                component={AthletePassportScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Clinic"
                component={ClinicScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SportHubMap"
                component={SportHubMapScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="LiveMatchRoom"
                component={LiveMatchRoomScreen}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              {/* Legacy route names → Main tabs (deep-link / older navigate calls) */}
              <Stack.Screen
                name="Arena"
                component={MainTabs}
                initialParams={{ tab: 'Arena' }}
              />
              <Stack.Screen
                name="Profile"
                component={MainTabs}
                initialParams={{ tab: 'Passport' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          {bootReady ? (
            <LiveMatchInviteHost navigationRef={navRef} />
          ) : null}
        </BawaalAlertProvider>
      </SafeAreaProvider>
    </View>
  );
}

function MissingSupabaseEnvScreen() {
  useEffect(() => {
    void safeHideSplash('missing-supabase-env');
  }, []);

  return (
    <View style={styles.errorRoot}>
      <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
      <Text style={styles.errorTitle}>BAWAAL</Text>
      <Text style={styles.errorBody}>
        Missing Supabase Environment Variables
      </Text>
      <Text style={[styles.errorBody, { marginTop: 12 }]}>
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
        (local) or eas.json env (EAS APK builds). The client will not throw —
        rebuild with those keys baked in to continue.
      </Text>
    </View>
  );
}

/**
 * Inner boundary — index.js CrashBoundary is the outermost wrapper.
 * Missing EXPO_PUBLIC_* keys soft-fail: show a recoverable banner screen only
 * when env is absent; createClient in lib/supabase.js never throws at import.
 */
export default function App() {
  if (!hasSupabaseEnv()) {
    console.warn(
      '[App] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — ' +
        'showing soft env screen (createClient uses inert placeholder).'
    );
    return (
      <RootErrorBoundary>
        <MissingSupabaseEnvScreen />
      </RootErrorBoundary>
    );
  }

  return (
    <RootErrorBoundary>
      <AppBoot />
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ROOT_BG,
  },
  jsSplash: {
    flex: 1,
    backgroundColor: BOOT_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: '100%',
    height: '70%',
    maxWidth: 420,
  },
  splashFallback: {
    position: 'absolute',
    bottom: 64,
    color: COLORS.PLATINUM_BASE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: ROOT_BG,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  errorTitle: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 1,
  },
  errorBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 20,
  },
  errorStack: {
    color: 'rgba(255,42,95,0.85)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
  },
  errorScroll: {
    maxHeight: 320,
    marginBottom: 20,
  },
  errorRetry: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 12,
  },
});
