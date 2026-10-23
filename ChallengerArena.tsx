/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * AGORA CAMERA:
 *   PermissionsAndroid CAMERA + RECORD_AUDIO
 *   → enableVideo() → startPreview()
 *   → <RtcSurfaceView canvas={{ uid: 0 }} style={absolute full bleed} />
 *   Cam off → STANDBY overlay
 *
 * HUD DECOUPLING:
 *   isAthlete = HOST | RIVAL  → Flip/Mute/Cam only (no vote / stats / LIVE chrome)
 *   isSpectator              → vote bar + gloves + banter (+ REPS / LIVE)
 *
 * Implementation: ./Live1v1BattleScreen.js
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
