import * as FileSystem from 'expo-file-system/legacy';

const LOG_FILE = `${FileSystem.documentDirectory || ''}bawaal_native_crash.txt`;

// Global JS uncaught exception handler — persists last fatal for on-device recovery.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    const log = `[FATAL NATIVE/JS CRASH ${new Date().toISOString()}]\nError: ${error?.message || error}\nStack: ${error?.stack}\n`;
    try {
      if (FileSystem.documentDirectory) {
        await FileSystem.writeAsStringAsync(LOG_FILE, log);
      }
    } catch (e) {
      // Soft-fail — never block the default crash path
    }
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

export async function readNativeCrashLog() {
  try {
    if (!FileSystem.documentDirectory) return 'No crash file saved yet.';
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(LOG_FILE);
    }
  } catch (e) {
    // Soft-fail
  }
  return 'No crash file saved yet.';
}
