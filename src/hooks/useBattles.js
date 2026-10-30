/**
 * BATTLES / Arena shelf hook — live Supabase `battles` ordered by created_at.
 * Soft-falls back to seed Open Callouts when offline or the table is empty.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOpenBattles } from '../services/api';
import { seedBattlesOpenCallouts } from '../utils/faceoffCallout';

/**
 * @param {{ category?: string, enabled?: boolean, limit?: number }} [opts]
 */
export function useBattles(opts = {}) {
  const category = opts.category || null;
  const enabled = opts.enabled !== false;
  const limit = opts.limit || 24;
  const [battles, setBattles] = useState(() => seedBattlesOpenCallouts());
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const rows = await fetchOpenBattles({ category, limit });
        if (cancelled || !mounted.current) return;
        setBattles(
          Array.isArray(rows) && rows.length > 0
            ? rows
            : seedBattlesOpenCallouts()
        );
      } catch (err) {
        if (cancelled || !mounted.current) return;
        setError(err);
        setBattles(seedBattlesOpenCallouts());
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category, enabled, limit, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  /** Alias used by Arena shelf / Open Callouts panels. */
  return {
    battles,
    callouts: battles,
    loading,
    error,
    refresh,
  };
}

/** @deprecated Prefer `useBattles` — kept for ArenaFeed soft-compat. */
export function useOpenBattles(opts) {
  return useBattles(opts);
}

export default useBattles;
