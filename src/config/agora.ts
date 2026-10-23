/**
 * Agora RTC configuration for BAWAAL Live Arena.
 * Values come from Expo public env (bundled at build time).
 *
 * Required for live publish/subscribe:
 *   EXPO_PUBLIC_AGORA_APP_ID
 * Optional (required when App Certificate is enabled in Agora Console):
 *   EXPO_PUBLIC_AGORA_TOKEN
 */

export type AgoraClientRole = 'host' | 'audience';

export type AgoraClientSettings = {
  /** Live Broadcasting profile — host publishes, audience subscribes. */
  channelProfile: 'liveBroadcasting';
  /** Prefer hardware encode when the native SDK supports it. */
  preferHardwareEncoder: boolean;
  /** Auto-subscribe remote A/V for spectators and peers. */
  autoSubscribeAudio: boolean;
  autoSubscribeVideo: boolean;
  /** Rejoin delay after disconnect (ms). */
  reconnectDelayMs: number;
  /** Max automatic rejoin attempts per session. */
  maxReconnectAttempts: number;
};

const rawAppId = String(process.env.EXPO_PUBLIC_AGORA_APP_ID || '').trim();
const rawToken = String(process.env.EXPO_PUBLIC_AGORA_TOKEN || '').trim();

/** Placeholder / empty values that must never be passed to native initialize(). */
function isUsableAgoraAppId(id: string): boolean {
  if (!id) return false;
  const upper = id.toUpperCase();
  if (upper === 'YOUR_AGORA_APP_ID') return false;
  if (upper.includes('YOUR_') || upper.includes('REPLACE')) return false;
  return true;
}

/** Agora App ID from console.agora.io (empty when unset / placeholder). */
export const AGORA_APP_ID: string = isUsableAgoraAppId(rawAppId) ? rawAppId : '';

/**
 * Temporary/channel token. Empty string is valid only when the Agora project
 * has App Certificate disabled (testing). Prefer token server in production.
 */
export const AGORA_TOKEN: string | null = rawToken.length ? rawToken : null;

export const AGORA_CLIENT_SETTINGS: AgoraClientSettings = {
  channelProfile: 'liveBroadcasting',
  preferHardwareEncoder: true,
  autoSubscribeAudio: true,
  autoSubscribeVideo: true,
  reconnectDelayMs: 1500,
  maxReconnectAttempts: 5,
};

/** True when a real App ID is present (native module availability checked separately). */
export function hasAgoraAppId(): boolean {
  return isUsableAgoraAppId(AGORA_APP_ID);
}

/**
 * Build a stable arena channel name.
 * Example: arena-1v1-featured-live
 */
export function buildArenaChannelName(roomId?: string | null): string {
  const raw = String(roomId || 'featured-live')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = (raw || 'featured-live').slice(0, 48);
  return `arena-1v1-${slug}`.slice(0, 64);
}

/**
 * Resolve join credentials for a channel.
 * Swap `token` here later for a fetch from your token server.
 */
export function getAgoraJoinCredentials(channelName: string): {
  appId: string;
  token: string;
  channelName: string;
} {
  return {
    appId: AGORA_APP_ID,
    token: AGORA_TOKEN || '',
    channelName,
  };
}

const agoraConfig = {
  AGORA_APP_ID,
  AGORA_TOKEN,
  AGORA_CLIENT_SETTINGS,
  hasAgoraAppId,
  buildArenaChannelName,
  getAgoraJoinCredentials,
};

export default agoraConfig;
