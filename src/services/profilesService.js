/**
 * Passport ↔ Supabase `profiles` (+ V1 registration upsert).
 * V1 columns: id, username, real_name, age, gender, email, phone, country,
 * category, role, created_at — see `src/types/profile.js`.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { CURRENT_USER, FOLLOWING, SUGGESTED } from '../data/athleteSocial';
import { normalizePhoneE164 } from './authOtp';
import { normalizeRemoteImageUri } from '../constants/mediaFallbacks';

export const PROFILES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql (or supabase_schema.sql)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  return /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(
    msg
  );
}

/** Parse PostgREST "Could not find the 'age' column …" → `age`. */
function extractMissingColumn(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  const match =
    msg.match(/Could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    msg.match(/column ['"]([a-z0-9_]+)['"] (?:does not exist|of)/i) ||
    msg.match(/['"]([a-z0-9_]+)['"] (?:column of|was not found)/i);
  return match?.[1] || null;
}

function omitKeys(row, keys) {
  const next = { ...row };
  (keys || []).forEach((key) => {
    if (key in next) delete next[key];
  });
  return next;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function stripAt(raw) {
  return String(raw || '').trim().replace(/^@+/, '');
}

function normalizeHandle(raw) {
  const h = stripAt(raw) || 'athlete';
  return `@${h}`;
}

/**
 * Stable profiles.id for upsert — prefer auth.users uuid.
 * Non-uuid fallbacks (`phone:…` / `local:…`) only work on legacy text-PK tables.
 *
 * @param {object} userData
 * @param {{ id?: string } | null} authUser
 */
export function resolveProfileId(userData = {}, authUser = null) {
  if (authUser?.id && isUuid(authUser.id)) return String(authUser.id);
  if (authUser?.id) return String(authUser.id);

  const phone = normalizePhoneE164(userData.phone || userData.mobile || '');
  if (phone) return `phone:${phone}`;
  const handle = stripAt(userData.username || userData.handle || userData.displayName || 'athlete')
    .toLowerCase();
  return `local:${handle || 'athlete'}`;
}

/**
 * OTP SUBMIT / registration → `public.profiles` upsert (V1 + soft-compat columns).
 *
 * @param {object} userData — registration payload from RoleSelection
 * @param {{ id?: string } | null} [authUser] — supabase.auth user after verifyOtp
 */
export async function upsertRegisteredProfile(userData = {}, authUser = null) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, error: new Error('Supabase not configured') };
  }

  const id = resolveProfileId(userData, authUser);
  const username = stripAt(
    userData.username || userData.handle || userData.displayName || ''
  ).toLowerCase() || null;
  const handle = normalizeHandle(username || 'athlete');
  const realName = String(
    userData.real_name || userData.realName || userData.name || userData.full_name || ''
  ).trim();
  const phone =
    normalizePhoneE164(userData.phone || userData.mobile || '') || null;
  const email = String(userData.email || '').trim().toLowerCase() || null;
  const country =
    String(userData.country || userData.location || userData.city || '').trim() || null;
  const location = String(userData.location || userData.country || '').trim() || null;
  const role = String(userData.role || 'fan').toLowerCase();
  const category = String(
    userData.category || userData.sportInterest || userData.sport || userData.primarySport || ''
  ).trim() || null;
  const sport = category || 'OTHERS';
  const interests = Array.isArray(userData.sport_interests)
    ? userData.sport_interests.map(String)
    : Array.isArray(userData.sportInterests)
      ? userData.sportInterests.map(String)
      : sport
        ? [String(sport)]
        : [];
  const ageRaw = userData.age;
  const ageNum = Number(ageRaw);
  const age =
    Number.isFinite(ageNum) && ageNum > 0 ? Math.round(ageNum) : null;
  const gender = userData.gender ? String(userData.gender) : null;

  /**
   * Canonical V1 row — matches ENSURE_PROFILES / PROFILE_V1_COLUMNS.
   * `age` is only included when present so missing-column schema caches stay quiet.
   */
  const v1Row = {
    id,
    username,
    real_name: realName || null,
    ...(age != null ? { age } : {}),
    gender,
    email,
    phone,
    country,
    category: sport,
    role,
  };

  /** Full row with legacy soft-compat columns for Passport / Arena. */
  const fullRow = {
    ...v1Row,
    mobile: phone,
    location,
    sport_interests: interests,
    display_name: String(
      userData.displayName || userData.handle || username || realName || 'Athlete'
    ).trim(),
    handle,
    sport: String(sport),
    city: location,
    full_name: realName || null,
    primary_sport: String(sport),
    updated_at: new Date().toISOString(),
  };

  const runUpsert = (row) =>
    supabase.from('profiles').upsert(row, { onConflict: 'id' }).select('id').maybeSingle();

  try {
    // V1 expects auth.users uuid. Non-uuid ids only succeed on legacy text-PK tables.
    if (!isUuid(id)) {
      console.warn(
        '[profilesService] profiles.id is not an auth uuid — attempting legacy upsert. Live V1 requires verifyOtp session.'
      );
    }

    let payload = fullRow;
    let { data, error } = await runUpsert(payload);

    // Soft-compat: strip unknown columns (often `age`) until schema accepts the row
    let guard = 0;
    while (error && isSchemaCacheError(error) && guard < 8) {
      guard += 1;
      const missing = extractMissingColumn(error);
      if (missing && missing in payload) {
        payload = omitKeys(payload, [missing]);
      } else if (guard === 1) {
        // First fallback: lean V1 (still omits null age)
        payload = { ...v1Row };
      } else if ('age' in payload) {
        payload = omitKeys(payload, ['age']);
      } else {
        // Drop common soft-compat extras if the error didn't name a column
        payload = omitKeys(payload, [
          'mobile',
          'location',
          'sport_interests',
          'display_name',
          'handle',
          'sport',
          'city',
          'full_name',
          'primary_sport',
          'updated_at',
        ]);
        if (Object.keys(payload).length <= 2) break;
      }
      ({ data, error } = await runUpsert(payload));
    }

    if (error) throw error;
    return { ok: true, fromCloud: true, id: data?.id || id, error: null };
  } catch (error) {
    console.warn('[profilesService] upsertRegisteredProfile:', error?.message || error);
    return { ok: false, fromCloud: false, id, error };
  }
}

function mapProfileRow(row) {
  if (!row) return null;
  const handleRaw = String(row.handle || row.username || row.display_name || 'athlete');
  const handle = handleRaw.startsWith('@') ? handleRaw : `@${handleRaw.replace(/^@/, '')}`;
  return {
    id: String(row.id),
    displayName: String(row.display_name || row.real_name || row.username || 'Athlete'),
    username: handle.replace(/^@/, ''),
    handle,
    bio: row.bio || '',
    city: row.city || row.country || '',
    location: row.location || row.country || row.city || '',
    primarySport: row.category || row.sport || 'GYM',
    sport: row.category || row.sport || 'GYM',
    category: row.category || row.sport || null,
    email: row.email || null,
    phone: row.phone || row.mobile || null,
    country: row.country || null,
    tags: Array.isArray(row.tags)
      ? row.tags
      : row.category || row.sport
        ? [String(row.category || row.sport).toUpperCase()]
        : [],
    avatarUri:
      normalizeRemoteImageUri(row.avatar_url) ||
      normalizeRemoteImageUri(row.avatar_uri) ||
      null,
    verified: Boolean(row.verified),
    role: row.role || 'athlete',
    statusBadge: row.status_badge || null,
    online: Boolean(row.online),
    stats: {
      bawaalPts: Number(row.bawaal_pts) || 0,
      rank: row.rank != null ? Number(row.rank) : null,
      battlesWon: Number(row.battles_won) || 0,
      battlesFought:
        Number(row.battles_fought) || Number(row.battles_won) || 0,
      followers: Number(row.followers) || 0,
      following: Number(row.following_count) || 0,
      winRate: Number(row.win_rate) || 0,
    },
    metrics: [],
    clips: [],
    photos: [],
    listBucket: row.list_bucket || 'suggested',
  };
}

export async function fetchPassportGraph() {
  if (!isSupabaseConfigured()) {
    return {
      me: CURRENT_USER,
      following: FOLLOWING,
      suggested: SUGGESTED,
      fromCloud: false,
      error: new Error('Supabase not configured'),
    };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('followers', { ascending: false })
      .limit(80);
    if (error) throw error;

    const rows = (data || []).map(mapProfileRow).filter(Boolean);
    const cloudMe = rows.find((r) => r.listBucket === 'self' || r.id === 'me');
    const me = cloudMe
      ? {
          ...CURRENT_USER,
          ...cloudMe,
          stats: { ...CURRENT_USER.stats, ...cloudMe.stats },
          metrics: cloudMe.metrics?.length ? cloudMe.metrics : CURRENT_USER.metrics,
          clips: cloudMe.clips?.length ? cloudMe.clips : CURRENT_USER.clips,
          photos: cloudMe.photos?.length ? cloudMe.photos : CURRENT_USER.photos,
        }
      : CURRENT_USER;
    const following = rows.filter((r) => r.listBucket === 'following');
    const suggested = rows.filter((r) => r.listBucket === 'suggested');

    return {
      me,
      following: following.length ? following : FOLLOWING,
      suggested: suggested.length ? suggested : SUGGESTED,
      fromCloud: rows.length > 0,
      error: null,
    };
  } catch (error) {
    console.warn('[profilesService] fetchPassportGraph:', error?.message || error);
    return {
      me: CURRENT_USER,
      following: FOLLOWING,
      suggested: SUGGESTED,
      fromCloud: false,
      error,
    };
  }
}
