import React, { Component } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import ArenaFeed from './ArenaFeed';
import ChallengeScreen from './ChallengeScreen';
import ProfileScreen from './ProfileScreen';
import LeaderboardScreen from './LeaderboardScreen';
import { COLORS } from './theme';

enableScreens(true);

const Stack = createNativeStackNavigator();
const navTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.PLATINUM_BASE,
    background: COLORS.BACKGROUND_OBSIDIAN,
    card: COLORS.BACKGROUND_OBSIDIAN,
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
          <StatusBar barStyle="light-content" backgroundColor={COLORS.BACKGROUND_OBSIDIAN} />
          <Text style={styles.errorTitle}>BAWAAL failed to start</Text>
          <Text style={styles.errorBody}>{String(this.state.error?.message || this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BACKGROUND_OBSIDIAN} />
      <RootErrorBoundary>
        <SafeAreaProvider style={styles.root}>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              initialRouteName="Arena"
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: COLORS.BACKGROUND_OBSIDIAN, flex: 1 },
                freezeOnBlur: true,
              }}
            >
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
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_OBSIDIAN,
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
