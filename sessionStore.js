/**
 * Persistent registration session without AsyncStorage native module.
 * Uses expo-file-system/legacy so Expo Go stays stable.
 */
import * as FileSystem from 'expo-file-system/legacy';

const SESSION_FILE = `${FileSystem.documentDirectory || ''}bawaal_user_session.json`;

let memorySession = null;

export async function getRegisteredSession() {
  if (memorySession) return memorySession;
  try {
    if (!FileSystem.documentDirectory) return null;
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    const parsed = JSON.parse(raw);
    if (parsed?.registered) {
      memorySession = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('[session] read failed:', err?.message || err);
  }
  return null;
}

export async function setRegisteredSession(userData = {}) {
  const payload = {
    registered: true,
    savedAt: Date.now(),
    ...userData,
  };
  memorySession = payload;
  try {
    if (!FileSystem.documentDirectory) return payload;
    await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(payload));
  } catch (err) {
    console.warn('[session] write failed (memory-only):', err?.message || err);
  }
  return payload;
}

export async function clearRegisteredSession() {
  memorySession = null;
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
