/**
 * Persistent athlete registration session (Passport / Profile).
 * Primary: AsyncStorage. Fallback: expo-file-system/legacy (migrates into AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const ASYNC_KEY = '@bawaal/athlete_session_v1';
const SESSION_FILE = `${FileSystem.documentDirectory || ''}bawaal_user_session.json`;

let memorySession = null;

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.registered && !raw.handle && !raw.displayName && !raw.realName) {
    return null;
  }
  return {
    ...raw,
    registered: true,
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

async function writeToAsyncStorage(payload) {
  try {
    await AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[session] AsyncStorage write failed:', err?.message || err);
    return false;
  }
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

export async function getRegisteredSession() {
  if (memorySession?.registered) return memorySession;

  const fromAsync = await readFromAsyncStorage();
  if (fromAsync?.registered) {
    memorySession = fromAsync;
    return fromAsync;
  }

  // Migrate legacy FS session → AsyncStorage once
  const fromFs = await readFromFileSystem();
  if (fromFs?.registered) {
    memorySession = fromFs;
    await writeToAsyncStorage(fromFs);
    return fromFs;
  }

  return null;
}

export async function setRegisteredSession(userData = {}) {
  const payload = normalizePayload({
    registered: true,
    savedAt: Date.now(),
    ...userData,
  });
  if (!payload) return null;
  memorySession = payload;
  await writeToAsyncStorage(payload);
  await writeToFileSystem(payload);
  return payload;
}

export async function clearRegisteredSession() {
  memorySession = null;
  try {
    await AsyncStorage.removeItem(ASYNC_KEY);
  } catch (_) {
    /* ignore */
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
  return Boolean(session?.registered);
}

export function getCachedSessionSync() {
  return memorySession;
}
