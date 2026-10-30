/**
 * BAWAAL data API — Supabase-backed Arena videos + open battles.
 * Soft-falls back to seed/mock data when offline or tables are missing.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { resolvePostSport } from '../utils/sportCategory';
import {
  seedBattlesOpenCallouts,
  CALLOUT_KIND_CHALLENGE,
} from '../utils/faceoffCallout';

/** Offline / cold-start Arena feed cards (api schema shape). */
const MOCK_ARENA_FEED = [
  {
    id: 'post_001',
    username: 'Yuki_Lift',
    handle: '@yuki_lift',
    location: 'Gold Gym Shibuya, Tokyo',
    category: 'GYM',
    avatarText: 'Y',
    videoUrl: null,
    targetBadge: '140 KG x 3 Reps',
    caption: 'Pushing heavy in Shibuya today! #Powerlifting #Japan',
    fireCount: '4.1K',
    banterCount: '184',
    aiVerified: true,
    distance: '3.1 km away',
    timestamp: '45m ago',
  },
  {
    id: 'post_002',
    username: 'Rohit_VK7',
    handle: '@rohit_vk7',
    location: 'Virar Boxing Club',
    category: 'COMBAT',
    avatarText: 'R',
    videoUrl: null,
    targetBadge: '120 Strikes / Min',
    caption: 'Morning speed bag round. Who wants a piece? #Boxing #Bawaal',
    fireCount: '2.8K',
    banterCount: '92',
    aiVerified: true,
    distance: '0.5 km away',
    timestamp: '10m ago',
  },
];

function profileHandle(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const raw =
    profile.username ||
    profile.handle ||
    profile.display_name ||
    profile.full_name ||
    null;
  if (!raw) return null;
  const cleaned = String(raw).replace(/^@/, '').trim();
  return cleaned ? `@${cleaned}` : null;
}

function profileAvatar(profile) {
  if (!profile || typeof profile !== 'object') return null;
  return profile.avatar_url || profile.avatar_uri || null;
}

function relativeLabel(iso) {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Map a `videos` row (+ optional nested profile) into Arena / api feed shape.
 */
export function mapVideoRowToFeedItem(row) {
  if (!row) return null;
  const profile = row.profiles || row.profile || null;
  const handle = profileHandle(profile) || '@athlete';
  const username = String(handle).replace(/^@/, '');
  const sport = resolvePostSport(
    { category: row.category, sport: row.category },
    'OTHERS'
  );
  const videoUrl = row.video_url || row.videoUrl || null;
  const createdAt = row.created_at || row.createdAt || null;
  const ts = createdAt ? Date.parse(createdAt) : Date.now();

  return {
    id: String(row.id),
    username,
    handle,
    fullName: profile?.full_name || profile?.display_name || username,
    avatarUrl: profileAvatar(profile),
    avatarText: username.charAt(0).toUpperCase() || 'A',
    category: sport,
    sport,
    caption: row.caption || '',
    videoUrl,
    video_url: videoUrl,
    videoUri: videoUrl,
    uri: videoUrl,
    type: 'reel',
    mode: 'SPARKS',
    author: handle,
    creator: username,
    title: row.caption || 'Arena drop',
    created_at: createdAt,
    createdAt: Number.isFinite(ts) ? ts : Date.now(),
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    relativeTime: relativeLabel(createdAt),
    fireCount: '0',
    banterCount: '0',
    hypeCount: 0,
    aiVerified: false,
    _fromVideosTable: true,
  };
}

/**
 * Map a `battles` open-challenge row into BATTLES Open Callouts / shelf shape.
 * Supports both the new creator_id schema and legacy host_id / title columns.
 */
export function mapBattleRowToCallout(row) {
  if (!row) return null;
  const creator = row.creator_profile || row.profiles || row.creator || null;
  const host =
    profileHandle(creator) ||
    (row.host_username
      ? `@${String(row.host_username).replace(/^@/, '')}`
      : null) ||
    '@athlete';
  const sport = resolvePostSport(
    {
      category: row.category,
      sport: row.sport || row.category,
    },
    'OTHERS'
  );
  const target =
    row.target_description ||
    row.title ||
    row.target ||
    row.description ||
    'Open challenge';
  const statusRaw = String(row.status || 'open').toLowerCase();
  const status =
    statusRaw === 'active' || statusRaw === 'hot' ? 'HOT' : 'OPEN';
  const videoUrl =
    row.creator_video_url ||
    row.opener_video_url ||
    row.creatorVideoUrl ||
    null;

  return {
    id: String(row.id),
    sport,
    category: sport,
    host,
    target,
    description: row.target_description || row.description || null,
    responses: Number(row.responses ?? row.response_count ?? 0) || 0,
    status,
    calloutKind: CALLOUT_KIND_CHALLENGE,
    isOpenChallenge: true,
    creatorVideoUrl: videoUrl,
    challengeVideoUri: videoUrl,
    createdAt: row.created_at || null,
  };
}

/**
 * Fetch Arena video items from `videos` joined with `profiles`, newest first.
 * @param {string} [category='ALL'] — BAWAAL_SPORTS filter (ALL = no filter)
 * @returns {Promise<object[]>}
 */
export async function fetchArenaFeed(category = 'ALL') {
  if (!isSupabaseConfigured()) {
    console.warn('[api] Supabase not configured — using mock Arena feed');
    return filterMockByCategory(MOCK_ARENA_FEED, category);
  }

  try {
    let query = supabase
      .from('videos')
      .select(
        `
        id,
        user_id,
        video_url,
        category,
        caption,
        created_at,
        profiles:user_id (
          username,
          full_name,
          avatar_url,
          handle,
          display_name,
          avatar_uri
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(40);

    const sport = String(category || 'ALL').trim().toUpperCase();
    if (sport && sport !== 'ALL') {
      query = query.eq('category', sport);
    }

    const { data, error } = await query;

    if (error) {
      // Retry without embed if profiles FK / schema cache is incomplete
      if (/relationship|embed|schema cache|foreign key|PGRST/i.test(
        String(error.message || error.code || '')
      )) {
        return fetchArenaFeedWithoutJoin(category);
      }
      console.warn('[api] videos fetch failed:', error.message || error);
      return filterMockByCategory(MOCK_ARENA_FEED, category);
    }

    const mapped = (data || []).map(mapVideoRowToFeedItem).filter(Boolean);
    if (mapped.length === 0) {
      console.warn('[api] videos empty — soft-fallback mock feed');
      return filterMockByCategory(MOCK_ARENA_FEED, category);
    }
    return mapped;
  } catch (err) {
    console.warn('[api] fetchArenaFeed crashed:', err?.message || err);
    return filterMockByCategory(MOCK_ARENA_FEED, category);
  }
}

async function fetchArenaFeedWithoutJoin(category = 'ALL') {
  try {
    let query = supabase
      .from('videos')
      .select('id, user_id, video_url, category, caption, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    const sport = String(category || 'ALL').trim().toUpperCase();
    if (sport && sport !== 'ALL') {
      query = query.eq('category', sport);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[api] videos lean fetch failed:', error.message || error);
      return filterMockByCategory(MOCK_ARENA_FEED, category);
    }

    const mapped = (data || []).map(mapVideoRowToFeedItem).filter(Boolean);
    return mapped.length
      ? mapped
      : filterMockByCategory(MOCK_ARENA_FEED, category);
  } catch (err) {
    console.warn('[api] lean videos fetch crashed:', err?.message || err);
    return filterMockByCategory(MOCK_ARENA_FEED, category);
  }
}

function filterMockByCategory(items, category) {
  const sport = String(category || 'ALL').trim().toUpperCase();
  if (!sport || sport === 'ALL') return items.slice();
  return items.filter(
    (item) => String(item.category || item.sport || '').toUpperCase() === sport
  );
}

/**
 * Fetch open / active challenges for the Arena shelf + BATTLES Open Callouts.
 * Tries new creator_id shape first, then legacy host_id / status='open' rows.
 * Soft-falls back to seed callouts.
 * @param {{ category?: string, limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchOpenBattles(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 24, 1), 60);
  const category = opts.category
    ? String(opts.category).trim().toUpperCase()
    : null;

  if (!isSupabaseConfigured()) {
    return filterCalloutsByCategory(seedBattlesOpenCallouts(), category);
  }

  const fromCreatorSchema = await fetchOpenBattlesCreatorSchema({
    category,
    limit,
  });
  if (fromCreatorSchema.length > 0) return fromCreatorSchema;

  const fromLegacy = await fetchOpenBattlesLegacyHost({ category, limit });
  if (fromLegacy.length > 0) return fromLegacy;

  console.warn('[api] open battles empty — soft-fallback seed callouts');
  return filterCalloutsByCategory(seedBattlesOpenCallouts(), category);
}

async function fetchOpenBattlesCreatorSchema({ category, limit }) {
  try {
    let query = supabase
      .from('battles')
      .select(
        `
        id,
        creator_id,
        responder_id,
        target_description,
        category,
        status,
        creator_video_url,
        responder_video_url,
        created_at,
        profiles:creator_id (
          username,
          full_name,
          avatar_url,
          handle,
          display_name
        )
      `
      )
      .in('status', ['open', 'active'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      // Column missing → legacy path
      if (/column|schema cache|PGRST204|does not exist|relationship/i.test(
        String(error.message || error.code || error.details || '')
      )) {
        return [];
      }
      console.warn(
        '[api] open battles (creator) failed:',
        error.message || error
      );
      return [];
    }

    return (data || [])
      .map((row) =>
        mapBattleRowToCallout({
          ...row,
          creator_profile: row.profiles,
        })
      )
      .filter(Boolean);
  } catch (err) {
    console.warn('[api] creator battles crashed:', err?.message || err);
    return [];
  }
}

async function fetchOpenBattlesLegacyHost({ category, limit }) {
  try {
    let query = supabase
      .from('battles')
      .select(
        'id, host_id, host_username, title, category, status, opener_video_url, created_at'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      console.warn(
        '[api] open battles (legacy) failed:',
        error.message || error
      );
      return [];
    }

    return (data || []).map(mapBattleRowToCallout).filter(Boolean);
  } catch (err) {
    console.warn('[api] legacy battles crashed:', err?.message || err);
    return [];
  }
}

function filterCalloutsByCategory(items, category) {
  if (!category || category === 'ALL') return items.slice();
  return items.filter(
    (item) => String(item.sport || item.category || '').toUpperCase() === category
  );
}

/**
 * Send a 'Fire' reaction to a post (best-effort; soft-fails offline).
 */
export async function firePost(postId) {
  if (!postId) return { success: false };
  if (!isSupabaseConfigured()) return { success: false, skipped: true };
  try {
    // Placeholder — wire to a reactions table when available
    console.log('[api] firePost', postId);
    return { success: true, local: true };
  } catch (error) {
    console.warn('[api] firePost failed:', error?.message || error);
    return { success: false };
  }
}
