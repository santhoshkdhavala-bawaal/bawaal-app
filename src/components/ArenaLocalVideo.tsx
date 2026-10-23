/**
 * Local Host / Rival Agora preview tile.
 * isCameraOn → RtcSurfaceView canvas={{ uid: 0 }}; otherwise STANDBY fallback.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getAgoraSdk, isAgoraConfigured } from '../services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  /** @deprecated use isCameraOn */
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  fallback?: React.ReactNode;
};

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  fallback = null,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);
  const canPreview = Boolean(on && isAgoraConfigured() && RtcSurfaceView);

  if (canPreview) {
    return (
      <View style={[styles.cameraView, style]} pointerEvents="none">
        <RtcSurfaceView style={styles.surface} canvas={{ uid: 0 }} />
      </View>
    );
  }

  return <>{fallback}</>;
}

const styles = StyleSheet.create({
  cameraView: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  surface: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default ArenaLocalVideo;
