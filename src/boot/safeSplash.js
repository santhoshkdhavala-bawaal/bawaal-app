/**
 * Soft-fail SplashScreen helpers — never block render if native splash control fails.
 */
import * as SplashScreen from 'expo-splash-screen';

export async function preventAutoHideSafe() {
  try {
    console.log('[boot] SplashScreen.preventAutoHideAsync');
    await SplashScreen.preventAutoHideAsync();
  } catch (err) {
    console.warn(
      '[boot] SplashScreen.preventAutoHideAsync failed:',
      err?.message || err
    );
  } finally {
    // Rendering must continue even if prevent failed.
  }
}

export async function hideSplashSafe(reason) {
  try {
    console.log(`[boot] SplashScreen.hideAsync (${reason || 'boot'})`);
    await SplashScreen.hideAsync();
  } catch (err) {
    console.warn(
      `[boot] SplashScreen.hideAsync failed (${reason || 'boot'}):`,
      err?.message || err
    );
  } finally {
    // Callers continue regardless — splash must never freeze launch.
  }
}
