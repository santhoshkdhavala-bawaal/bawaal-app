/**
 * Passport ↔ Supabase `profiles` (+ registration upsert).
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { CURRENT_USER, FOLLOWING, SUGGESTED } from '../data/athleteSocial';
import { normalizePhoneE164 } from './authOtp';

export const PROFILES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql (or ENSURE_LOCKER_CLINIC_PROFILES.sql)';

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  return /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(
    msg
  );
}

function normalizeHandle(raw) {
  const h = String(raw || 'athlete').trim().replace(/^@+/, '');
  return h ? `@${h}` : '@athlete';
}

/**
 * Stable profiles.id for upsert — prefer auth uuid; else phone / handle text key.
 * @param {object} userData
 * @param {{ id?: string } | null} authUser
 */
export function resolveProfileId(userData = {}, authUser = null) {
  if (authUser?.id) return String(authUser.id);
  const phone = normalizePhoneE164(userData.phone || userData.mobile || '');
  if (phone) return `phone:${phone}`;
  const handle = String(userData.handle || userData.displayName || 'athlete')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  return `local:${handle || 'athlete'}`;
}

/**
 * SUBMIT / registration → `public.profiles` upsert.
 * Columns: id, real_name, gender, age, mobile, location, role, sport_interests
 * (+ soft-compat display_name / handle / sport / city / full_name).
 *
 * @param {object} userData — registration payload from AthleteRegistrationScreen / RoleSelection
 * @param {{ id?: string } | null} [authUser]
 */
export async function upsertRegisteredProfile(userData = {}, authUser = null) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, error: new Error('Supabase not configured') };
  }

  const id = resolveProfileId(userData, authUser);
  const handle = normalizeHandle(userData.handle || userData.displayName);
  const realName = String(userData.realName || userData.name || userData.full_name || '').trim();
  const mobile = normalizePhoneE164(userData.phone || userData.mobile || '') || null;
  const location = String(userData.location || '').trim() || null;
  const role = String(userData.role || 'fan').toLowerCase();
  const sport =
    userData.sportInterest || userData.sport || userData.primarySport || 'OTHERS';
  const interests = Array.isArray(userData.sport_interests)
    ? userData.sport_interests.map(String)
    : Array.isArray(userData.sportInterests)
      ? userData.sportInterests.map(String)
      : sport
        ? [String(sport)]
        : [];
  const ageRaw = userData.age;
  const ageNum = Number(ageRaw);
  const age = Number.isFinite(ageNum) && ageNum > 0 ? Math.round(ageNum) : null;

  const fullRow = {
    id,
    real_name: realName || null,
    gender: userData.gender || null,
    age,
    mobile,
    location,
    role,
    sport_interests: interests,
    display_name: String(userData.displayName || userData.handle || realName || 'Athlete').trim(),
    handle,
    sport: String(sport),
    city: location,
    full_name: realName || null,
    primary_sport: String(sport),
    list_bucket: 'self',
    updated_at: new Date().toISOString(),
  };

  const slimRow = {
    id: fullRow.id,
    real_name: fullRow.real_name,
    gender: fullRow.gender,
    age: fullRow.age,
    mobile: fullRow.mobile,
    location: fullRow.location,
    role: fullRow.role,
    sport_interests: fullRow.sport_interests,
  };

  try {
    let { data, error } = await supabase
      .from('profiles')
      .upsert(fullRow, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    if (error && isSchemaCacheError(error)) {
      ({ data, error } = await supabase
        .from('profiles')
        .upsert(slimRow, { onConflict: 'id' })
        .select('id')
        .maybeSingle());
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
  const handleRaw = String(row.handle || row.display_name || 'athlete');
  const handle = handleRaw.startsWith('@') ? handleRaw : `@${handleRaw.replace(/^@/, '')}`;
  return {
    id: String(row.id),
    displayName: String(row.display_name || 'Athlete'),
    username: handle.replace(/^@/, ''),
    handle,
    bio: row.bio || '',
    city: row.city || '',
    location: row.location || row.city || '',
    primarySport: row.sport || 'GYM',
    sport: row.sport || 'GYM',
    tags: Array.isArray(row.tags)
      ? row.tags
      : row.sport
        ? [String(row.sport).toUpperCase()]
        : [],
    avatarUri: row.avatar_uri || null,
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
