/**
 * Full-bleed local / remote Agora surface inside a 50% Host / Rival half.
 * isCamOn → RtcSurfaceView absolute fill (uid 0 local); else STANDBY overlay.
 * Expo Go → SportsFeedPlaceholder (no native RTC binary).
 */
import React, { useEffect, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  enableLocalCamera,
  getAgoraSdk,
  getEngine,
} from '../services/agoraService';
import { isExpoGo } from '../utils/runtimeEnv';
import SportsFeedPlaceholder from './SportsFeedPlaceholder';

const AgoraSdk = isExpoGo ? null : getAgoraSdk();
const RtcSurfaceView = AgoraSdk?.RtcSurfaceView || null;
const RenderModeType = AgoraSdk?.RenderModeType;
const VideoSourceType = AgoraSdk?.VideoSourceType;

/** Camera canvas — absolute fill of the 50% Host / Rival half (no collapse). */
const FULL_BLEED = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
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

  // Local cam ON → reinforce enableVideo + startPreview (black screen without this).
  useEffect(() => {
    if (isExpoGo || !RtcSurfaceView || !on || isRemote) return undefined;
    let cancelled = false;
    (async () => {
      const engine = getEngine();
      if (engine) {
        try {
          engine.enableVideo();
          engine.enableLocalVideo(true);
          engine.muteLocalVideoStream(false);
          engine.startPreview();
        } catch {
          if (!cancelled) await enableLocalCamera();
        }
      } else {
        await enableLocalCamera();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [on, isRemote]);

  if (isExpoGo || !RtcSurfaceView) {
    return (
      <View style={[styles.viewportFill, style]} pointerEvents="none">
        {fallback || (
          <SportsFeedPlaceholder
            style={styles.rtcSurface}
            variant="live"
            handle={handle}
            label={on ? 'CAM PREVIEW' : 'STANDBY'}
            subtitle={isExpoGo ? 'Agora offline in Expo Go' : 'RTC surface unavailable'}
            seed={uid || handle?.length || 0}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.viewportFill, style]} pointerEvents="none">
      {on && RtcSurfaceView ? (
        <RtcSurfaceView
          canvas={
            isRemote
              ? {
                  uid,
                  sourceType: VideoSourceType?.VideoSourceRemote ?? 1,
                  renderMode: RenderModeType?.RenderModeFit ?? 1,
                }
              : {
                  uid: 0,
                  renderMode: RenderModeType?.RenderModeFit ?? 1,
                }
          }
          style={styles.rtcSurface}
          zOrderMediaOverlay
        />
      ) : on ? null : fallback ? (
        fallback
      ) : (
        <View style={styles.standbyOverlay}>
          <Text style={styles.flagEmoji}>{flag}</Text>
          <Text style={styles.standbyHandle} numberOfLines={1}>
            {handle}
          </Text>
          <Text style={styles.standbyText}>STANDBY</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewportFill: {
    ...FULL_BLEED,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    zIndex: 0,
  },
  rtcSurface: {
    ...FULL_BLEED,
    zIndex: 1,
  },
  standbyOverlay: {
    ...FULL_BLEED,
    zIndex: 1,
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
  standbyText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default ArenaLocalVideo;
