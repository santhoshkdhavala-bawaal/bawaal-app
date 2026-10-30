/**
 * Arena feed hook — live Supabase `videos` (+ profiles), newest first.
 * Soft-falls back to mock rows inside `fetchArenaFeed` when offline / empty.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchArenaFeed } from '../services/api';

/**
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

export default useArenaFeed;
