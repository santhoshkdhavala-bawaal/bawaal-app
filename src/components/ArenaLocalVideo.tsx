/**
 * Athlete box inside Host / Rival (@SANTHOSH) tile.
 * Persistent wrapper (never unmounts on cam toggle):
 *   isCameraOn true  → RtcSurfaceView canvas={{ uid: 0 }} absolute fill
 *   isCameraOn false → flag + @handle + STANDBY
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

export type ArenaLocalVideoProps = {
  isCameraOn: boolean;
  /** Alias used by Challenger Arena HUD. */
  isCamOn?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Athlete handle shown on STANDBY (e.g. @SANTHOSH). */
  handle?: string;
  /** Flag emoji / glyph when camera is off. */
  flag?: string;
  /** Optional custom STANDBY body (overrides built-in placeholder). */
  fallback?: ReactNode;
};

export function ArenaLocalVideo({
  isCameraOn,
  isCamOn,
  style,
  handle = '@ATHLETE',
  flag = '🌐',
  fallback = null,
}: ArenaLocalVideoProps) {
  const on = typeof isCameraOn === 'boolean' ? isCameraOn : Boolean(isCamOn);

  return (
    <View style={[styles.athleteBox, style]} pointerEvents="none">
      {on && RtcSurfaceView ? (
        <RtcSurfaceView
          canvas={{
            uid: 0,
            sourceType: VideoSourceType?.VideoSourceCamera ?? 0,
            renderMode: RenderModeType?.RenderModeHidden ?? 1,
          }}
          style={styles.surface}
          zOrderMediaOverlay
        />
      ) : on ? null : fallback ? (
        fallback
      ) : (
        <View style={styles.standby}>
          <Text style={styles.flag} accessibilityLabel="athlete flag">
            {flag}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {handle}
          </Text>
          <Text style={styles.standbyLabel}>STANDBY</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  athleteBox: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  standby: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  flag: {
    fontSize: 28,
    width: 40,
    height: 26,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 26,
  },
  handle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  standbyLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default ArenaLocalVideo;
