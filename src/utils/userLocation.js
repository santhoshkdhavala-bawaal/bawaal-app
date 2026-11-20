/**
 * Foreground GPS helper for Sport Hub Map / NEAR ME.
 * Never hangs — races getCurrentPosition against a timeout and falls back
 * to getLastKnownPositionAsync.
 */
import * as Location from 'expo-location';

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number|null, from: 'current'|'lastKnown' }>}
 */
export async function resolveUserCoordinates(options = {}) {
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const err = new Error('Location permission denied');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }

  let lastKnown = null;
  try {
    lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 120000,
      requiredAccuracy: 1000,
    });
  } catch {
    lastKnown = null;
  }

  const currentPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const err = new Error('Location timeout');
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  try {
    const pos = await Promise.race([currentPromise, timeoutPromise]);
    const latitude = Number(pos?.coords?.latitude);
    const longitude = Number(pos?.coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Invalid current coordinates');
    }
    return {
      latitude,
      longitude,
      accuracy: pos?.coords?.accuracy ?? null,
      from: 'current',
    };
  } catch (err) {
    const latitude = Number(lastKnown?.coords?.latitude);
    const longitude = Number(lastKnown?.coords?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        accuracy: lastKnown?.coords?.accuracy ?? null,
        from: 'lastKnown',
      };
    }
    throw err;
  }
}

export function regionFromCoords(latitude, longitude, delta = 0.045) {
  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
