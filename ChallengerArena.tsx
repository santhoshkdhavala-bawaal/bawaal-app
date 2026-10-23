/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * STRICT 50/50 viewport:
 *   column flex:1 · bg #0A0E1A
 *   Host half flex:1 · Rival half flex:1
 *   VS badge absolute center (translate -50%)
 *
 * Host half overlays (top: insets.top+10):
 *   left: Host badge + CHALLENGERS (spectator)
 *   right: REPS / LIVE
 *
 * Rival half overlays (bottom: isAthlete ? 100 : 16):
 *   left: Rival badge · right: REPS
 *
 * Camera: isCameraOn → RtcSurfaceView; else flag + @handle + STANDBY
 *
 * HUD decoupling:
 *   isAthlete → athleteControlsContainer only
 *   isSpectator → spectatorBottomContainer only
 *
 * Implementation: Live1v1BattleScreen.js (default export).
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
