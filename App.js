import React, { Component } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import ArenaFeed from './ArenaFeed';
import ChallengeScreen from './ChallengeScreen';
import ProfileScreen from './ProfileScreen';

enableScreens(true);

const Stack = createNativeStackNavigator();
const CANVAS = '#050505';

const navTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: '#FF6B00',
    background: CANVAS,
    card: CANVAS,
    text: '#ffffff',
    border: 'rgba(255,255,255,0.08)',
    notification: '#FF6B00',
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
          <StatusBar barStyle="light-content" backgroundColor={CANVAS} />
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
      <StatusBar barStyle="light-content" backgroundColor={CANVAS} />
      <RootErrorBoundary>
        <SafeAreaProvider style={styles.root}>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              initialRouteName="Arena"
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: CANVAS, flex: 1 },
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen name="Arena" component={ArenaFeed} />
              <Stack.Screen name="Challenge" component={ChallengeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
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
    backgroundColor: CANVAS,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: CANVAS,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#FF6B00',
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
