/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * ROLE ISOLATION (top of render):
 *   const isAthlete = userRole === 'HOST' || userRole === 'RIVAL'
 *   const isSpectator = !isAthlete
 *
 * SPECTATOR HUD — only when isSpectator:
 *   position absolute · bottom: insets.bottom+10 · left/right 0 · zIndex 999
 *   Vote progress + VOTE HOST / BANTER / VOTE RIVAL
 *
 * ATHLETE CONTROLS — only when isAthlete:
 *   position absolute · bottom: insets.bottom+10 · left/right 0 · zIndex 999
 *   Flip / Mute / Cam On|Off
 *
 * 50/50 SPLIT (no spill / no fixed card heights):
 *   Parent: { flex: 1, backgroundColor: '#0A0E1A' }
 *   Host half / Rival half: { flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }
 *   RtcSurfaceView: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }
 *
 * Full screen implementation lives in Live1v1BattleScreen.js
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
