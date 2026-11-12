/**
 * Arena feed — live Supabase `videos` joined with profiles + social counts.
 * Soft-falls back to mock rows when offline, misconfigured, or the table is empty.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  mapVideoRowToFeedItem,
  enrichFeedWithSocialCounts,
  getMockArenaFeed,
} from '../services/api';
import { subscribeVideoSocial } from '../services/videoSocialService';

const VIDEOS_WITH_PROFILES_SELECT =
  '*, profiles(username, avatar_url, avatar_uri, belt_tier, primary_sport)';

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

        const enriched = await enrichFeedWithSocialCounts(mapped);
        if (cancelled || !mounted.current) return;
        setItems(enriched);
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

  // Live like/comment inserts refresh counts without a full feed remount
  const feedIdKey = items.map((i) => i.id).filter(Boolean).join('|');
  useEffect(() => {
    if (!fromLive || !feedIdKey) return undefined;
    const ids = feedIdKey.split('|').filter(Boolean);
    return subscribeVideoSocial(ids, ({ videoId, table, payload }) => {
      const isDelete = payload?.eventType === 'DELETE';
      const delta = isDelete ? -1 : 1;
      setItems((prev) =>
        prev.map((row) => {
          if (String(row.id) !== String(videoId)) return row;
          if (table === 'likes') {
            const likeCount = Math.max(0, Number(row.likeCount || 0) + delta);
            return {
              ...row,
              likeCount,
              fireCount: String(likeCount),
              hypeCount: likeCount,
            };
          }
          if (table === 'comments') {
            const commentCount = Math.max(
              0,
              Number(row.commentCount || 0) + delta
            );
            return {
              ...row,
              commentCount,
              banterCount: String(commentCount),
            };
          }
          return row;
        })
      );
    });
  }, [fromLive, feedIdKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { items, loading, error, refresh, category, fromLive };
}

export default useArenaFeed;
