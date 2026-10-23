/**
 * ChallengerArena — Live 1v1 arena entry.
 *
 * Spectator HUD: CHALLENGERS pill
 *   position absolute · top 85 · left 15 · zIndex 99 (below Host @handle).
 *
 * Local camera (Host / Challenger @handle frame):
 *   isCamOn true  → init engine → enableVideo → startPreview →
 *                   <RtcSurfaceView canvas={{ uid: 0 }} style={{ flex:1, width:'100%', height:'100%' }} />
 *                   (no "Preview reconnecting…" / STANDBY overlay)
 *   isCamOn false → Flag + @handle + "STANDBY"
 *
 * Engine init is owned by `agoraService.ensureLocalPreview` / `initAgoraEngine`:
 *   createAgoraRtcEngine() → initialize({ appId }) → enableVideo() → startPreview()
 *
 * Requires Dev Client / EAS development build (not Expo Go).
 */
export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export {
  initAgoraEngine,
  ensureLocalPreview,
  setLocalCameraEnabled,
  startBroadcasterPreview,
} from './src/services/agoraService';
export { default } from './Live1v1BattleScreen';
