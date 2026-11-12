/**
 * Active Arena / GAME ON filter state — local-first, instant UI.
 * Battle tier + sport chip selection survive drawer close / remount.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARENA_FEED_TIER_ALL } from '../constants/arenaFeedTiers';

const KEY = '@bawaal/arena_filters_v1';

/** @type {{ tierId: string, sportLabel: string|null }} */
let state = {
  tierId: ARENA_FEED_TIER_ALL,
  sportLabel: null,
};

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn({ ...state });
    } catch (_) {
      /* ignore */
    }
  });
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[arenaFilterStore] persist failed:', err?.message || err);
  }
}

export function getArenaFilters() {
  return { ...state };
}

export function subscribeArenaFilters(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setArenaFeedTier(tierId) {
  state = {
    ...state,
    tierId: String(tierId || ARENA_FEED_TIER_ALL),
  };
  emit();
  void persist();
  return getArenaFilters();
}

export function setArenaSportFilter(sportLabel) {
  const next =
    sportLabel == null || String(sportLabel).trim() === ''
      ? null
      : String(sportLabel).trim();
  state = {
    ...state,
    sportLabel: next,
  };
  emit();
  void persist();
  return getArenaFilters();
}

/** Hydrate from AsyncStorage once at app/Arena mount. Never throws. */
export async function hydrateArenaFilters() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return getArenaFilters();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state = {
        tierId: String(parsed.tierId || ARENA_FEED_TIER_ALL),
        sportLabel:
          parsed.sportLabel == null || parsed.sportLabel === ''
            ? null
            : String(parsed.sportLabel),
      };
      emit();
    }
  } catch (err) {
    console.warn('[arenaFilterStore] hydrate failed:', err?.message || err);
  }
  return getArenaFilters();
}
