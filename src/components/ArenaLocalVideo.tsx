/**
 * Local Host / Rival Agora preview tile.
 * isCameraOn → RtcSurfaceView canvas={{ uid: 0 }}; otherwise STANDBY fallback.
 * If native Agora surface fails → clean "Camera Active" frame (not black).
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getAgoraSdk, isAgoraConfigured } from '../services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  /** @deprecated use isCameraOn */
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  /** STANDBY (flag/handle) when camera is OFF. */
  fallback?: React.ReactNode;
};

class LocalSurfaceBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(
      '[ArenaLocalVideo] RtcSurfaceView failed',
      error?.message || error,
      info?.componentStack
    );
  }

  render() {
    if (this.state.failed) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

function CameraActivePlaceholder() {
  return (
    <View style={styles.activePlaceholder} pointerEvents="none">
      <View style={styles.activeDot} />
      <Text style={styles.activeLabel}>CAMERA ACTIVE</Text>
      <Text style={styles.activeHint}>Preview reconnecting…</Text>
    </View>
  );
}

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  fallback = null,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);
  const canPreview = Boolean(on && isAgoraConfigured() && RtcSurfaceView);

  if (!on) {
    return <>{fallback}</>;
  }

  if (!canPreview) {
    // Native Agora unavailable (e.g. Expo Go) — avoid black frame.
    return (
      <View style={[styles.cameraView, style]} pointerEvents="none">
        <CameraActivePlaceholder />
      </View>
    );
  }

  return (
    <View style={[styles.cameraView, style]} pointerEvents="none">
      <LocalSurfaceBoundary fallback={<CameraActivePlaceholder />}>
        <RtcSurfaceView
          style={styles.surface}
          canvas={{ uid: 0 }}
        />
      </LocalSurfaceBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraView: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: '#0A1018',
  },
  surface: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  activePlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121A24',
    gap: 6,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginBottom: 4,
  },
  activeLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  activeHint: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ArenaLocalVideo;
