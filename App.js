import React, { Component, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import * as SplashScreen from 'expo-splash-screen';
import ArenaFeed from './ArenaFeed';
import ChallengeScreen from './ChallengeScreen';
import ProfileScreen from './ProfileScreen';
import LeaderboardScreen from './LeaderboardScreen';
import RoleSelection from './RoleSelection';
import { COLORS } from './theme';

enableScreens(true);

// Top-level hide (also invoked from index.js) — no wait for first paint.
SplashScreen.hideAsync().catch(() => {});

const ROOT_BG = '#05070A';

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

/** Surfaces silent render crashes instead of a blank white screen. */
class RootErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn('Root render error:', error?.message || error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} />
          <Text style={styles.errorTitle}>BAWAAL failed to start</Text>
          <Text style={styles.errorBody}>{String(this.state.error?.message || this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Landing / entry — never mounts Arena on first paint. */
function EntryScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <RoleSelection
        onCompleteRegistration={() => {
          navigation.replace('Arena');
        }}
      />
    </View>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Dismiss Expo native splash immediately — JS Obsidian splash is already painting.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      /* ignore */
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // In-app Obsidian splash on first paint (bypasses native asset cache).
  if (showSplash) {
    return (
      <View style={styles.jsSplash}>
        <StatusBar barStyle="light-content" backgroundColor={ROOT_BG} hidden />
        <Image
          source={require('./assets/splash_v2.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
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
              initialRouteName="Entry"
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: styles.root,
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen name="Entry" component={EntryScreen} />
              <Stack.Screen name="Arena" component={ArenaFeed} />
              <Stack.Screen name="Challenge" component={ChallengeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
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
  errorRoot: {
    flex: 1,
    backgroundColor: ROOT_BG,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: COLORS.PLATINUM_BASE,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 1,
  },
  errorBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 20,
  },
});
