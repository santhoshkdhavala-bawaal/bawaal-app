/**
 * Persistent local athlete video wrapper.
 * Outer View never unmounts on Cam On/Off — only children swap:
 *   isCameraOn true  → <RtcSurfaceView canvas={{ uid: 0 }} />
 *   isCameraOn false → STANDBY placeholder (flag + handle) via `fallback`
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
const RenderModeType = AgoraSdk?.RenderModeType;
const VideoSourceType = AgoraSdk?.VideoSourceType;

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  /** Alias used by Challenger Arena HUD. */
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Flag + handle + STANDBY — rendered inside the same wrapper when camera is OFF. */
  fallback?: ReactNode;
};

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  fallback = null,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);

  return (
    <View style={[styles.cameraView, style]} pointerEvents="none">
      {on && RtcSurfaceView ? (
        <RtcSurfaceView
          style={styles.surface}
          canvas={{
            uid: 0,
            sourceType: VideoSourceType?.VideoSourceCamera ?? 0,
            renderMode: RenderModeType?.RenderModeHidden ?? 1,
          }}
          zOrderMediaOverlay
        />
      ) : on ? null : (
        fallback
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraView: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  surface: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default ArenaLocalVideo;
