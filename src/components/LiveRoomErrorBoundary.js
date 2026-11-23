/**
 * Soft ErrorBoundary for LIVE room / telecast screens.
 * Prevents a stream glitch from white-screening the whole app.
 */
import React, { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BG = '#08120F';
const ORANGE = '#FF5A1F';
const WHITE = '#FFFFFF';

export default class LiveRoomErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn(
      '[LiveRoomErrorBoundary]',
      error?.message || error,
      info?.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>LIVE STREAM INTERRUPTED</Text>
          <Text style={styles.body}>
            Something went wrong in the live room. Your session is safe —
            leave and rejoin to continue.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ error: null })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Retry live room"
          >
            <Text style={styles.btnText}>TAP TO RETRY</Text>
          </TouchableOpacity>
          {typeof this.props.onExit === 'function' ? (
            <TouchableOpacity
              style={styles.link}
              onPress={this.props.onExit}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>LEAVE ROOM</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: ORANGE,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  body: {
    color: WHITE,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 22,
  },
  btn: {
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  btnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  link: {
    marginTop: 16,
    padding: 8,
  },
  linkText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    opacity: 0.75,
  },
});
