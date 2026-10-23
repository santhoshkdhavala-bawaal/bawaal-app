/**
 * Local athlete Agora preview.
 * isCamOn / isCameraOn true  → RtcSurfaceView canvas={{ uid: 0 }} only (no placeholder copy).
 * false → caller-provided STANDBY (flag + handle) via `fallback`.
 */
import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getAgoraSdk } from '../services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  /** Alias used by Challenger Arena HUD. */
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Flag + handle + STANDBY — only used when camera is OFF. */
  fallback?: ReactNode;
};

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  fallback = null,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);

  if (!on) {
    return <>{fallback}</>;
  }

  // Camera ON: always mount local surface (uid 0). Never show "Preview reconnecting…".
  if (!RtcSurfaceView) {
    return <View style={[styles.cameraView, style]} pointerEvents="none" />;
  }

  return (
    <View style={[styles.cameraView, style]} pointerEvents="none">
      <RtcSurfaceView
        style={styles.surface}
        canvas={{ uid: 0 }}
      />
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
});

export default ArenaLocalVideo;
