/**
 * Metro stub for `react-native-agora` while bundling for Expo Go.
 * Prevents the real native package from entering the dependency graph.
 */
import { MOCK_AGORA_SDK } from '../nativeMocks';

export const createAgoraRtcEngine = MOCK_AGORA_SDK.createAgoraRtcEngine;
export const RtcSurfaceView = MOCK_AGORA_SDK.RtcSurfaceView;
export const RenderModeType = MOCK_AGORA_SDK.RenderModeType;
export const VideoSourceType = MOCK_AGORA_SDK.VideoSourceType;
export const ChannelProfileType = MOCK_AGORA_SDK.ChannelProfileType;
export const ClientRoleType = MOCK_AGORA_SDK.ClientRoleType;

export default MOCK_AGORA_SDK;
export { MOCK_AGORA_SDK };
