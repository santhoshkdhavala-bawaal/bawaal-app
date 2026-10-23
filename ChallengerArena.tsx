/**
 * ChallengerArena — Agora-backed Live Arena entry + local camera tile helpers.
 *
 * Local video rule:
 * - isCamOn === true  → <RtcSurfaceView canvas={{ uid: 0 }} />
 * - isCamOn === false → STANDBY flag placeholder (via fallback)
 */
export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export { default } from './Live1v1BattleScreen';
