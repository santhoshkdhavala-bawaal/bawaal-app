/**
 * Native LiveKit stage for BAWAAL LIVE room.
 * Renders under locked HUD overlays — does not own INVITE / score / banter / skulls.
 */
import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  isTrackReference,
} from '@livekit/react-native';
import { Track } from 'livekit-client';

function facingModeFromFacing(facing) {
  return String(facing || '').toLowerCase() === 'front' ? 'user' : 'environment';
}

const LiveKitStageBody = memo(function LiveKitStageBody({
  isHost,
  facing,
  fallback,
}) {
  const tracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });

  const localCam = tracks.find(
    (t) => isTrackReference(t) && t.participant?.isLocal
  );
  const remoteCam = tracks.find(
    (t) => isTrackReference(t) && !t.participant?.isLocal
  );

  const localTrack = localCam?.publication?.track;

  // Host flip — restart local camera with facingMode (front=user / back=environment)
  useEffect(() => {
    if (!isHost || !localTrack) return undefined;
    if (typeof localTrack.restartTrack !== 'function') return undefined;
    void localTrack
      .restartTrack({ facingMode: facingModeFromFacing(facing) })
      .catch(() => {
        /* soft-fail flip on devices without dual camera */
      });
    return undefined;
  }, [isHost, facing, localTrack]);

  if (isHost) {
    if (localCam && isTrackReference(localCam)) {
      return (
        <VideoTrack
          trackRef={localCam}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={String(facing || '').toLowerCase() === 'front'}
        />
      );
    }
    return fallback || null;
  }

  if (remoteCam && isTrackReference(remoteCam)) {
    return (
      <VideoTrack
        trackRef={remoteCam}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
      />
    );
  }

  return fallback || null;
});

function LiveMatchLiveKitStage({
  token,
  serverUrl,
  isHost = false,
  facing = 'back',
  fallback = null,
}) {
  const tok = String(token || '').trim();
  const url = String(serverUrl || '').trim();
  if (!tok || !url) return fallback;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LiveKitRoom
        token={tok}
        serverUrl={url}
        connect
        audio
        video={!!isHost}
        onError={() => {
          /* keep HUD; parent fallback still under overlays if reconnect fails */
        }}
      >
        <LiveKitStageBody
          isHost={!!isHost}
          facing={facing}
          fallback={fallback}
        />
      </LiveKitRoom>
    </View>
  );
}

export default memo(LiveMatchLiveKitStage);
