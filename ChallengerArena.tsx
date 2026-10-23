/**
 * ChallengerArena — Live 1v1 arena entry.
 *
 * Local camera (enter Arena / Cam On) → `enableLocalCamera()`:
 *   Android: PermissionsAndroid.requestMultiple([CAMERA, RECORD_AUDIO])
 *   then: enableAudio() → enableVideo() → startPreview()  // startPreview MUST run
 *   then: <RtcSurfaceView canvas={{ uid: 0 }} />
 *
 * Cam Off → Flag + @handle + STANDBY
 *
 * Requires Dev Client / EAS development build (not Expo Go).
 */
export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export {
  enableLocalCamera,
  initAgoraEngine,
  ensureLocalPreview,
  setLocalCameraEnabled,
  startBroadcasterPreview,
} from './src/services/agoraService';
export { default } from './Live1v1BattleScreen';
