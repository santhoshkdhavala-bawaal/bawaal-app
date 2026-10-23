/**
 * ChallengerArena — Agora-backed Live Arena entry + local camera tile helpers.
 *
 * Spectator HUD: CHALLENGERS pill at top:75 / left:15 (below Host handle).
 * Local video:
 * - isCameraOn === true  → permissions → enableVideo + startPreview + RtcSurfaceView uid:0
 * - isCameraOn === false → STANDBY flag placeholder
 * - Native fail → "Camera Active" frame (never black)
 *
 * Native Agora requires a Dev Client / EAS development build (not Expo Go):
 *   npx expo run:android
 *   npx eas-cli@latest build --profile development --platform android
 */
export { ArenaLocalVideo } from './src/components/ArenaLocalVideo';
export type { ArenaLocalVideoProps } from './src/components/ArenaLocalVideo';
export { default } from './Live1v1BattleScreen';
