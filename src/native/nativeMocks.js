/**
 * Pure-JS stand-ins for native media modules.
 * No expo-av / react-native-agora imports — safe for Expo Go bundling.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Drop-in <Video> — solid black container (never touches ExponentAV). */
function MockVideo({ style, ...rest }) {
  return (
    <View
      {...rest}
      style={[mockStyles.black, style]}
      pointerEvents="none"
      accessibilityLabel="Video unavailable in Expo Go"
    />
  );
}

MockVideo.displayName = 'MockExpoAvVideo';

export const MOCK_EXPO_AV = Object.freeze({
  Video: MockVideo,
  ResizeMode: Object.freeze({
    CONTAIN: 'contain',
    COVER: 'cover',
    STRETCH: 'stretch',
  }),
});

const mockStyles = StyleSheet.create({
  black: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
});

function MockRtcSurfaceView(props) {
  return React.createElement(View, props);
}

MockRtcSurfaceView.displayName = 'MockRtcSurfaceView';

function mockEngine() {
  const noop = () => {};
  return {
    initialize: noop,
    enableVideo: noop,
    enableAudio: noop,
    enableLocalVideo: noop,
    enableLocalAudio: noop,
    muteLocalVideoStream: noop,
    muteLocalAudioStream: noop,
    startPreview: noop,
    stopPreview: noop,
    joinChannel: noop,
    leaveChannel: noop,
    switchCamera: noop,
    release: noop,
    registerEventHandler: noop,
    unregisterEventHandler: noop,
    setChannelProfile: noop,
    setClientRole: noop,
  };
}

export const MOCK_AGORA_SDK = Object.freeze({
  createAgoraRtcEngine: mockEngine,
  RtcSurfaceView: MockRtcSurfaceView,
  RenderModeType: Object.freeze({
    RenderModeHidden: 0,
    RenderModeFit: 1,
    RenderModeAdaptive: 2,
  }),
  VideoSourceType: Object.freeze({
    VideoSourceCameraPrimary: 0,
    VideoSourceCamera: 0,
    VideoSourceRemote: 1,
  }),
  ChannelProfileType: Object.freeze({
    ChannelProfileCommunication: 0,
    ChannelProfileLiveBroadcasting: 1,
  }),
  ClientRoleType: Object.freeze({
    ClientRoleBroadcaster: 1,
    ClientRoleAudience: 2,
  }),
});

export default {
  MOCK_EXPO_AV,
  MOCK_AGORA_SDK,
};
