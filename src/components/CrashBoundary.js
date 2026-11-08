import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { readNativeCrashLog } from '../../NativeLogger';
import { hideSplashSafe } from '../boot/safeSplash';

/**
 * Outermost React ErrorBoundary — catches unhandled render exceptions on launch
 * and paints the raw message + stack on-device instead of a fatal crash.
 */
export class CrashBoundary extends React.Component {
  state = {
    hasError: false,
    message: null,
    jsStack: null,
    componentStack: null,
    crashFile: null,
  };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || String(error) || 'Unknown Error',
      jsStack: error?.stack || null,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      message: error?.message || String(error) || 'Unknown Error',
      jsStack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
    });
    console.error('BAWAAL Caught Startup Crash:', error, errorInfo);
    // Never leave the native splash covering a crashed tree
    void hideSplashSafe('crash-boundary');
    readNativeCrashLog()
      .then((crashFile) => this.setState({ crashFile }))
      .catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>BAWAAL Startup Crash Caught</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.errText}>{this.state.message}</Text>
            {!!this.state.jsStack && (
              <Text style={styles.stackText}>{this.state.jsStack}</Text>
            )}
            {!!this.state.componentStack && (
              <Text style={styles.stackText}>
                {'\n'}Component stack:{'\n'}
                {this.state.componentStack}
              </Text>
            )}
            {!!this.state.crashFile && (
              <Text style={styles.stackText}>
                {'\n'}Saved log:{'\n'}
                {this.state.crashFile}
              </Text>
            )}
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
