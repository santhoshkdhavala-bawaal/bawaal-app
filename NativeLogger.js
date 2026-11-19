/** Safe console + optional file breadcrumb — never throws at import time. */

const LOG_FILE_NAME = 'bawaal_native_crash.txt';

function getFileSystem() {
  try {
    // Lazy require — a missing native module must not kill cold start.
    // eslint-disable-next-line global-require
    return require('expo-file-system/legacy');
  } catch (_) {
    try {
      // eslint-disable-next-line global-require
      return require('expo-file-system');
    } catch (__) {
      return null;
    }
  }
}

function logPath(FileSystem) {
  const dir = FileSystem?.documentDirectory;
  return dir ? `${dir}${LOG_FILE_NAME}` : null;
}

/** Safe console + optional file breadcrumb — never throws. */
export function logStartup(stage, detail) {
  try {
    const extra =
      detail == null
        ? ''
        : typeof detail === 'string'
          ? ` ${detail}`
          : ` ${JSON.stringify(detail)}`;
    console.log(`[boot] ${stage}${extra}`);
  } catch (_) {
    /* soft-fail */
  }
}

// Global JS uncaught exception handler — persists last fatal for on-device recovery.
if (typeof global !== 'undefined' && global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    const log = `[FATAL NATIVE/JS CRASH ${new Date().toISOString()}]\nError: ${error?.message || error}\nStack: ${error?.stack}\n`;
    try {
      console.error('[boot] FATAL', error?.message || error, { isFatal });
    } catch (_) {
      /* soft-fail */
    }
    try {
      const FileSystem = getFileSystem();
      const path = logPath(FileSystem);
      if (FileSystem?.writeAsStringAsync && path) {
        await FileSystem.writeAsStringAsync(path, log);
      }
    } catch (e) {
      // Soft-fail — never block the default crash path
    }
    if (typeof defaultHandler === 'function') {
      defaultHandler(error, isFatal);
    }
  });
}

export async function readNativeCrashLog() {
  try {
    const FileSystem = getFileSystem();
    const path = logPath(FileSystem);
    if (!FileSystem || !path) return 'No crash file saved yet.';
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(path);
    }
  } catch (e) {
    // Soft-fail
  }
  return 'No crash file saved yet.';
}
