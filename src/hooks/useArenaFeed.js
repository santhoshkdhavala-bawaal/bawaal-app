/**
 * Arena feed + open-battles data hooks backed by Supabase (`videos` / `battles`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchArenaFeed, fetchOpenBattles } from '../services/api';
import { seedBattlesOpenCallouts } from '../utils/faceoffCallout';

/**
 * Load Arena video items from Supabase `videos` (+ profiles), newest first.
 * Soft-falls back to mock rows inside `fetchArenaFeed`.
 *
 * @param {{ category?: string, enabled?: boolean }} [opts]
 */
export function useArenaFeed(opts = {}) {
  const category = opts.category || 'ALL';
  const enabled = opts.enabled !== false;
  const [items, setItems] = useState([]);
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
        const rows = await fetchArenaFeed(category);
        if (cancelled || !mounted.current) return;
        setItems(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (cancelled || !mounted.current) return;
        setError(err);
        setItems([]);
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category, enabled, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { items, loading, error, refresh, category };
}

/**
 * Load open / active battles for the Arena community shelf + BATTLES screen.
 * Soft-falls back to seed Open Callouts.
 *
 * @param {{ category?: string, enabled?: boolean, limit?: number }} [opts]
 */
export function useOpenBattles(opts = {}) {
  const category = opts.category || null;
  const enabled = opts.enabled !== false;
  const limit = opts.limit || 24;
  const [callouts, setCallouts] = useState(() => seedBattlesOpenCallouts());
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
        setCallouts(
          Array.isArray(rows) && rows.length > 0
            ? rows
            : seedBattlesOpenCallouts()
        );
      } catch (err) {
        if (cancelled || !mounted.current) return;
        setError(err);
        setCallouts(seedBattlesOpenCallouts());
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

  return { callouts, loading, error, refresh };
}

export default useArenaFeed;
