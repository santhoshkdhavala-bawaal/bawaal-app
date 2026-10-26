import React, { Component, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import * as SplashScreen from 'expo-splash-screen';
import MainTabs from './MainTabs';
import UniversalCamera from './UniversalCamera';
import BattleChallengeForm from './BattleChallengeForm';
import LeaderboardScreen from './LeaderboardScreen';
import Live1v1BattleScreen from './ChallengerArena';
import RoleSelection from './RoleSelection';
import AthleteDashboard from './AthleteDashboard';
import { COLORS } from './theme';
import { getRegisteredSession, setRegisteredSession } from './sessionStore';

enableScreens(true);

// Keep native splash visible until session boot finishes (avoids black flash)
SplashScreen.preventAutoHideAsync().catch(() => {});

const ROOT_BG = '#000000';

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

/** Surfaces render crashes instead of a blank black screen. */
export class RootErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn('Root render error:', error?.message || error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
          <Text style={styles.errorTitle}>BAWAAL failed to start</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorBody}>
              {String(this.state.error?.message || this.state.error)}
            </Text>
            {!!this.state.info?.componentStack && (
              <Text style={styles.errorStack}>{this.state.info.componentStack}</Text>
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

function EntryScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <RoleSelection
        onCompleteRegistration={async (userData) => {
          try {
            await setRegisteredSession(userData || {});
          } catch (err) {
            console.warn('Failed to persist registration:', err?.message || err);
          }
          navigation.replace('Main', { tab: 'Arena' });
        }}
      />
    </View>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [bootReady, setBootReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Entry');
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getRegisteredSession();
        // Returning registered users skip onboarding → BAWAAL Arena (Main tabs)
        if (!cancelled && session?.registered) {
          setInitialRoute('Main');
        }
      } catch (err) {
        console.warn('Session boot check failed:', err?.message || err);
      } finally {
        if (cancelled) return;
        try {
          setBootReady(true);
          setShowSplash(false);
          // Hide native splash only after first JS frame is ready to paint Arena
          await SplashScreen.hideAsync().catch(() => {});
        } catch (err) {
          setBootError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <View style={styles.errorRoot}>
        <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
        <Text style={styles.errorTitle}>Boot error</Text>
        <Text style={styles.errorBody}>{String(bootError?.message || bootError)}</Text>
      </View>
    );
  }

  if (showSplash || !bootReady) {
    return (
      <View style={styles.jsSplash}>
        <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} hidden />
        <Image
          source={require('./assets/splash_v2.png')}
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
      <RootErrorBoundary>
        <SafeAreaProvider style={styles.root}>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: styles.root,
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen name="Entry" component={EntryScreen} />
              <Stack.Screen name="Main" component={MainTabs} />
              {/* Central "+" create → UniversalCamera (SPARKS / JOSH / REWIND / BAWAAL) */}
              <Stack.Screen
                name="UniversalCamera"
                component={UniversalCamera}
                options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
              />
              {/* Legacy "Challenge" route name → same Universal Creation Engine */}
              <Stack.Screen
                name="Challenge"
                component={UniversalCamera}
                options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
              />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen
                name="Live1v1Battle"
                component={Live1v1BattleScreen}
                options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
              />
              {/* Alias used by UniversalCamera / BattleChallengeForm */}
              <Stack.Screen
                name="ChallengerArena"
                component={Live1v1BattleScreen}
                options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
              />
              {/* ⚔️ BATTLE BAWAAL → challenge setup (title / reps / timer) before live arena */}
              <Stack.Screen
                name="BattleChallengeForm"
                component={BattleChallengeForm}
                options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
              />
              <Stack.Screen name="AthleteDashboard" component={AthleteDashboard} />
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
        </SafeAreaProvider>
      </RootErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ROOT_BG,
  },
  jsSplash: {
    flex: 1,
    backgroundColor: ROOT_BG,
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
