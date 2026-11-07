import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

export class CrashBoundary extends React.Component {
  state = { hasError: false, error: null, stack: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error?.toString() || 'Unknown Error' };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ stack: errorInfo?.componentStack });
    console.error('BAWAAL Caught Startup Crash:', error, errorInfo);
    // Never leave the native splash covering a crashed tree
    SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>BAWAAL Startup Crash Caught</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.errText}>{this.state.error}</Text>
            <Text style={styles.stackText}>{this.state.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 60 },
  title: { color: '#FF3333', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  box: { backgroundColor: '#111', padding: 10, borderRadius: 6 },
  errText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  stackText: { color: '#AAA', fontSize: 11, fontFamily: 'monospace' },
});
