/**
 * Passport ↔ Supabase `profiles` (+ registration save).
 * Writes use PROFILE_SAFE_WRITE_COLUMNS; missing-column 400s soft-strip.
 * Non-UUID / local-dev never hits PostgREST (session circuit-breaker).
 * See `src/types/profile.js` + `supabase/ENSURE_PROFILES_SPORTS_HUBS.sql`.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { CURRENT_USER, FOLLOWING, SUGGESTED } from '../data/athleteSocial';
import { normalizePhoneE164 } from './authOtp';
import { normalizeRemoteImageUri } from '../constants/mediaFallbacks';
import {
  PROFILE_BASE_WRITE_COLUMNS,
  PROFILE_PAYLOAD_DENYLIST,
  PROFILE_SAFE_WRITE_COLUMNS,
} from '../types/profile';
import { softFailWarn } from '../utils/softFailLog';

export const PROFILES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql (or migrations/008_ensure_profiles_registration_columns.sql)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_DENYLIST_SET = new Set(PROFILE_PAYLOAD_DENYLIST);
const MAX_SCHEMA_STRIP_RETRIES = 4;

/**
 * Session circuit-breaker: once local/dev mode or a hard remote failure is seen,
 * skip further profiles queries for this JS session (stops retry / console spam).
 */
let remoteProfilesCircuitOpen = false;
let remoteProfilesCircuitReason = '';

function openRemoteProfilesCircuit(reason) {
  if (!remoteProfilesCircuitOpen) {
    remoteProfilesCircuitReason = String(reason || 'unknown');
    softFailWarn('profiles:circuit', '[profilesService] remote profiles short-circuited for this session', { reason: remoteProfilesCircuitReason });
  }
  remoteProfilesCircuitOpen = true;
}

function isRemoteProfilesDisabled() {
  return remoteProfilesCircuitOpen;
}

/** Local mock success — registration continues without cloud profiles. */
function localProfileSuccess(id, reason) {
  openRemoteProfilesCircuit(reason);
  return {
    ok: true,
    fromCloud: false,
    id: id || `local:offline`,
    error: null,
    localFallback: true,
  };
}

/** PostgREST / Postgres reject non-UUID into uuid `profiles.id`. */
function isInvalidUuidError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  const code = String(error?.code || '');
  return (
    code === '22P02' ||
    /invalid input syntax for type uuid/i.test(msg)
  );
}

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  const code = String(error?.code || '');
  return (
    code === 'PGRST204' ||
    /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(msg)
  );
}

/** Hard 400s that should trip the circuit (not soft-strippable missing columns). */
function isHardHttp400Error(error) {
  if (!error) return false;
  if (isSchemaCacheError(error)) return false;
  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const msg = String(error.message || error.details || error.hint || error || '');
  return (
    status === 400 ||
    status === 404 ||
    code === '400' ||
    code === '404' ||
    code === '22P02' ||
    /bad request|invalid input syntax for type uuid/i.test(msg)
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

/**
 * Drop undefined / null / empty-string values. Optionally restrict to an allowlist.
 * Always strips PROFILE_PAYLOAD_DENYLIST keys (list_bucket, client junk, …).
 * @param {Record<string, unknown>} row
 * @param {readonly string[]} [allowlist]
 */
export function compactProfilePayload(row, allowlist) {
  const src = row && typeof row === 'object' ? row : {};
  const keys = Array.isArray(allowlist) && allowlist.length
    ? allowlist
    : Object.keys(src);
  const out = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    if (PROFILE_DENYLIST_SET.has(key)) continue;
    const value = src[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

/**
 * Final sanitizer before every profiles insert / update / upsert.
 * Maps form aliases onto schema columns, then allowlists + denylists.
 *
 * @param {Record<string, unknown>} row
 * @param {readonly string[]} [allowlist]
 * @returns {Record<string, unknown>}
 */
export function sanitizeProfileWritePayload(
  row = {},
  allowlist = PROFILE_SAFE_WRITE_COLUMNS
) {
  const src = row && typeof row === 'object' ? { ...row } : {};

  // Name: keep both full_name (base) and real_name (V1) when present
  const mappedName =
    src.real_name ||
    src.realName ||
    src.full_name ||
    src.display_name ||
    src.displayName ||
    src.name;
  if (mappedName != null && String(mappedName).trim()) {
    const name = String(mappedName).trim();
    if (src.full_name == null || src.full_name === '') src.full_name = name;
    if (src.real_name == null || src.real_name === '') src.real_name = name;
  }

  // Sport: category (V1) + primary_sport (base)
  const mappedSport =
    src.category || src.sport || src.sportInterest || src.primarySport || src.primary_sport;
  if (mappedSport != null && String(mappedSport).trim()) {
    const sport = String(mappedSport).trim();
    if (src.primary_sport == null || src.primary_sport === '') src.primary_sport = sport;
    if (src.category == null || src.category === '') src.category = sport;
  }

  // Avatar: avatar_url canonical; mirror avatar_uri for older Passport joins
  const mappedAvatar =
    src.avatar_url || src.avatarUri || src.avatar_uri || src.avatarUrl;
  if (mappedAvatar != null && String(mappedAvatar).trim()) {
    const avatar = String(mappedAvatar).trim();
    if (src.avatar_url == null || src.avatar_url === '') src.avatar_url = avatar;
    if (src.avatar_uri == null || src.avatar_uri === '') src.avatar_uri = avatar;
  }

  // Location: city_country + location + country
  const cityCountry =
    src.city_country ||
    src.location ||
    [src.city, src.country].filter(Boolean).join(', ') ||
    null;
  if (cityCountry && String(cityCountry).trim()) {
    const loc = String(cityCountry).trim();
    if (src.city_country == null || src.city_country === '') src.city_country = loc;
    if (src.location == null || src.location === '') src.location = loc;
  }

  // Age: coerce finite positive ints only
  if (src.age != null && src.age !== '') {
    const ageNum = Number(src.age);
    if (Number.isFinite(ageNum) && ageNum > 0 && ageNum < 150) {
      src.age = Math.floor(ageNum);
    } else {
      delete src.age;
    }
  }

  return compactProfilePayload(src, allowlist);
}

function logUpsertFailure(stage, error, payload) {
  const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
  softFailWarn('profiles:upsert', '[profilesService] upsertRegisteredProfile failed', {
    stage,
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
    status: error?.status || error?.statusCode || null,
    payloadKeys: keys,
  });
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function stripAt(raw) {
  return String(raw || '').trim().replace(/^@+/, '');
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
 * Build a sanitized profiles write row from registration form data.
 *
 * @param {object} userData
 * @param {{ id?: string } | null} [authUser]
 */
export function buildRegistrationProfilePayload(userData = {}, authUser = null) {
  const id = resolveProfileId(userData, authUser);
  const username =
    stripAt(userData.username || userData.handle || userData.displayName || '').toLowerCase() ||
    null;
  const realName = String(
    userData.real_name || userData.realName || userData.name || userData.full_name || ''
  ).trim();
  const phone = normalizePhoneE164(userData.phone || userData.mobile || '') || null;
  const email = String(userData.email || '').trim().toLowerCase() || null;
  const gender = String(userData.gender || '').trim() || null;
  const role = String(userData.role || '').trim() || null;
  const ageRaw = userData.age;
  const ageNum = ageRaw == null || ageRaw === '' ? null : Number(ageRaw);
  const age =
    ageNum != null && Number.isFinite(ageNum) && ageNum > 0 ? Math.floor(ageNum) : null;
  const category =
    String(
      userData.category ||
        userData.sportInterest ||
        userData.sport ||
        userData.primarySport ||
        ''
    ).trim() || null;
  const sport = category || 'OTHERS';
  const locationRaw = String(
    userData.location || userData.city_country || userData.country || ''
  ).trim();
  const country =
    String(userData.country || '').trim() ||
    (locationRaw.includes(',')
      ? locationRaw.split(',').slice(-1)[0].trim()
      : locationRaw) ||
    null;
  const cityCountry = locationRaw || country || null;
  const avatarUrl =
    normalizeRemoteImageUri(userData.avatar_url) ||
    normalizeRemoteImageUri(userData.avatarUrl) ||
    normalizeRemoteImageUri(userData.avatarUri) ||
    normalizeRemoteImageUri(userData.avatar_uri) ||
    null;

  const mapped = {
    id,
    username,
    full_name: realName || null,
    real_name: realName || null,
    age,
    gender,
    email,
    phone,
    country,
    location: cityCountry,
    city_country: cityCountry,
    category: sport,
    role,
    avatar_url: avatarUrl,
    avatar_uri: avatarUrl,
    primary_sport: sport,
  };

  const v1 = sanitizeProfileWritePayload(mapped);
  const soft = sanitizeProfileWritePayload({
    full_name: realName || null,
    real_name: realName || null,
    primary_sport: sport,
    category: sport,
    avatar_url: avatarUrl,
    avatar_uri: avatarUrl,
    email,
    phone,
    gender,
    role,
    age,
    country,
    location: cityCountry,
    city_country: cityCountry,
  });

  return { id, v1, soft, lookup: { phone, username, email } };
}

/**
 * One upsert attempt. Does NOT open the circuit on schema-cache misses
 * (caller soft-strips). Opens circuit on hard 400 / invalid UUID.
 *
 * @param {Record<string, unknown>} row
 * @returns {Promise<{ data: { id?: string }|null, error: any, localFallback?: boolean, legacySkipped?: boolean }>}
 */
async function persistProfileRow(row) {
  if (isRemoteProfilesDisabled()) {
    return { data: null, error: null, legacySkipped: true, localFallback: true };
  }

  try {
    const payload = sanitizeProfileWritePayload(row);
    if (!payload || typeof payload !== 'object' || !Object.keys(payload).length) {
      return { data: null, error: new Error('empty profiles payload after sanitize') };
    }

    const id = payload.id != null ? String(payload.id) : null;
    const authUuid = id && isUuid(id);

    // No auth UUID → never hit Supabase (stops 400 / retry loops in local-dev)
    if (!authUuid) {
      openRemoteProfilesCircuit('persist-non-uuid');
      return {
        data: { id: id || 'local:offline' },
        error: null,
        legacySkipped: true,
        localFallback: true,
      };
    }

    try {
      const result = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .maybeSingle();

      if (result.error) {
        if (isSchemaCacheError(result.error)) {
          // Soft strip handled by caller — do not trip circuit yet
          return result;
        }
        if (isHardHttp400Error(result.error) || isInvalidUuidError(result.error)) {
          openRemoteProfilesCircuit('upsert-400');
          return {
            data: null,
            error: result.error,
            legacySkipped: true,
            localFallback: true,
          };
        }
      }
      return result;
    } catch (err) {
      if (isSchemaCacheError(err)) {
        return { data: null, error: err };
      }
      if (isHardHttp400Error(err) || isInvalidUuidError(err)) {
        openRemoteProfilesCircuit('upsert-throw');
      }
      return { data: null, error: err, legacySkipped: true, localFallback: true };
    }
  } catch (err) {
    if (isHardHttp400Error(err) || isInvalidUuidError(err)) {
      openRemoteProfilesCircuit('persist-throw');
    }
    return { data: null, error: err, legacySkipped: true, localFallback: true };
  }
}

/**
 * Upsert with progressive column strip on PGRST204 / schema-cache misses.
 * Falls back to PROFILE_BASE_WRITE_COLUMNS, then local success.
 */
async function persistWithSchemaStrip(initialPayload) {
  let payload = sanitizeProfileWritePayload(initialPayload);
  let result = await persistProfileRow(payload);

  if (result.localFallback || result.legacySkipped || isRemoteProfilesDisabled()) {
    return result;
  }

  let guard = 0;
  while (result.error && isSchemaCacheError(result.error) && guard < MAX_SCHEMA_STRIP_RETRIES) {
    guard += 1;
    const missing = extractMissingColumn(result.error);
    if (missing && missing !== 'id' && missing in payload) {
      payload = sanitizeProfileWritePayload(omitKeys(payload, [missing]));
    } else if (guard === 1) {
      // Unknown which column — collapse to base schema once
      payload = sanitizeProfileWritePayload(payload, PROFILE_BASE_WRITE_COLUMNS);
    } else {
      break;
    }

    if (!Object.keys(payload).length || (Object.keys(payload).length === 1 && payload.id)) {
      break;
    }

    result = await persistProfileRow(payload);
    if (result.localFallback || result.legacySkipped || isRemoteProfilesDisabled()) {
      return result;
    }
  }

  return { ...result, payload };
}

/**
 * OTP SUBMIT / registration → `public.profiles` save.
 *
 * @param {object} userData — registration payload from RoleSelection
 * @param {{ id?: string } | null} [authUser] — supabase.auth user after verifyOtp
 */
export async function upsertRegisteredProfile(userData = {}, authUser = null) {
  const { id, v1, soft } = buildRegistrationProfilePayload(userData, authUser);

  // Local / legacy / circuit already open → zero remote calls
  if (!isSupabaseConfigured()) {
    return localProfileSuccess(id, 'supabase-not-configured');
  }
  if (isRemoteProfilesDisabled()) {
    return localProfileSuccess(id, remoteProfilesCircuitReason || 'circuit-open');
  }
  if (!isUuid(id)) {
    return localProfileSuccess(id, 'non-uuid-local-dev');
  }

  if (!v1.id) {
    v1.id = id;
  }

  try {
    const persist = await persistWithSchemaStrip({ ...v1, id });

    if (persist.localFallback || persist.legacySkipped || isRemoteProfilesDisabled()) {
      return localProfileSuccess(id, 'persist-local-fallback');
    }

    if (persist.error) {
      if (
        isHardHttp400Error(persist.error) ||
        isInvalidUuidError(persist.error) ||
        isSchemaCacheError(persist.error)
      ) {
        return localProfileSuccess(id, 'upsert-schema-or-400');
      }
      logUpsertFailure('v1-persist', persist.error, persist.payload || v1);
      return localProfileSuccess(id, 'upsert-error');
    }

    const savedId = persist.data?.id || id;

    // Soft patch once — never cascade on failure
    const softPatch = omitKeys(sanitizeProfileWritePayload(soft), ['id']);
    if (
      Object.keys(softPatch).length > 0 &&
      isUuid(savedId) &&
      !isRemoteProfilesDisabled()
    ) {
      try {
        let patch = softPatch;
        let softResult = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', savedId)
          .select('id')
          .maybeSingle();

        let softGuard = 0;
        while (
          softResult.error &&
          isSchemaCacheError(softResult.error) &&
          softGuard < 4
        ) {
          softGuard += 1;
          const miss = extractMissingColumn(softResult.error);
          if (!miss || !(miss in patch)) break;
          patch = omitKeys(patch, [miss]);
          if (!Object.keys(patch).length) break;
          softResult = await supabase
            .from('profiles')
            .update(patch)
            .eq('id', savedId)
            .select('id')
            .maybeSingle();
        }

        if (
          softResult.error &&
          (isHardHttp400Error(softResult.error) || isInvalidUuidError(softResult.error))
        ) {
          openRemoteProfilesCircuit('soft-patch-400');
        }
      } catch (_) {
        // Soft patch is best-effort — never block registration
      }
    }

    return { ok: true, fromCloud: true, id: savedId, error: null };
  } catch (error) {
    if (
      isHardHttp400Error(error) ||
      isInvalidUuidError(error) ||
      isSchemaCacheError(error)
    ) {
      return localProfileSuccess(id, 'catch-400');
    }
    logUpsertFailure('catch', error, v1);
    return localProfileSuccess(id, 'catch');
  }
}

function mapProfileRow(row) {
  if (!row) return null;
  const handleRaw = String(row.handle || row.username || row.display_name || 'athlete');
  const handle = handleRaw.startsWith('@') ? handleRaw : `@${handleRaw.replace(/^@/, '')}`;
  return {
    id: String(row.id),
    displayName: String(
      row.display_name || row.real_name || row.full_name || row.username || 'Athlete'
    ),
    username: handle.replace(/^@/, ''),
    handle,
    bio: row.bio || '',
    city: row.city || row.country || '',
    location: row.city_country || row.location || row.country || row.city || '',
    primarySport: row.category || row.primary_sport || row.sport || 'GYM',
    sport: row.category || row.primary_sport || row.sport || 'GYM',
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
  if (!isSupabaseConfigured() || isRemoteProfilesDisabled()) {
    return {
      me: CURRENT_USER,
      following: FOLLOWING,
      suggested: SUGGESTED,
      fromCloud: false,
      error: isRemoteProfilesDisabled()
        ? new Error('profiles circuit open')
        : new Error('Supabase not configured'),
    };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('followers', { ascending: false })
      .limit(80);
    if (error) {
      if (isHardHttp400Error(error) || isSchemaCacheError(error)) {
        openRemoteProfilesCircuit('passport-graph-400');
      }
      throw error;
    }

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
    return {
      me: CURRENT_USER,
      following: FOLLOWING,
      suggested: SUGGESTED,
      fromCloud: false,
      error,
    };
  }
}
