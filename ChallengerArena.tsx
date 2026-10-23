/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * LAYOUT (no fixed-height cards — flex halves only):
 *   Root: flex:1 · column · bg #0A0E1A
 *   Host half / Rival half: flex:1 · width 100% · relative · overflow hidden
 *
 * VIDEO FULL BLEED (inside each half):
 *   RtcSurfaceView + STANDBY use
 *   { position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%' }
 *
 * ROLE DECOUPLING:
 *   const isAthlete = userRole === 'HOST' || userRole === 'RIVAL'
 *   const isSpectator = !isAthlete
 *   isSpectator → vote bar + VOTE HOST / BANTER / VOTE RIVAL (+ REPS / LIVE)
 *   isAthlete → Flip / Mute / Cam only (stats & voting vanish)
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
