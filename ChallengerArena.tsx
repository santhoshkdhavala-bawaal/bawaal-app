/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * Spectator HUD — CHALLENGERS drawer (Watch mode):
 *   style={{ position: 'absolute', top: 95, left: 16, zIndex: 999 }}
 *
 * Dual 1v1 stage column:
 *   flex:1 · column · space-between · paddingVertical:16
 *   Host tile (h:180) → VS badge → Rival tile (h:180)
 *
 * Athlete box (@SANTHOSH / Host) — persistent wrapper:
 *   height 180 · borderRadius 12 · bg #0f172a
 *   isCameraOn true  → <RtcSurfaceView canvas={{ uid: 0 }} /> absolute fill
 *   isCameraOn false → flag + @handle + STANDBY
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
