/**
 * Agora RTC helpers for BATTLE BAWAAL live arena.
 * Requires a development build (`expo-dev-client`) — not available in Expo Go.
 */
import { Platform } from 'react-native';
import { Camera } from 'expo-camera';

let Agora = null;
try {
  Agora = require('react-native-agora');
} catch (err) {
  console.warn('[agora] Native module unavailable:', err?.message || err);
}

const DEFAULT_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
const DEFAULT_TOKEN = process.env.EXPO_PUBLIC_AGORA_TOKEN || null;

/** @type {import('react-native-agora').IRtcEngine | null} */
let engine = null;
let joinedChannel = null;
let localUid = 0;
const remoteUidListeners = new Set();
let remoteUids = [];

function emitRemoteUids(next) {
  remoteUids = next;
  remoteUidListeners.forEach((fn) => {
    try {
      fn([...remoteUids]);
    } catch (_) {
      /* ignore */
    }
  });
}

export function isAgoraNativeAvailable() {
  return Boolean(Agora?.createAgoraRtcEngine);
}

export function isAgoraConfigured() {
  return Boolean(DEFAULT_APP_ID && isAgoraNativeAvailable());
}

export function getAgoraSdk() {
  return Agora;
}

export function getEngine() {
  return engine;
}

export function getLocalUid() {
  return localUid;
}

export function getRemoteUids() {
  return [...remoteUids];
}

export function onRemoteUsersChanged(listener) {
  remoteUidListeners.add(listener);
  listener([...remoteUids]);
  return () => remoteUidListeners.delete(listener);
}

async function ensureMediaPermissions(asBroadcaster) {
  if (!asBroadcaster) return true;
  try {
    const cam = await Camera.requestCameraPermissionsAsync();
    const mic = await Camera.requestMicrophonePermissionsAsync();
    return cam?.granted !== false && mic?.granted !== false;
  } catch (err) {
    console.warn('[agora] Permission request failed:', err?.message || err);
    return Platform.OS === 'ios';
  }
}

/**
 * Initialize (or reuse) the RTC engine.
 * @param {string} [appId]
 */
export async function initAgoraEngine(appId = DEFAULT_APP_ID) {
  if (!isAgoraNativeAvailable()) {
    return { ok: false, reason: 'native-unavailable' };
  }
  if (!appId) {
    return { ok: false, reason: 'missing-app-id' };
  }
  if (engine) {
    return { ok: true, engine, reused: true };
  }

  const {
    createAgoraRtcEngine,
    ChannelProfileType,
  } = Agora;

  const rtc = createAgoraRtcEngine();
  rtc.initialize({
    appId,
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
  });
  rtc.enableVideo();
  rtc.enableAudio();

  rtc.registerEventHandler({
    onJoinChannelSuccess: (_connection, uid) => {
      localUid = uid || localUid;
      console.log('[agora] joined channel as', localUid);
    },
    onUserJoined: (_connection, uid) => {
      emitRemoteUids(
        remoteUids.includes(uid) ? remoteUids : [...remoteUids, uid]
      );
    },
    onUserOffline: (_connection, uid) => {
      emitRemoteUids(remoteUids.filter((id) => id !== uid));
    },
    onError: (err, msg) => {
      console.warn('[agora] error', err, msg);
    },
  });

  engine = rtc;
  return { ok: true, engine };
}

/**
 * Join a battle live channel.
 * @param {string} channelName
 * @param {number} [uid]
 * @param {boolean} [isHost] broadcaster when true (host/challenger); audience when false
 * @param {{ token?: string|null }} [options]
 */
export async function joinBattleChannel(
  channelName,
  uid = 0,
  isHost = false,
  options = {}
) {
  if (!channelName) {
    return { ok: false, reason: 'missing-channel' };
  }

  const init = await initAgoraEngine();
  if (!init.ok || !engine) {
    return init;
  }

  if (joinedChannel === channelName) {
    return { ok: true, reused: true, channelName, localUid };
  }

  if (joinedChannel) {
    await leaveChannel();
  }

  const asBroadcaster = Boolean(isHost);
  await ensureMediaPermissions(asBroadcaster);

  const { ClientRoleType, ChannelProfileType } = Agora;
  const token = options.token ?? DEFAULT_TOKEN ?? '';
  localUid = Number(uid) || 0;

  if (asBroadcaster) {
    engine.enableLocalVideo(true);
    engine.enableLocalAudio(true);
    engine.startPreview();
  } else {
    engine.enableLocalVideo(false);
    engine.enableLocalAudio(false);
  }

  const result = engine.joinChannel(token, channelName, localUid, {
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
    clientRoleType: asBroadcaster
      ? ClientRoleType.ClientRoleBroadcaster
      : ClientRoleType.ClientRoleAudience,
    publishCameraTrack: asBroadcaster,
    publishMicrophoneTrack: asBroadcaster,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
  });

  joinedChannel = channelName;
  return { ok: result === 0 || result === undefined, channelName, localUid, code: result };
}

export async function leaveChannel() {
  if (!engine) {
    joinedChannel = null;
    emitRemoteUids([]);
    return { ok: true };
  }
  try {
    engine.stopPreview();
    engine.leaveChannel();
  } catch (err) {
    console.warn('[agora] leaveChannel:', err?.message || err);
  }
  joinedChannel = null;
  emitRemoteUids([]);
  return { ok: true };
}

export async function destroyAgoraEngine() {
  await leaveChannel();
  if (engine) {
    try {
      engine.unregisterEventHandler?.({});
      engine.release();
    } catch (_) {
      /* ignore */
    }
  }
  engine = null;
  localUid = 0;
  return { ok: true };
}

/** Toggle local camera publish (true = muted/off). */
export function muteLocalVideoStream(muted) {
  if (!engine) return { ok: false };
  engine.muteLocalVideoStream(Boolean(muted));
  if (muted) {
    engine.enableLocalVideo(false);
  } else {
    engine.enableLocalVideo(true);
    engine.startPreview();
  }
  return { ok: true, muted: Boolean(muted) };
}

/** Toggle local mic (true = muted). */
export function muteLocalAudioStream(muted) {
  if (!engine) return { ok: false };
  engine.muteLocalAudioStream(Boolean(muted));
  return { ok: true, muted: Boolean(muted) };
}

/** Flip front/back camera. */
export function switchCamera() {
  if (!engine) return { ok: false };
  const code = engine.switchCamera();
  return { ok: code === 0 || code === undefined, code };
}

export function battleChannelName(battleId) {
  const raw = String(battleId || 'demo-arena').replace(/[^a-zA-Z0-9_-]/g, '');
  return `bawaal_${raw}`.slice(0, 64);
}

export const agoraService = {
  isAgoraNativeAvailable,
  isAgoraConfigured,
  getAgoraSdk,
  getEngine,
  getLocalUid,
  getRemoteUids,
  onRemoteUsersChanged,
  initAgoraEngine,
  joinBattleChannel,
  leaveChannel,
  destroyAgoraEngine,
  muteLocalVideoStream,
  muteLocalAudioStream,
  switchCamera,
  battleChannelName,
};

export default agoraService;
