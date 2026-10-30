/**
 * BAWAAL Arena posts ↔ Supabase `videos` (+ profiles) with Storage / AsyncStorage fallback.
 * Legacy `bawaal_posts` writes are still attempted as a soft secondary persist path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase, getSupabaseUrl } from './supabase';
import {
  BAWAAL_VIDEO_BUCKET,
  ensurePublicBawaalVideoUrl,
  isRemoteHttpsUri,
  sanitizePlayableFeedUri,
} from './uploadService';
import { resolvePostSport } from '../utils/sportCategory';

/** Canonical Arena feed table (joined with profiles on user_id). */
const TABLE = 'videos';
/** Legacy table — persist soft-fallback when `videos` insert is rejected. */
const LEGACY_TABLE = 'bawaal_posts';
const FEED = 'ARENA';
/** Storage folder for JSON post metadata when tables are missing. */
const POSTS_META_PREFIX = 'posts';
/** Device cache — keeps ChallengeCam file:// / https posts across reloads. */
const LOCAL_POSTS_KEY = '@bawaal/arena_local_posts_v1';
const LOCAL_POSTS_MAX = 40;

/** Live Arena select — videos joined with profile handle / avatar. */
const VIDEOS_WITH_PROFILES_SELECT = '*, profiles(username, avatar_url)';

/**
 * Normalize a ChallengeCam / Continue clip into a feed-safe post shape.
 * Guarantees videoUri + localVideoUri so ArenaClipPlayer never gets a blank card.
 */
export function mapChallengeClipToFeedPost(post = {}) {
  const local = sanitizePlayableFeedUri(
    post.localVideoUri ||
      (!isRemoteHttpsUri(post.recordedVideoUri) ? post.recordedVideoUri : null)
  );
  const cloud =
    sanitizePlayableFeedUri(post.publicCloudUrl) ||
    (isRemoteHttpsUri(post.videoUri)
      ? sanitizePlayableFeedUri(post.videoUri)
      : null) ||
    (isRemoteHttpsUri(post.uri) ? sanitizePlayableFeedUri(post.uri) : null);
  const playUri =
    cloud ||
    local ||
    sanitizePlayableFeedUri(post.videoUri) ||
    sanitizePlayableFeedUri(post.uri) ||
    sanitizePlayableFeedUri(post.recordedVideoUri) ||
    null;
  if (!playUri) return null;
  const ts = Number(post.timestamp || post.createdAt) || Date.now();
  return {
    ...post,
    id: String(post.id || `local-${ts}`),
    videoUri: playUri,
    uri: playUri,
    recordedVideoUri: playUri,
    localVideoUri: local || (!isRemoteHttpsUri(playUri) ? playUri : null),
    publicCloudUrl: cloud,
    remoteVideoUri: cloud,
    cloudUploaded: !!cloud,
    timestamp: ts,
    createdAt: ts,
  };
}

export async function loadLocalArenaPosts() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => mapChallengeClipToFeedPost(p))
      .filter(Boolean)
      .slice(0, LOCAL_POSTS_MAX);
  } catch (err) {
    console.warn('[arenaPosts] local cache read failed:', err?.message || err);
    return [];
  }
}

export async function cacheLocalArenaPost(post) {
  const mapped = mapChallengeClipToFeedPost(post);
  if (!mapped) return { ok: false, reason: 'missing-video-uri' };
  try {
    const existing = await loadLocalArenaPosts();
    const next = [
      mapped,
      ...existing.filter((p) => p.id !== mapped.id),
    ].slice(0, LOCAL_POSTS_MAX);
    await AsyncStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(next));
    return { ok: true, post: mapped };
  } catch (err) {
    console.warn('[arenaPosts] local cache write failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

function videoIdentityKey(uri) {
  if (!uri || typeof uri !== 'string') return '';
  const clean = uri.split('?')[0].trim().toLowerCase();
  const battles = clean.match(/\/battles\/([^/]+)$/);
  if (battles) return `battles/${battles[1]}`;
  return clean;
}

/** Prefer earlier entries (DB/meta) when the same mp4 appears again. */
function dedupePostsByVideo(posts) {
  const seen = new Set();
  const out = [];
  for (const p of posts || []) {
    if (!p) continue;
    const key =
      videoIdentityKey(p.videoUri || p.video_url || p.uri) || String(p.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** PostgREST / Postgres signals that a feed table is absent from schema cache. */
export function isMissingBawaalPostsTableError(error) {
  const msg = String(error?.message || error?.details || error || '');
  const code = String(error?.code || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /schema cache/i.test(msg) ||
    /could not find the table/i.test(msg) ||
    /relation ["']?public\.?(bawaal_posts|videos)["']? does not exist/i.test(msg)
  );
}

export const BAWAAL_POSTS_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase_schema.sql (creates public.videos + profiles) or supabase/ENSURE_BAWAAL_POSTS.sql.';

function toMs(value) {
  if (value == null) return Date.now();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/** Map a DB row (`videos` + optional nested `profiles`) → Arena feed post shape. */
export function mapDbRowToArenaPost(row) {
  if (!row || typeof row !== 'object') return null;
  const videoUri =
    ensurePublicBawaalVideoUrl(row.video_url || row.videoUri) ||
    row.video_url ||
    null;
  if (!videoUri) return null;

  const profile = row.profiles || row.profile || null;
  const profileUsername = profile?.username
    ? String(profile.username).replace(/^@/, '').trim()
    : null;
  const ts = toMs(row.created_at || row.createdAt || row.timestamp);
  const id = String(row.id || `arena-${ts}`);
  const title = String(row.title || row.caption || 'Arena drop');
  const author = row.author
    ? String(row.author).startsWith('@')
      ? String(row.author)
      : `@${String(row.author).replace(/^@/, '')}`
    : profileUsername
      ? `@${profileUsername}`
      : row.creator
        ? `@${String(row.creator).replace(/^@/, '')}`
        : '@athlete';
  const avatarUrl =
    profile?.avatar_url ||
    profile?.avatar_uri ||
    row.avatar_url ||
    row.avatarUrl ||
    null;

  return {
    id,
    type: 'reel',
    mode: row.mode || 'SPARKS',
    title,
    caption: String(row.caption || title),
    tagline: row.tagline || null,
    author,
    creator: row.creator || author.replace(/^@/, '') || 'Athlete',
    avatarUrl,
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl || null,
    category: resolvePostSport(row, 'GYM'),
    sport: resolvePostSport(row, 'GYM'),
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
    _fromVideosTable: true,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return UUID_RE.test(s) ? s : null;
}

/**
 * Canonical `videos` insert payload for Supabase.
 * Uses public Storage HTTPS `video_url` + FK-safe `user_id` (uuid only).
 * `sport_category` mirrors locked taxonomy into `category` (schema column).
 */
export function mapArenaPostToVideosRow(post) {
  if (!post || typeof post !== 'object') return null;
  const videoUrl =
    ensurePublicBawaalVideoUrl(
      post.video_url ||
        post.publicCloudUrl ||
        post.remoteVideoUri ||
        post.videoUri ||
        post.uri
    ) || null;
  if (!videoUrl || !/^https:\/\//i.test(String(videoUrl))) return null;

  const ts = toMs(post.timestamp || post.createdAt);
  const id = String(post.id || `arena-${ts}`);
  const uuidOk = UUID_RE.test(id);
  const userId = asUuidOrNull(
    post.user_id || post.userId || post.profileId || post.authorId
  );
  const sport = resolvePostSport(
    {
      ...post,
      category: post.sport_category || post.category || post.sport,
      sport: post.sport_category || post.sport || post.category,
    },
    'OTHERS'
  );
  const caption = String(
    post.caption || post.title || post.target || 'Arena drop'
  ).trim() || 'Arena drop';

  /** Public Storage URL + required fields; omit null user_id (FK/RLS safe). */
  const row = {
    ...(uuidOk ? { id } : {}),
    video_url: videoUrl,
    thumbnail_url: post.thumbnailUrl || post.thumbnail_url || null,
    caption,
    // Schema column is `category` (sport_category mapped from client)
    category: sport,
    created_at: new Date(ts).toISOString(),
  };
  if (userId) row.user_id = userId;
  return row;
}

/** Resolve auth.users uuid for videos.user_id FK (null when anonymous). */
export async function resolveVideosUserId(explicitId = null) {
  const fromExplicit = asUuidOrNull(explicitId);
  if (fromExplicit) return fromExplicit;
  try {
    const { data } = await supabase.auth.getUser();
    return asUuidOrNull(data?.user?.id) || null;
  } catch (_) {
    return null;
  }
}

/** Map an in-memory Arena post → legacy `bawaal_posts` insert row. */
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
    category: resolvePostSport(post, 'GYM'),
    sport: resolvePostSport(post, 'GYM'),
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
 * Offline / empty-table fallback chain: Storage meta JSON + listed battle clips.
 * Keeps Arena usable when `videos` is empty or unreachable during local testing.
 */
async function fetchOfflineArenaFallbacks() {
  const fromMeta = await fetchArenaPostsFromMetaJson();
  const fromFiles = await fetchArenaPostsFromStorageFallback();
  return dedupePostsByVideo([...fromMeta, ...fromFiles]);
}

/**
 * Fetch Arena posts from Supabase `videos` ⨝ `profiles`, newest first.
 * Soft-falls back to Storage / local mock clips when offline or empty.
 * @returns {Promise<object[]>}
 */
export async function fetchArenaPostsFromSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn(
      '[arenaPosts] Supabase not configured — offline/local fallback only'
    );
    return fetchOfflineArenaFallbacks();
  }

  try {
    // Canonical live query: videos + profile username / avatar
    let { data, error } = await supabase
      .from(TABLE)
      .select(VIDEOS_WITH_PROFILES_SELECT)
      .order('created_at', { ascending: false })
      // Lean cold-start page — keep first paint snappy
      .limit(12);

    // Embed missing / schema cache → lean videos select (still live)
    if (
      error &&
      /relationship|embed|schema cache|foreign key|PGRST/i.test(
        String(error.message || error.code || '')
      )
    ) {
      console.warn(
        '[arenaPosts] profiles embed failed — retrying videos *:',
        error.message || error
      );
      const lean = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(12);
      data = lean.data;
      error = lean.error;
    }

    if (error) {
      console.warn(
        '[arenaPosts] videos fetch failed:',
        error.message || error.code || error
      );
      // Table missing / network → Storage JSON + video list (deduped)
      return fetchOfflineArenaFallbacks();
    }

    const mapped = (data || []).map(mapDbRowToArenaPost).filter(Boolean);

    if (mapped.length > 0) {
      console.log('[arenaPosts] loaded', mapped.length, 'rows from', TABLE);
      // Merge storage-only clips that aren't already in the table (no duplicates)
      const extras = await fetchArenaPostsFromStorageFallback();
      return dedupePostsByVideo([...mapped, ...extras]);
    }

    // Empty `videos` table → Storage / legacy clips so local testing still shows media
    console.warn(
      '[arenaPosts] videos empty — offline/local Storage fallback'
    );
    return fetchOfflineArenaFallbacks();
  } catch (err) {
    console.warn('[arenaPosts] fetch crashed:', err?.message || err);
    return fetchOfflineArenaFallbacks();
  }
}

/**
 * Fallback: list `bawaalvideos/battles` objects as anonymous reels.
 * Used when `videos` is missing/empty so prior uploads still show.
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
 * Upsert a post into `videos` (preferred) so it survives app restart.
 * Soft-falls back to legacy `bawaal_posts`, then Storage JSON.
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

  // Always mirror into device cache so Continue clips survive reload (file:// or https)
  const deviceMapped = mapChallengeClipToFeedPost(post);
  if (deviceMapped) {
    void cacheLocalArenaPost(deviceMapped);
  }

  // Attach auth uuid when present so RLS / profiles FK succeed
  let enriched = post;
  try {
    const authId = await resolveVideosUserId(post?.user_id || post?.userId);
    if (authId && !asUuidOrNull(post?.user_id || post?.userId)) {
      enriched = { ...post, user_id: authId, userId: authId };
    }
  } catch (_) {
    enriched = post;
  }

  const videosRow = mapArenaPostToVideosRow(enriched);
  const legacyRow = mapArenaPostToDbRow(enriched);
  if (!videosRow && !legacyRow) {
    // Soft skip — keep local file:// / uri on the feed card until Storage succeeds
    const localFallback =
      deviceMapped?.localVideoUri ||
      deviceMapped?.videoUri ||
      (typeof enriched?.localVideoUri === 'string' &&
        enriched.localVideoUri.trim()) ||
      (typeof enriched?.videoUri === 'string' &&
        !/^https:\/\//i.test(enriched.videoUri) &&
        enriched.videoUri.trim()) ||
      (typeof enriched?.uri === 'string' &&
        !/^https:\/\//i.test(enriched.uri) &&
        enriched.uri.trim()) ||
      null;
    console.warn('[arenaPosts] persist deferred — missing https video_url', {
      id: enriched?.id,
      videoUri: enriched?.videoUri,
      publicCloudUrl: enriched?.publicCloudUrl,
      localVideoUri: localFallback || enriched?.localVideoUri,
    });
    return {
      ok: false,
      skipped: true,
      reason: 'missing-https-url',
      error: 'Missing public HTTPS video URL for database insert',
      localVideoUri: localFallback,
      post: deviceMapped,
    };
  }

  const logFail = (step, error) => {
    const msg = error?.message || error?.code || String(error);
    // Schema-cache / missing-table noise must stay warn-only (never Alert / LogBox red)
    if (isMissingBawaalPostsTableError(error)) {
      console.warn(`[arenaPosts] ${step} skipped (schema):`, msg);
    } else {
      console.warn(`[arenaPosts] ${step} failed:`, msg);
    }
    return msg;
  };

  try {
    // 1) Preferred: insert into canonical `videos` with public video_url
    if (videosRow) {
      const tryInsert = async (row) => {
        if (row.id) {
          const upsert = await supabase
            .from(TABLE)
            .upsert(row, { onConflict: 'id' });
          if (!upsert.error) return { ok: true, via: 'upsert' };
          const ins = await supabase.from(TABLE).insert(row);
          if (!ins.error) return { ok: true, via: 'insert' };
          return { ok: false, error: ins.error || upsert.error };
        }
        const ins = await supabase.from(TABLE).insert(row);
        if (!ins.error) return { ok: true, via: 'insert' };
        return { ok: false, error: ins.error };
      };

      let attempt = await tryInsert(videosRow);
      const errText = (e) =>
        String(e?.message || e?.code || e || '');
      // FK / RLS on user_id → retry without user_id
      if (
        !attempt.ok &&
        videosRow.user_id &&
        /user_id|foreign key|violates|23503|42501|RLS/i.test(
          errText(attempt.error)
        )
      ) {
        const { user_id: _omit, ...withoutUser } = videosRow;
        attempt = await tryInsert(withoutUser);
      }
      // Unknown `sport_category` column → already using `category`; strip extras if any
      if (
        !attempt.ok &&
        /sport_category|column|schema cache|PGRST204/i.test(
          errText(attempt.error)
        )
      ) {
        const { sport_category: _sc, ...clean } = videosRow;
        attempt = await tryInsert(clean);
      }
      if (attempt.ok) {
        console.log(
          '[arenaPosts] videos',
          attempt.via,
          videosRow.video_url
        );
        return { ok: true };
      }
      logFail('videos insert', attempt.error);
    }

    // 2) Soft secondary: legacy `bawaal_posts` shape
    const row = legacyRow;
    if (!row) {
      const fb = await persistArenaPostMetaToStorage(videosRow);
      return fb.ok
        ? { ok: true, reason: 'storage-meta-fallback' }
        : { ok: true, reason: 'storage-live-no-meta' };
    }

    const upsertRes = await supabase.from(LEGACY_TABLE).upsert(row, {
      onConflict: 'id',
    });
    if (!upsertRes.error) {
      console.log('[arenaPosts] upserted legacy', row.id, row.video_url);
      return { ok: true, reason: 'legacy-bawaal-posts' };
    }
    logFail('legacy upsert', upsertRes.error);

    // Table missing from schema cache → Storage JSON fallback (video already uploaded)
    if (isMissingBawaalPostsTableError(upsertRes.error)) {
      console.warn(
        '[arenaPosts] feed tables missing from schema cache — using Storage meta fallback'
      );
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        // Clip is live — soft success, no UI warning payload
        return { ok: true, reason: 'storage-meta-fallback' };
      }
      // Still treat as soft-ok when the HTTPS video already exists in Storage
      return { ok: true, reason: 'storage-live-no-meta' };
    }

    // 3) Fallback: plain insert on legacy table
    const insertRes = await supabase.from(LEGACY_TABLE).insert(row);
    if (!insertRes.error) {
      console.log('[arenaPosts] inserted legacy', row.id);
      return { ok: true, reason: 'legacy-bawaal-posts' };
    }
    logFail('legacy insert', insertRes.error);

    if (isMissingBawaalPostsTableError(insertRes.error)) {
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        return { ok: true, reason: 'storage-meta-fallback' };
      }
      return { ok: true, reason: 'storage-live-no-meta' };
    }

    // 4) Fallback: update existing legacy row by id
    const updateRes = await supabase
      .from(LEGACY_TABLE)
      .update(row)
      .eq('id', row.id);
    if (!updateRes.error) {
      console.log('[arenaPosts] updated legacy', row.id);
      return { ok: true, reason: 'legacy-bawaal-posts' };
    }
    const errMsg = logFail('legacy update', updateRes.error);

    // Last resort — Storage meta so the clip remains discoverable offline
    const fb = await persistArenaPostMetaToStorage(row);
    if (fb.ok) {
      return { ok: true, reason: 'storage-meta-fallback' };
    }

    return {
      ok: false,
      error:
        errMsg ||
        upsertRes.error?.message ||
        'Could not save post to videos / bawaal_posts (check RLS/GRANTs)',
    };
  } catch (err) {
    console.error('[arenaPosts] persist crashed:', err?.message || err);
    if (isMissingBawaalPostsTableError(err)) {
      const fb = await persistArenaPostMetaToStorage(row);
      if (fb.ok) {
        return { ok: true, reason: 'storage-meta-fallback' };
      }
      return { ok: true, reason: 'storage-live-no-meta' };
    }
    return { ok: false, error: err?.message || String(err) };
  }
}
