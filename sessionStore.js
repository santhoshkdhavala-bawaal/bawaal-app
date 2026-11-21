/**
 * Persistent athlete registration / login session (Passport / Profile / boot routing).
 * Primary: AsyncStorage. Fallback: expo-file-system/legacy (migrates into AsyncStorage).
 *
 * Launch flags (persisted):
 *   isRegistered / registered     — account exists on this device
 *   isLoggedIn                    — active session; false after explicit Logout
 *   hasRegisteredPreviously       — device has completed registration at least once
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const ASYNC_KEY = '@bawaal/athlete_session_v1';
/** Legacy + current: device has a registered account record (may be logged out). */
export const REGISTERED_USER_FLAG_KEY = 'bawaal_registered_user';
/** Explicit prior-registration marker for logout → OTP-only routing. */
export const HAS_REGISTERED_PREVIOUSLY_KEY = 'bawaal_has_registered_previously';
/** Fast boot logged-in marker (`1` / `0`). */
export const IS_LOGGED_IN_KEY = 'bawaal_is_logged_in';
const SESSION_FILE = `${FileSystem.documentDirectory || ''}bawaal_user_session.json`;

let memorySession = null;

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hasIdentity = Boolean(
    raw.registered ||
      raw.isRegistered ||
      raw.hasRegisteredPreviously ||
      raw.handle ||
      raw.displayName ||
      raw.realName ||
      raw.phone
  );
  if (!hasIdentity) return null;

  const isRegistered = Boolean(
    raw.isRegistered ?? raw.registered ?? raw.hasRegisteredPreviously ?? true
  );
  const hasRegisteredPreviously = Boolean(
    raw.hasRegisteredPreviously ?? isRegistered
  );
  // Default logged-in when loading legacy sessions that lack the flag
  const isLoggedIn =
    raw.isLoggedIn === false || raw.loggedIn === false
      ? false
      : Boolean(
          raw.isLoggedIn ??
            raw.loggedIn ??
            (isRegistered || hasRegisteredPreviously)
        );

  return {
    ...raw,
    registered: isRegistered,
    isRegistered,
    hasRegisteredPreviously,
    isLoggedIn,
    savedAt: Number(raw.savedAt) || Date.now(),
    handle: raw.handle || null,
    displayName: raw.displayName || raw.name || raw.realName || null,
    realName: raw.realName || raw.name || null,
    name: raw.name || raw.realName || raw.displayName || null,
    email: raw.email || null,
    phone: raw.phone || null,
    role: raw.role || 'athlete',
    sportInterest: raw.sportInterest || raw.sport || null,
    sport: raw.sport || raw.sportInterest || null,
    location: raw.location || '',
    flag: raw.flag || raw.countryFlag || null,
    countryFlag: raw.countryFlag || raw.flag || null,
    country: raw.country || null,
    label: raw.label || raw.country || null,
  };
}

async function readFromAsyncStorage() {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_KEY);
    if (!raw) return null;
    return normalizePayload(JSON.parse(raw));
  } catch (err) {
    console.warn('[session] AsyncStorage read failed:', err?.message || err);
    return null;
  }
}

async function writeFastFlags(payload) {
  try {
    const pairs = [];
    if (payload?.hasRegisteredPreviously || payload?.isRegistered) {
      pairs.push([REGISTERED_USER_FLAG_KEY, '1']);
      pairs.push([HAS_REGISTERED_PREVIOUSLY_KEY, '1']);
    }
    if (payload?.isLoggedIn) {
      pairs.push([IS_LOGGED_IN_KEY, '1']);
    } else {
      pairs.push([IS_LOGGED_IN_KEY, '0']);
    }
    if (pairs.length) await AsyncStorage.multiSet(pairs);
  } catch (err) {
    console.warn('[session] fast flags write failed:', err?.message || err);
  }
}

async function writeToAsyncStorage(payload) {
  try {
    await AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(payload));
    await writeFastFlags(payload);
    return true;
  } catch (err) {
    console.warn('[session] AsyncStorage write failed:', err?.message || err);
    return false;
  }
}

/** Fast boolean — device has completed registration at least once. */
export async function hasRegisteredPreviouslyFlag() {
  try {
    if (memorySession?.hasRegisteredPreviously || memorySession?.isRegistered) {
      return true;
    }
    const prev = await AsyncStorage.getItem(HAS_REGISTERED_PREVIOUSLY_KEY);
    if (prev === '1' || prev === 'true') return true;
    const legacy = await AsyncStorage.getItem(REGISTERED_USER_FLAG_KEY);
    if (legacy === '1' || legacy === 'true') return true;
    const session = await readFromAsyncStorage();
    return Boolean(
      session?.hasRegisteredPreviously || session?.isRegistered || session?.registered
    );
  } catch (_) {
    return false;
  }
}

/** @deprecated Prefer hasRegisteredPreviouslyFlag — kept for AppBoot compat. */
export async function hasRegisteredUserFlag() {
  return hasRegisteredPreviouslyFlag();
}

export async function isLoggedInFlag() {
  try {
    if (memorySession && typeof memorySession.isLoggedIn === 'boolean') {
      return memorySession.isLoggedIn;
    }
    const flag = await AsyncStorage.getItem(IS_LOGGED_IN_KEY);
    if (flag === '0' || flag === 'false') return false;
    if (flag === '1' || flag === 'true') return true;
    const session = await readFromAsyncStorage();
    if (session) return session.isLoggedIn !== false;
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Boot routing helper.
 * @returns {Promise<{ isLoggedIn: boolean, hasRegisteredPreviously: boolean, session: object|null, loginOnly: boolean }>}
 */
export async function getAuthLaunchState() {
  const session = await getRegisteredSession({ allowLoggedOut: true });
  const hasRegisteredPreviously = Boolean(
    session?.hasRegisteredPreviously ||
      session?.isRegistered ||
      (await hasRegisteredPreviouslyFlag())
  );

  let loggedIn = false;
  if (session) {
    if (session.isLoggedIn === false) loggedIn = false;
    else if (session.isLoggedIn === true) loggedIn = true;
    else loggedIn = await isLoggedInFlag();
  }

  return {
    session,
    hasRegisteredPreviously,
    isLoggedIn: loggedIn,
    /** Returning user who logged out → Phone + OTP only */
    loginOnly: Boolean(hasRegisteredPreviously && !loggedIn),
  };
}

async function readFromFileSystem() {
  try {
    if (!FileSystem.documentDirectory) return null;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    return normalizePayload(JSON.parse(raw));
  } catch (err) {
    console.warn('[session] FS read failed:', err?.message || err);
    return null;
  }
}

async function writeToFileSystem(payload) {
  try {
    if (!FileSystem.documentDirectory) return false;
    await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[session] FS write failed:', err?.message || err);
    return false;
  }
}

async function ensureRegisteredFlags(payload) {
  try {
    await writeFastFlags(payload || { hasRegisteredPreviously: true, isLoggedIn: true });
  } catch (_) {
    /* ignore */
  }
}

/**
 * @param {{ allowLoggedOut?: boolean }} [opts]
 *   allowLoggedOut — return saved profile even when isLoggedIn is false (OTP restore).
 */
export async function getRegisteredSession(opts = {}) {
  const allowLoggedOut = Boolean(opts.allowLoggedOut);

  const pick = (session) => {
    if (!session) return null;
    if (allowLoggedOut) return session;
    if (session.isLoggedIn === false) return null;
    return session;
  };

  if (memorySession?.isRegistered || memorySession?.registered) {
    const hit = pick(memorySession);
    if (hit || (!allowLoggedOut && memorySession.isLoggedIn === false)) {
      return hit;
    }
  }

  const fromAsync = await readFromAsyncStorage();
  if (fromAsync?.isRegistered || fromAsync?.registered) {
    memorySession = fromAsync;
    void ensureRegisteredFlags(fromAsync);
    return pick(fromAsync);
  }

  const fromFs = await readFromFileSystem();
  if (fromFs?.isRegistered || fromFs?.registered) {
    memorySession = fromFs;
    await writeToAsyncStorage(fromFs);
    return pick(fromFs);
  }

  return null;
}

/** Persist a completed registration / successful OTP login (logged in). */
export async function setRegisteredSession(userData = {}) {
  const payload = normalizePayload({
    savedAt: Date.now(),
    ...userData,
    registered: true,
    isRegistered: true,
    hasRegisteredPreviously: true,
    isLoggedIn: true,
  });
  if (!payload) return null;
  memorySession = payload;
  await writeToAsyncStorage(payload);
  await writeToFileSystem(payload);
  return payload;
}

/**
 * Explicit Logout — keep account record + hasRegisteredPreviously;
 * clear active login so boot routes to Phone + OTP only.
 */
export async function logoutRegisteredSession() {
  const existing =
    memorySession ||
    (await readFromAsyncStorage()) ||
    (await readFromFileSystem()) ||
    {};

  const payload = normalizePayload({
    ...existing,
    registered: true,
    isRegistered: true,
    hasRegisteredPreviously: true,
    isLoggedIn: false,
    savedAt: Date.now(),
  });

  if (!payload) {
    // No prior profile — still mark previous registration if legacy flag existed
    try {
      await AsyncStorage.setItem(HAS_REGISTERED_PREVIOUSLY_KEY, '1');
      await AsyncStorage.setItem(REGISTERED_USER_FLAG_KEY, '1');
      await AsyncStorage.setItem(IS_LOGGED_IN_KEY, '0');
    } catch (_) {
      /* ignore */
    }
    memorySession = null;
    return null;
  }

  memorySession = payload;
  await writeToAsyncStorage(payload);
  await writeToFileSystem(payload);
  return payload;
}

/** Full wipe (dev / account delete). Prefer logoutRegisteredSession for Logout CTA. */
export async function clearRegisteredSession() {
  memorySession = null;
  try {
    await AsyncStorage.multiRemove([
      ASYNC_KEY,
      REGISTERED_USER_FLAG_KEY,
      HAS_REGISTERED_PREVIOUSLY_KEY,
      IS_LOGGED_IN_KEY,
    ]);
  } catch (_) {
    try {
      await AsyncStorage.removeItem(ASYNC_KEY);
      await AsyncStorage.removeItem(REGISTERED_USER_FLAG_KEY);
      await AsyncStorage.removeItem(HAS_REGISTERED_PREVIOUSLY_KEY);
      await AsyncStorage.removeItem(IS_LOGGED_IN_KEY);
    } catch (__) {
      /* ignore */
    }
  }
  try {
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
    }
  } catch (_) {
    /* ignore */
  }
}

export function isSessionRegistered(session) {
  return Boolean(session?.isRegistered || session?.registered);
}

export function getCachedSessionSync() {
  return memorySession;
}
