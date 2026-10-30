/**
 * BATTLES / Arena shelf — live Supabase `battles` ordered by created_at.
 * Soft-falls back to seed Open Callouts when offline, empty, or misconfigured.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { mapBattleRowToCallout } from '../services/api';
import { seedBattlesOpenCallouts } from '../utils/faceoffCallout';

/**
 * @param {{ category?: string, enabled?: boolean, limit?: number }} [opts]
 */
export function useBattles(opts = {}) {
  const category = opts.category || null;
  const enabled = opts.enabled !== false;
  const limit = Math.min(Math.max(Number(opts.limit) || 24, 1), 60);
  const [battles, setBattles] = useState(() => seedBattlesOpenCallouts());
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const [fromLive, setFromLive] = useState(false);
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
      const fallback = filterByCategory(seedBattlesOpenCallouts(), category);

      if (!isSupabaseConfigured()) {
        if (cancelled || !mounted.current) return;
        console.warn(
          '[useBattles] Supabase not configured — using seed callouts'
        );
        setBattles(fallback);
        setFromLive(false);
        setLoading(false);
        return;
      }

      try {
        // Live query: `select('*')` newest first
        let query = supabase
          .from('battles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        const sport = category ? String(category).trim().toUpperCase() : null;
        if (sport && sport !== 'ALL') {
          query = query.eq('category', sport);
        }

        let { data, error: queryError } = await query;

        // Category filter may not exist on legacy schema — plain select(*)
        if (
          queryError &&
          /column|schema cache|PGRST204|does not exist|operator/i.test(
            String(queryError.message || queryError.code || queryError.details || '')
          )
        ) {
          console.warn(
            '[useBattles] filtered select failed — retrying select(*):',
            queryError.message || queryError
          );
          const retry = await supabase
            .from('battles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          data = retry.data;
          queryError = retry.error;
        }

        if (cancelled || !mounted.current) return;

        if (queryError) {
          console.warn(
            '[useBattles] live fetch failed — seed fallback:',
            queryError.message || queryError
          );
          setError(queryError);
          setBattles(fallback);
          setFromLive(false);
          return;
        }

        const mapped = (data || [])
          .map((row) =>
            mapBattleRowToCallout({
              ...row,
              creator_profile: row.profiles || null,
            })
          )
          .filter(Boolean);

        // Keep only open-ish rows when legacy data mixes live + open
        const openish = mapped.filter((row) => {
          const s = String(row.status || '').toUpperCase();
          return (
            !s ||
            s === 'OPEN' ||
            s === 'HOT' ||
            s === 'ACTIVE' ||
            s === 'LIVE'
          );
        });

        const next = openish.length > 0 ? openish : mapped;

        if (next.length === 0) {
          console.warn(
            '[useBattles] battles empty — soft-fallback seed for local dev'
          );
          setBattles(fallback);
          setFromLive(false);
          return;
        }

        setBattles(filterByCategory(next, category));
        setFromLive(true);
      } catch (err) {
        if (cancelled || !mounted.current) return;
        console.warn(
          '[useBattles] crashed — seed fallback:',
          err?.message || err
        );
        setError(err);
        setBattles(fallback);
        setFromLive(false);
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

  return {
    battles,
    callouts: battles,
    loading,
    error,
    refresh,
    fromLive,
  };
}

function filterByCategory(items, category) {
  const sport = category ? String(category).trim().toUpperCase() : null;
  if (!sport || sport === 'ALL') return items.slice();
  return items.filter(
    (item) =>
      String(item.sport || item.category || '').toUpperCase() === sport
  );
}

/** @deprecated Prefer `useBattles` — kept for soft-compat. */
export function useOpenBattles(opts) {
  return useBattles(opts);
}

export default useBattles;
