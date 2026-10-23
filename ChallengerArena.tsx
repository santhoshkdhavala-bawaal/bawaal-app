/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * Role decoupling (never mount spectator + athlete overlays together):
 *   const userRole = HOST | RIVAL | SPECTATOR
 *   const isAthlete = userRole === 'HOST' || userRole === 'RIVAL'
 *   const isSpectator = !isAthlete
 *
 * isSpectator → spectatorBottomContainer (bottom: 20, zIndex: 1000)
 *   Vote % bar + Banter / gloves ONLY
 *
 * isAthlete → athleteControlsContainer (bottom: 30, zIndex: 1000)
 *   Flip / Mute / Cam On|Off ONLY
 *
 * Rival card: marginBottom 60 so controls never cover handle / STANDBY.
 *
 * Safe area: root paddingTop = insets.top + 10
 * Left header: Host badge + CHALLENGERS (spectator) stacked gap 8
 *
 * Implementation lives in Live1v1BattleScreen.js (default export).
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
