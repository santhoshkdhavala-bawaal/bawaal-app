/**
 * Agora RTC engine for BAWAAL Live Arena.
 * Requires a development build (`expo-dev-client`) — not available in Expo Go.
 */
import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import {
  AGORA_APP_ID,
  AGORA_CLIENT_SETTINGS,
  AGORA_TOKEN,
  buildArenaChannelName,
  getAgoraJoinCredentials,
  hasAgoraAppId,
} from '../config/agora';

let Agora = null;
try {
  Agora = require('react-native-agora');
} catch (err) {
  console.warn('[agora] Native module unavailable:', err?.message || err);
}

/** @type {import('react-native-agora').IRtcEngine | null} */
let engine = null;
let joinedChannel = null;
let localUid = 0;
let joinedAsBroadcaster = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let lastJoinArgs = null;

const remoteUidListeners = new Set();
const connectionListeners = new Set();
let remoteUids = [];
/** @type {'idle'|'connecting'|'connected'|'reconnecting'|'failed'|'disconnected'} */
let connectionState = 'idle';

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

function emitConnection(state, meta = {}) {
  connectionState = state;
  connectionListeners.forEach((fn) => {
    try {
      fn(state, meta);
    } catch (_) {
      /* ignore */
    }
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function isAgoraNativeAvailable() {
  return Boolean(Agora?.createAgoraRtcEngine);
}

export function isAgoraConfigured() {
  return Boolean(hasAgoraAppId() && isAgoraNativeAvailable());
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

export function getConnectionState() {
  return connectionState;
}

export function onRemoteUsersChanged(listener) {
  remoteUidListeners.add(listener);
  listener([...remoteUids]);
  return () => remoteUidListeners.delete(listener);
}

export function onConnectionStateChanged(listener) {
  connectionListeners.add(listener);
  listener(connectionState, {});
  return () => connectionListeners.delete(listener);
}

async function ensureMediaPermissions(asBroadcaster) {
  if (!asBroadcaster) return true;
  try {
    const cam = await Camera.requestCameraPermissionsAsync();
    const mic = await Camera.requestMicrophonePermissionsAsync();
    const granted = cam?.granted === true && mic?.granted === true;
    if (!granted && __DEV__) {
      console.warn('[agora] Camera/mic permission not fully granted', {
        camera: cam?.granted,
        mic: mic?.granted,
      });
    }
    return granted;
  } catch (err) {
    console.warn('[agora] Permission request failed:', err?.message || err);
    return Platform.OS === 'ios';
  }
}

function scheduleReconnect(reason) {
  if (!lastJoinArgs) return;
  if (reconnectAttempts >= AGORA_CLIENT_SETTINGS.maxReconnectAttempts) {
    emitConnection('failed', { reason: 'max-reconnects', detail: reason });
    return;
  }
  clearReconnectTimer();
  reconnectAttempts += 1;
  emitConnection('reconnecting', {
    attempt: reconnectAttempts,
    reason,
  });
  reconnectTimer = setTimeout(() => {
    const { channelName, uid, isHost, options } = lastJoinArgs;
    void joinBattleChannel(channelName, uid, isHost, {
      ...options,
      force: true,
    });
  }, AGORA_CLIENT_SETTINGS.reconnectDelayMs);
}

/**
 * Initialize (or reuse) the RTC engine.
 * @param {string} [appId]
 */
export async function initAgoraEngine(appId = AGORA_APP_ID) {
  if (!isAgoraNativeAvailable()) {
    return { ok: false, reason: 'native-unavailable' };
  }
  if (!appId) {
    return { ok: false, reason: 'missing-app-id' };
  }
  if (engine) {
    return { ok: true, engine, reused: true };
  }

  const { createAgoraRtcEngine, ChannelProfileType, ConnectionStateType } =
    Agora;

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
      reconnectAttempts = 0;
      clearReconnectTimer();
      emitConnection('connected', { uid: localUid });
      if (__DEV__) {
        console.log('[agora] joined channel as', localUid, joinedChannel);
      }
    },
    onUserJoined: (_connection, uid) => {
      emitRemoteUids(
        remoteUids.includes(uid) ? remoteUids : [...remoteUids, uid]
      );
    },
    onUserOffline: (_connection, uid) => {
      emitRemoteUids(remoteUids.filter((id) => id !== uid));
    },
    onConnectionStateChanged: (_connection, state, reason) => {
      if (state === ConnectionStateType?.ConnectionStateConnecting) {
        emitConnection('connecting', { reason });
      } else if (state === ConnectionStateType?.ConnectionStateConnected) {
        reconnectAttempts = 0;
        clearReconnectTimer();
        emitConnection('connected', { reason });
      } else if (state === ConnectionStateType?.ConnectionStateReconnecting) {
        emitConnection('reconnecting', { reason });
      } else if (
        state === ConnectionStateType?.ConnectionStateFailed ||
        state === ConnectionStateType?.ConnectionStateDisconnected
      ) {
        emitConnection(
          state === ConnectionStateType?.ConnectionStateFailed
            ? 'failed'
            : 'disconnected',
          { reason }
        );
        if (joinedChannel) {
          scheduleReconnect(reason);
        }
      }
    },
    onError: (err, msg) => {
      console.warn('[agora] error', err, msg);
      emitConnection('failed', { err, msg });
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
 * @param {{ token?: string|null, force?: boolean }} [options]
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

  const creds = getAgoraJoinCredentials(channelName);
  const init = await initAgoraEngine(creds.appId);
  if (!init.ok || !engine) {
    return init;
  }

  lastJoinArgs = { channelName, uid, isHost, options };

  if (joinedChannel === channelName && !options.force) {
    return { ok: true, reused: true, channelName, localUid };
  }

  if (joinedChannel) {
    await leaveChannel({ keepLastJoin: true });
  }

  const asBroadcaster = Boolean(isHost);
  const permitted = await ensureMediaPermissions(asBroadcaster);
  if (asBroadcaster && !permitted) {
    emitConnection('failed', { reason: 'permissions-denied' });
    return { ok: false, reason: 'permissions-denied' };
  }

  const { ClientRoleType, ChannelProfileType } = Agora;
  const token = options.token ?? creds.token ?? AGORA_TOKEN ?? '';
  localUid = Number(uid) || 0;
  joinedAsBroadcaster = asBroadcaster;
  emitConnection('connecting', { channelName, asBroadcaster });

  if (asBroadcaster) {
    engine.enableLocalVideo(true);
    engine.enableLocalAudio(true);
    engine.startPreview();
  } else {
    engine.enableLocalVideo(false);
    engine.enableLocalAudio(false);
    try {
      engine.stopPreview();
    } catch (_) {
      /* ignore */
    }
  }

  const result = engine.joinChannel(token, channelName, localUid, {
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
    clientRoleType: asBroadcaster
      ? ClientRoleType.ClientRoleBroadcaster
      : ClientRoleType.ClientRoleAudience,
    publishCameraTrack: asBroadcaster,
    publishMicrophoneTrack: asBroadcaster,
    autoSubscribeAudio: AGORA_CLIENT_SETTINGS.autoSubscribeAudio,
    autoSubscribeVideo: AGORA_CLIENT_SETTINGS.autoSubscribeVideo,
  });

  joinedChannel = channelName;
  const ok = result === 0 || result === undefined;
  if (!ok) {
    emitConnection('failed', { code: result });
  }
  return {
    ok,
    channelName,
    localUid,
    code: result,
    role: asBroadcaster ? 'host' : 'audience',
  };
}

export async function leaveChannel(options = {}) {
  clearReconnectTimer();
  if (!options.keepLastJoin) {
    lastJoinArgs = null;
    reconnectAttempts = 0;
  }
  if (!engine) {
    joinedChannel = null;
    joinedAsBroadcaster = false;
    emitRemoteUids([]);
    emitConnection('disconnected', {});
    return { ok: true };
  }
  try {
    engine.stopPreview();
    engine.leaveChannel();
  } catch (err) {
    console.warn('[agora] leaveChannel:', err?.message || err);
  }
  joinedChannel = null;
  joinedAsBroadcaster = false;
  emitRemoteUids([]);
  emitConnection('disconnected', {});
  return { ok: true };
}

export async function destroyAgoraEngine() {
  await leaveChannel();
  if (engine) {
    try {
      engine.release();
    } catch (_) {
      /* ignore */
    }
  }
  engine = null;
  localUid = 0;
  return { ok: true };
}

/** Toggle local camera publish (true = muted/off). Uses enableLocalVideo. */
export function muteLocalVideoStream(muted) {
  if (!engine) return { ok: false };
  const off = Boolean(muted);
  engine.muteLocalVideoStream(off);
  engine.enableLocalVideo(!off);
  if (!off && joinedAsBroadcaster) {
    engine.startPreview();
  }
  return { ok: true, muted: off };
}

/** Toggle local mic (true = muted). Uses enableLocalAudio / muteLocalAudioStream. */
export function muteLocalAudioStream(muted) {
  if (!engine) return { ok: false };
  const off = Boolean(muted);
  engine.muteLocalAudioStream(off);
  engine.enableLocalAudio(!off);
  return { ok: true, muted: off };
}

/** Flip front/back camera. */
export function switchCamera() {
  if (!engine) return { ok: false };
  const code = engine.switchCamera();
  return { ok: code === 0 || code === undefined, code };
}

/** Explicit enable helpers for Athlete HUD bindings. */
export function enableLocalVideo(enabled = true) {
  return muteLocalVideoStream(!enabled);
}

export function enableLocalAudio(enabled = true) {
  return muteLocalAudioStream(!enabled);
}

/** @deprecated prefer buildArenaChannelName — kept for existing imports */
export function battleChannelName(battleId) {
  return buildArenaChannelName(battleId);
}

export const agoraService = {
  isAgoraNativeAvailable,
  isAgoraConfigured,
  getAgoraSdk,
  getEngine,
  getLocalUid,
  getRemoteUids,
  getConnectionState,
  onRemoteUsersChanged,
  onConnectionStateChanged,
  initAgoraEngine,
  joinBattleChannel,
  leaveChannel,
  destroyAgoraEngine,
  muteLocalVideoStream,
  muteLocalAudioStream,
  enableLocalVideo,
  enableLocalAudio,
  switchCamera,
  battleChannelName,
  buildArenaChannelName,
};

export default agoraService;
