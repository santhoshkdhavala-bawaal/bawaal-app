/**
 * Local Host / Rival Agora preview tile.
 * isCamOn → RtcSurfaceView canvas={{ uid: 0 }}; otherwise STANDBY fallback.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getAgoraSdk, isAgoraConfigured } from '../services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;

export type ArenaLocalVideoProps = {
  isCamOn: boolean;
  style?: StyleProp<ViewStyle>;
  fallback?: React.ReactNode;
};

export function ArenaLocalVideo({
  isCamOn,
  style,
  fallback = null,
}: ArenaLocalVideoProps) {
  const canPreview = Boolean(isCamOn && isAgoraConfigured() && RtcSurfaceView);

  if (canPreview) {
    return (
      <View style={[styles.cameraView, style]} pointerEvents="none">
        <RtcSurfaceView
          style={StyleSheet.absoluteFillObject}
          canvas={{ uid: 0 }}
        />
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
});

export default ArenaLocalVideo;
