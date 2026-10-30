/**
 * Arena feed — live Supabase `videos` joined with `profiles(username, avatar_url)`.
 * Soft-falls back to mock rows when offline, misconfigured, or the table is empty.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  mapVideoRowToFeedItem,
  getMockArenaFeed,
} from '../services/api';

const VIDEOS_WITH_PROFILES_SELECT = '*, profiles(username, avatar_url)';

/**
 * @param {{ category?: string, enabled?: boolean, limit?: number }} [opts]
 */
export function useArenaFeed(opts = {}) {
  const category = opts.category || 'ALL';
  const enabled = opts.enabled !== false;
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 80);
  const [items, setItems] = useState(() => getMockArenaFeed(category));
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
      const fallback = getMockArenaFeed(category);

      if (!isSupabaseConfigured()) {
        if (cancelled || !mounted.current) return;
        console.warn(
          '[useArenaFeed] Supabase not configured — using mock Arena feed'
        );
        setItems(fallback);
        setFromLive(false);
        setLoading(false);
        return;
      }

      try {
        // Live query: videos + profile handle / avatar
        let query = supabase
          .from('videos')
          .select(VIDEOS_WITH_PROFILES_SELECT)
          .order('created_at', { ascending: false })
          .limit(limit);

        const sport = String(category || 'ALL').trim().toUpperCase();
        if (sport && sport !== 'ALL') {
          query = query.eq('category', sport);
        }

        let { data, error: queryError } = await query;

        // FK embed missing / schema cache — lean select, still live
        if (
          queryError &&
          /relationship|embed|schema cache|foreign key|PGRST/i.test(
            String(queryError.message || queryError.code || '')
          )
        ) {
          console.warn(
            '[useArenaFeed] profiles(*) embed failed — retrying videos only:',
            queryError.message || queryError
          );
          let lean = supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          if (sport && sport !== 'ALL') {
            lean = lean.eq('category', sport);
          }
          const retry = await lean;
          data = retry.data;
          queryError = retry.error;
        }

        if (cancelled || !mounted.current) return;

        if (queryError) {
          console.warn(
            '[useArenaFeed] live fetch failed — mock fallback:',
            queryError.message || queryError
          );
          setError(queryError);
          setItems(fallback);
          setFromLive(false);
          return;
        }

        const mapped = (data || []).map(mapVideoRowToFeedItem).filter(Boolean);
        if (mapped.length === 0) {
          console.warn(
            '[useArenaFeed] videos empty — soft-fallback mock for local dev'
          );
          setItems(fallback);
          setFromLive(false);
          return;
        }

        setItems(mapped);
        setFromLive(true);
      } catch (err) {
        if (cancelled || !mounted.current) return;
        console.warn(
          '[useArenaFeed] crashed — mock fallback:',
          err?.message || err
        );
        setError(err);
        setItems(fallback);
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

  return { items, loading, error, refresh, category, fromLive };
}

export default useArenaFeed;
