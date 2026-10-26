/**
 * BAWAAL Arena posts ↔ Supabase `bawaal_posts` (+ Storage fallback).
 */
import { isSupabaseConfigured, supabase, getSupabaseUrl } from './supabase';
import {
  BAWAAL_VIDEO_BUCKET,
  ensurePublicBawaalVideoUrl,
} from './uploadService';

const TABLE = 'bawaal_posts';
const FEED = 'ARENA';

function toMs(value) {
  if (value == null) return Date.now();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/** Map a DB row → Arena feed post shape. */
export function mapDbRowToArenaPost(row) {
  if (!row || typeof row !== 'object') return null;
  const videoUri =
    ensurePublicBawaalVideoUrl(row.video_url || row.videoUri) ||
    row.video_url ||
    null;
  if (!videoUri) return null;

  const ts = toMs(row.created_at || row.createdAt || row.timestamp);
  const id = String(row.id || `arena-${ts}`);
  const title = String(row.title || row.caption || 'Arena drop');
  const author = row.author
    ? String(row.author).startsWith('@')
      ? String(row.author)
      : `@${String(row.author).replace(/^@/, '')}`
    : row.creator
      ? `@${String(row.creator).replace(/^@/, '')}`
      : '@you';

  return {
    id,
    type: 'reel',
    mode: row.mode || 'SPARKS',
    title,
    caption: String(row.caption || title),
    tagline: row.tagline || null,
    author,
    creator: row.creator || author.replace(/^@/, '') || 'You',
    category: row.category || row.sport || 'GYM',
    sport: row.sport || row.category || 'GYM',
    videoUri,
    uri: videoUri,
    recordedVideoUri: videoUri,
    publicCloudUrl: videoUri,
    remoteVideoUri: videoUri,
    hypeCount: Number(row.hype_count ?? row.hypeCount) || 0,
    durationSec: row.duration_sec != null ? Number(row.duration_sec) : undefined,
    slowMoEnabled: !!row.slow_mo_enabled,
    slowMoRate: row.slow_mo_rate != null ? Number(row.slow_mo_rate) : undefined,
    slowMoStartSec:
      row.slow_mo_start_sec != null ? Number(row.slow_mo_start_sec) : undefined,
    slowMoEndSec:
      row.slow_mo_end_sec != null ? Number(row.slow_mo_end_sec) : undefined,
    feed: row.feed || FEED,
    feedTarget: 'ARENA',
    timestamp: ts,
    createdAt: ts,
    _fromRemote: true,
  };
}

/** Map an in-memory Arena post → DB insert row. */
export function mapArenaPostToDbRow(post) {
  if (!post || typeof post !== 'object') return null;
  const videoUrl =
    ensurePublicBawaalVideoUrl(
      post.publicCloudUrl ||
        post.remoteVideoUri ||
        post.videoUri ||
        post.uri
    ) || post.videoUri;
  if (!videoUrl || !/^https:\/\//i.test(String(videoUrl))) return null;

  const ts = toMs(post.timestamp || post.createdAt);
  return {
    id: String(post.id || `arena-${ts}`),
    mode: post.mode || 'SPARKS',
    title: String(post.title || post.caption || 'Arena drop'),
    caption: String(post.caption || post.title || 'Arena drop'),
    tagline: post.tagline || null,
    author: post.author || '@you',
    creator: post.creator || 'You',
    category: post.category || post.sport || 'GYM',
    sport: post.sport || post.category || 'GYM',
    video_url: videoUrl,
    hype_count: Number(post.hypeCount) || 0,
    duration_sec: post.durationSec != null ? Number(post.durationSec) : null,
    slow_mo_enabled: !!post.slowMoEnabled,
    slow_mo_rate: post.slowMoRate != null ? Number(post.slowMoRate) : null,
    slow_mo_start_sec:
      post.slowMoStartSec != null ? Number(post.slowMoStartSec) : null,
    slow_mo_end_sec:
      post.slowMoEndSec != null ? Number(post.slowMoEndSec) : null,
    feed: FEED,
    created_at: new Date(ts).toISOString(),
  };
}

/**
 * Fetch Arena posts from Supabase, newest first.
 * @returns {Promise<object[]>}
 */
export async function fetchArenaPostsFromSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn('[arenaPosts] Supabase not configured — skip fetch');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('feed', FEED)
      .order('created_at', { ascending: false })
      // Lean cold-start page — avoid hydrating 100 decodable rows at once
      .limit(20);

    if (error) {
      console.warn(
        '[arenaPosts] table fetch failed:',
        error.message || error.code || error
      );
      // Recover clips that were uploaded to Storage before the table existed
      return fetchArenaPostsFromStorageFallback();
    }

    const mapped = (data || [])
      .map(mapDbRowToArenaPost)
      .filter(Boolean);

    if (mapped.length > 0) {
      console.log('[arenaPosts] loaded', mapped.length, 'rows from', TABLE);
      return mapped;
    }

    // Empty table → try Storage so older uploads still appear
    return fetchArenaPostsFromStorageFallback();
  } catch (err) {
    console.warn('[arenaPosts] fetch crashed:', err?.message || err);
    return fetchArenaPostsFromStorageFallback();
  }
}

/**
 * Fallback: list `bawaalvideos/battles` objects as anonymous reels.
 * Used when `bawaal_posts` is missing/empty so prior uploads still show.
 */
async function fetchArenaPostsFromStorageFallback() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .list('battles', {
        limit: 60,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.warn('[arenaPosts] storage list failed:', error.message || error);
      return [];
    }

    const base = getSupabaseUrl();
    const posts = (data || [])
      .filter(
        (f) =>
          f &&
          typeof f.name === 'string' &&
          /\.(mp4|mov|webm|m4v)$/i.test(f.name) &&
          !f.name.startsWith('.')
      )
      .map((f) => {
        const raw = `${base}/storage/v1/object/public/${BAWAAL_VIDEO_BUCKET}/battles/${f.name}`;
        const videoUri = ensurePublicBawaalVideoUrl(raw) || raw;
        const ts = toMs(f.created_at || f.updated_at);
        return mapDbRowToArenaPost({
          id: `storage-${f.name}`,
          title: 'BAWAAL Drop',
          caption: 'Arena drop',
          author: '@bawaal',
          creator: 'BAWAAL',
          video_url: videoUri,
          created_at: f.created_at || new Date(ts).toISOString(),
          feed: FEED,
        });
      })
      .filter(Boolean);

    console.log('[arenaPosts] storage fallback loaded', posts.length, 'clips');
    return posts;
  } catch (err) {
    console.warn('[arenaPosts] storage fallback crashed:', err?.message || err);
    return [];
  }
}

/**
 * Upsert a post into `bawaal_posts` so it survives app restart.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
export async function persistArenaPostToSupabase(post) {
  if (!isSupabaseConfigured()) {
    return { ok: false, skipped: true, reason: 'not-configured' };
  }
  if (post?._fromRemote || post?._skipPersist) {
    return { ok: true, skipped: true, reason: 'from-remote' };
  }

  const row = mapArenaPostToDbRow(post);
  if (!row) {
    return { ok: false, skipped: true, reason: 'missing-https-url' };
  }

  try {
    const { error } = await supabase.from(TABLE).upsert(row, {
      onConflict: 'id',
    });
    if (error) {
      console.warn(
        '[arenaPosts] persist failed:',
        error.message || error.code || error
      );
      return { ok: false, error: error.message || String(error) };
    }
    console.log('[arenaPosts] persisted', row.id);
    return { ok: true };
  } catch (err) {
    console.warn('[arenaPosts] persist crashed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
