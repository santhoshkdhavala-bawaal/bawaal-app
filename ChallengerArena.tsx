/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * Spectator HUD — CHALLENGERS drawer (Watch mode):
 *   style={{ position: 'absolute', top: 95, left: 16, zIndex: 999 }}
 *
 * Dual 1v1 stage column:
 *   flex:1 · column · space-between · paddingVertical:16
 *   Host tile (h:210) → VS badge → Rival tile (h:210)
 *
 * Local camera tile (Host / Challenger) — persistent wrapper:
 *   isCameraOn true  → <RtcSurfaceView canvas={{ uid: 0 }} />
 *   isCameraOn false → Flag + @handle + STANDBY
 *   Outer View does NOT unmount when toggling camera.
 *
 * handleCameraToggle / enableLocalCamera():
 *   Android: PermissionsAndroid.requestMultiple([CAMERA, RECORD_AUDIO])
 *   then: enableVideo() → startPreview()  // startPreview MUST run
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
