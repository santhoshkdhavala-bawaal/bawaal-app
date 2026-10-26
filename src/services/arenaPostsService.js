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
/** Storage folder for JSON post metadata when `bawaal_posts` table is missing. */
const POSTS_META_PREFIX = 'posts';

/** PostgREST / Postgres signals that the table is absent from schema cache. */
export function isMissingBawaalPostsTableError(error) {
  const msg = String(error?.message || error?.details || error || '');
  const code = String(error?.code || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /schema cache/i.test(msg) ||
    /could not find the table/i.test(msg) ||
    /relation ["']?public\.?bawaal_posts["']? does not exist/i.test(msg)
  );
}

export const BAWAAL_POSTS_SETUP_HINT =
  'Open Supabase → SQL Editor → paste and run supabase/ENSURE_BAWAAL_POSTS.sql (creates public.bawaal_posts + reloads schema cache).';

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
      // Lean cold-start page — keep first paint snappy
      .limit(12);

    if (error) {
      console.warn(
        '[arenaPosts] table fetch failed:',
        error.message || error.code || error
      );
      // Table missing / schema cache → Storage JSON + video list
      const fromMeta = await fetchArenaPostsFromMetaJson();
      if (fromMeta.length > 0) return fromMeta;
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
    const fromMeta = await fetchArenaPostsFromMetaJson();
    if (fromMeta.length > 0) return fromMeta;
    return fetchArenaPostsFromStorageFallback();
  } catch (err) {
    console.warn('[arenaPosts] fetch crashed:', err?.message || err);
    const fromMeta = await fetchArenaPostsFromMetaJson();
    if (fromMeta.length > 0) return fromMeta;
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
 * When `bawaal_posts` is missing from schema cache, store metadata JSON in Storage
 * so the clip still appears on cold start via storage hydrate.
 */
async function persistArenaPostMetaToStorage(row) {
  const objectPath = `${POSTS_META_PREFIX}/${row.id}.json`;
  const body =
    typeof Blob !== 'undefined'
      ? new Blob([JSON.stringify(row)], { type: 'application/json' })
      : JSON.stringify(row);

  const { error } = await supabase.storage
    .from(BAWAAL_VIDEO_BUCKET)
    .upload(objectPath, body, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '60',
    });

  if (error) {
    console.warn(
      '[arenaPosts] storage meta fallback failed:',
      error.message || error
    );
    return { ok: false, error: error.message || String(error) };
  }
  console.log('[arenaPosts] stored meta JSON fallback:', objectPath);
  return { ok: true, reason: 'storage-meta-fallback' };
}

async function fetchArenaPostsFromMetaJson() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase.storage
      .from(BAWAAL_VIDEO_BUCKET)
      .list(POSTS_META_PREFIX, {
        limit: 40,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    if (error || !Array.isArray(data)) return [];

    const base = getSupabaseUrl();
    const posts = [];
    for (const file of data) {
      if (!file?.name || !/\.json$/i.test(file.name)) continue;
      try {
        const url = `${base}/storage/v1/object/public/${BAWAAL_VIDEO_BUCKET}/${POSTS_META_PREFIX}/${file.name}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const row = await res.json();
        const mapped = mapDbRowToArenaPost(row);
        if (mapped) posts.push(mapped);
      } catch (_) {
        /* skip bad meta files */
      }
    }
    if (posts.length) {
      console.log('[arenaPosts] loaded', posts.length, 'posts from storage JSON');
    }
    return posts;
  } catch (err) {
    console.warn('[arenaPosts] meta json fetch failed:', err?.message || err);
    return [];
  }
}

/**
 * Upsert a post into `bawaal_posts` so it survives app restart.
 * If the table is missing from PostgREST schema cache, falls back to Storage JSON.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, error?: string, warning?: string }>}
 */
export async function persistArenaPostToSupabase(post) {
  if (!isSupabaseConfigured()) {
    console.error('[arenaPosts] persist skipped — Supabase not configured');
    return { ok: false, skipped: false, reason: 'not-configured', error: 'Supabase not configured' };
  }
  if (post?._fromRemote || post?._skipPersist) {
    return { ok: true, skipped: true, reason: 'from-remote' };
  }

  const row = mapArenaPostToDbRow(post);
  if (!row) {
    console.error('[arenaPosts] persist skipped — missing https video_url', {
      id: post?.id,
      videoUri: post?.videoUri,
      publicCloudUrl: post?.publicCloudUrl,
    });
    return {
      ok: false,
      skipped: false,
      reason: 'missing-https-url',
      error: 'Missing public HTTPS video URL for database insert',
    };
  }

  const logFail = (step, error) => {
    const msg = error?.message || error?.code || String(error);
    console.error(`[arenaPosts] ${step} failed:`, msg, error);
    return msg;
  };

  try {
    // 1) Preferred: upsert on primary key
    const upsertRes = await supabase.from(TABLE).upsert(row, {
      onConflict: 'id',
    });
    if (!upsertRes.error) {
      console.log('[arenaPosts] upserted', row.id, row.video_url);
      return { ok: true };
    }
    logFail('upsert', upsertRes.error);

    // Table missing from schema cache → Storage JSON fallback (video already uploaded)
    if (isMissingBawaalPostsTableError(upsertRes.error)) {
      console.warn(
        '[arenaPosts] public.bawaal_posts missing from schema cache — using Storage meta fallback'
      );
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        return {
          ok: true,
          reason: 'storage-meta-fallback',
          warning: BAWAAL_POSTS_SETUP_HINT,
        };
      }
      return {
        ok: false,
        reason: 'missing-table',
        error: `${upsertRes.error?.message || 'Table missing'}\n\n${BAWAAL_POSTS_SETUP_HINT}`,
      };
    }

    // 2) Fallback: plain insert (first publish)
    const insertRes = await supabase.from(TABLE).insert(row);
    if (!insertRes.error) {
      console.log('[arenaPosts] inserted', row.id);
      return { ok: true };
    }
    logFail('insert', insertRes.error);

    if (isMissingBawaalPostsTableError(insertRes.error)) {
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        return {
          ok: true,
          reason: 'storage-meta-fallback',
          warning: BAWAAL_POSTS_SETUP_HINT,
        };
      }
    }

    // 3) Fallback: update existing row by id
    const updateRes = await supabase.from(TABLE).update(row).eq('id', row.id);
    if (!updateRes.error) {
      console.log('[arenaPosts] updated', row.id);
      return { ok: true };
    }
    const errMsg = logFail('update', updateRes.error);

    return {
      ok: false,
      error:
        errMsg ||
        upsertRes.error?.message ||
        'Could not save post to bawaal_posts (check RLS/GRANTs)',
    };
  } catch (err) {
    console.error('[arenaPosts] persist crashed:', err?.message || err);
    if (isMissingBawaalPostsTableError(err)) {
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        return {
          ok: true,
          reason: 'storage-meta-fallback',
          warning: BAWAAL_POSTS_SETUP_HINT,
        };
      }
    }
    return { ok: false, error: err?.message || String(err) };
  }
}
