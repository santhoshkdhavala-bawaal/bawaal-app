/**
 * Pure-JS stand-ins for native media modules.
 * No expo-av / react-native-agora imports — safe for Expo Go bundling.
 */

import React from 'react';
import { View } from 'react-native';

/** Drop-in <Video> that renders nothing (SafeFeedVideo uses SportsFeedPlaceholder instead). */
function MockVideo() {
  return null;
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
