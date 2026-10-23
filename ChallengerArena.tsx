/**
 * ChallengerArena — Agora-backed Live Arena entry + local camera tile helpers.
 *
 * Local video rule:
 * - isCameraOn === true  → enableVideo + startPreview + <RtcSurfaceView canvas={{ uid: 0 }} />
 * - isCameraOn === false → stop local video + STANDBY flag (never "CAMERA OFF" copy)
 */
export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export { default } from './Live1v1BattleScreen';
