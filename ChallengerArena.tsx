/**
 * ChallengerArena — BAWAAL Live 1v1 Arena (production entry).
 *
 * ============================================================================
 * STRICT 50/50 VIEWPORT
 * ============================================================================
 * column flex:1 · bg #0A0E1A
 *
 * HOST HALF — flex:1 · relative · overflow hidden · borderBottomWidth:1
 *   Video: RtcSurfaceView StyleSheet.absoluteFillObject OR STANDBY
 *   Top-left (paddingTop: insets.top+10): [HOST] badge + CHALLENGERS (spectator)
 *   Top-right (paddingTop: insets.top+10): REPS
 *
 * VS — absolute top 50% · translateX/Y -20 · zIndex 100
 *
 * RIVAL HALF — flex:1 · relative · overflow hidden
 *   Video: RtcSurfaceView absoluteFillObject OR STANDBY
 *   Bottom-left / bottom-right: badge + REPS at bottom: isAthlete ? 80 : 10
 *
 * ============================================================================
 * HUD ROLE DECOUPLING (never mount both)
 * ============================================================================
 *   const isAthlete = userRole === 'HOST' || userRole === 'RIVAL'
 *   const isSpectator = !isAthlete
 *
 * isSpectator → bottom: insets.bottom+12 · zIndex 1000
 *   Vote progress + VOTE HOST / BANTER / VOTE RIVAL
 *
 * isAthlete → bottom: insets.bottom+12 · zIndex 1000
 *   Flip / Mute / Cam On|Off only (vote stats vanish)
 *
 * Full screen implementation: ./Live1v1BattleScreen.js
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
