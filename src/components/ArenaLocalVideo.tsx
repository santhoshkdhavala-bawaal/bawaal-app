/**
 * Full-bleed athlete video surface inside a 50% Host / Rival viewport.
 * Never uses fixed card heights — always absolute fill of the parent half.
 */
import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getAgoraSdk } from '../services/agoraService';

const AgoraSdk = getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const RenderModeType = AgoraSdk?.RenderModeType;
const VideoSourceType = AgoraSdk?.VideoSourceType;

/** Full-bleed fill — prevents 0-height / card collapse inside flex halves. */
const FULL_BLEED = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%' as const,
  height: '100%' as const,
};

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  handle?: string;
  flag?: string;
  fallback?: ReactNode;
  remoteUid?: number;
};

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  handle = '@ATHLETE',
  flag = '🌐',
  fallback = null,
  remoteUid,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);
  const uid = Number(remoteUid) || 0;
  const isRemote = uid > 0;

  return (
    <View style={[styles.viewportFill, style]} pointerEvents="none">
      {on && RtcSurfaceView ? (
        <RtcSurfaceView
          canvas={{
            uid: isRemote ? uid : 0,
            sourceType: isRemote
              ? VideoSourceType?.VideoSourceRemote ?? 1
              : VideoSourceType?.VideoSourceCamera ?? 0,
            renderMode: RenderModeType?.RenderModeHidden ?? 1,
          }}
          style={styles.fullBleed}
          zOrderMediaOverlay
        />
      ) : on ? null : fallback ? (
        fallback
      ) : (
        <View style={styles.standbyPlaceholder}>
          <Text style={styles.flagEmoji}>{flag}</Text>
          <Text style={styles.standbyHandle} numberOfLines={1}>
            {handle}
          </Text>
          <Text style={styles.standbySub}>STANDBY</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullBleed: {
    ...FULL_BLEED,
  },
  viewportFill: {
    ...FULL_BLEED,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  standbyPlaceholder: {
    ...FULL_BLEED,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  flagEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  standbyHandle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  standbySub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default ArenaLocalVideo;
