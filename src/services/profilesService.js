/**
 * Passport ↔ Supabase `profiles` (+ registration save).
 * Live writes use PROFILE_SAFE_WRITE_COLUMNS only (base schema cache).
 * See `src/types/profile.js` + `supabase_schema.sql`.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { CURRENT_USER, FOLLOWING, SUGGESTED } from '../data/athleteSocial';
import { normalizePhoneE164 } from './authOtp';
import { normalizeRemoteImageUri } from '../constants/mediaFallbacks';
import {
  PROFILE_PAYLOAD_DENYLIST,
  PROFILE_SAFE_WRITE_COLUMNS,
} from '../types/profile';

export const PROFILES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql (or supabase_schema.sql)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_DENYLIST_SET = new Set(PROFILE_PAYLOAD_DENYLIST);

/**
 * Session circuit-breaker: once local/dev mode or a remote 400 is seen,
 * skip further profiles queries for this JS session (stops retry / console spam).
 */
let remoteProfilesCircuitOpen = false;
let remoteProfilesCircuitReason = '';

function openRemoteProfilesCircuit(reason) {
  if (!remoteProfilesCircuitOpen) {
    remoteProfilesCircuitReason = String(reason || 'unknown');
    console.warn(
      '[profilesService] remote profiles short-circuited for this session',
      { reason: remoteProfilesCircuitReason }
    );
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

function isHttp400Error(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const msg = String(error.message || error.details || error.hint || error || '');
  return (
    status === 400 ||
    code === '400' ||
    code === '22P02' ||
    code === 'PGRST116' ||
    /bad request|PGRST204|invalid input syntax for type uuid|schema cache/i.test(msg)
  );
}

function isSchemaCacheError(error) {
  const msg = String(error?.message || error?.details || error?.hint || error || '');
  return /schema cache|PGRST204|Could not find .* column|column .* does not exist/i.test(
    msg
  );
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
 * Always strips PROFILE_PAYLOAD_DENYLIST keys (real_name, age, location, list_bucket, …).
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
 * Maps form aliases onto base schema columns, then allowlists + denylists.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function sanitizeProfileWritePayload(row = {}) {
  const src = row && typeof row === 'object' ? { ...row } : {};

  // Map extended / form keys → base schema columns (then drop the form keys)
  if (src.full_name == null || src.full_name === '') {
    const mappedName =
      src.real_name || src.realName || src.display_name || src.displayName || src.name;
    if (mappedName != null && String(mappedName).trim()) {
      src.full_name = String(mappedName).trim();
    }
  }
  if (src.primary_sport == null || src.primary_sport === '') {
    const mappedSport = src.category || src.sport || src.sportInterest || src.primarySport;
    if (mappedSport != null && String(mappedSport).trim()) {
      src.primary_sport = String(mappedSport).trim();
    }
  }
  if (src.avatar_url == null || src.avatar_url === '') {
    const mappedAvatar = src.avatarUri || src.avatar_uri || src.avatarUrl;
    if (mappedAvatar != null && String(mappedAvatar).trim()) {
      src.avatar_url = String(mappedAvatar).trim();
    }
  }

  return compactProfilePayload(src, PROFILE_SAFE_WRITE_COLUMNS);
}

function logUpsertFailure(stage, error, payload) {
  const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
  console.warn('[profilesService] upsertRegisteredProfile failed', {
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
 * Maps form fields onto base schema columns only (no real_name / age / location / …).
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
  const category =
    String(
      userData.category ||
        userData.sportInterest ||
        userData.sport ||
        userData.primarySport ||
        ''
    ).trim() || null;
  const sport = category || 'OTHERS';
  const avatarUrl =
    normalizeRemoteImageUri(userData.avatar_url) ||
    normalizeRemoteImageUri(userData.avatarUrl) ||
    normalizeRemoteImageUri(userData.avatarUri) ||
    null;

  /** Raw mapped row — sanitizer strips denylist + non-schema keys. */
  const mapped = {
    id,
    username,
    full_name: realName || null,
    email,
    avatar_url: avatarUrl,
    primary_sport: sport,
    // Kept for local lookup helpers only — stripped from wire payload by sanitizer
    phone,
  };

  const v1 = sanitizeProfileWritePayload(mapped);
  // Soft patch uses the same safe columns (no-op extras already stripped)
  const soft = sanitizeProfileWritePayload({
    full_name: realName || null,
    primary_sport: sport,
    avatar_url: avatarUrl,
    email,
  });

  return { id, v1, soft, lookup: { phone, username, email } };
}

/**
 * Lookup columns that exist on most deployments.
 * Prefer username / uuid id (base schema). phone/email are soft-tried and may 400.
 */
const PROFILE_LOOKUP_COLUMNS = Object.freeze(['username', 'id', 'email', 'phone']);

/**
 * Soft `.eq` lookup on a single V1 column. Never throws — logs and returns null on 400/miss.
 * @param {'phone'|'username'|'email'|'id'} column
 * @param {unknown} value
 */
async function safeLookupProfileByColumn(column, value) {
  if (isRemoteProfilesDisabled()) return null;

  if (!PROFILE_LOOKUP_COLUMNS.includes(column)) {
    return null;
  }

  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  // `id` is uuid in V1 schema — never filter with phone:/local: fallbacks
  if (column === 'id' && !isUuid(raw)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq(column, raw)
      .maybeSingle();

    if (error) {
      if (isHttp400Error(error)) {
        openRemoteProfilesCircuit(`lookup-400:${column}`);
      }
      return null;
    }

    return data?.id ? { id: String(data.id) } : null;
  } catch (err) {
    if (isHttp400Error(err)) {
      openRemoteProfilesCircuit(`lookup-throw:${column}`);
    }
    return null;
  }
}

/**
 * Find an existing profiles row using V1 schema columns only.
 * Order: phone → username → email → uuid id. Never `.eq('id', nonUuid)`.
 * @param {{ id?: string, phone?: string, username?: string, email?: string }} keys
 */
async function findExistingProfileRow(keys = {}) {
  if (isRemoteProfilesDisabled()) return null;

  try {
    const phone = typeof keys.phone === 'string' ? keys.phone.trim() : '';
    const username = typeof keys.username === 'string' ? keys.username.trim() : '';
    const email = typeof keys.email === 'string' ? keys.email.trim() : '';
    const id = typeof keys.id === 'string' ? keys.id.trim() : '';

    // Prefer base-schema columns first (username / uuid id), then optional email/phone
    const byUsername = username
      ? await safeLookupProfileByColumn('username', username)
      : null;
    if (byUsername || isRemoteProfilesDisabled()) return byUsername;

    if (id && isUuid(id)) {
      const byId = await safeLookupProfileByColumn('id', id);
      if (byId || isRemoteProfilesDisabled()) return byId;
    }

    const byEmail = email ? await safeLookupProfileByColumn('email', email) : null;
    if (byEmail || isRemoteProfilesDisabled()) return byEmail;

    const byPhone = phone ? await safeLookupProfileByColumn('phone', phone) : null;
    if (byPhone || isRemoteProfilesDisabled()) return byPhone;

    return null;
  } catch (err) {
    openRemoteProfilesCircuit('find-existing-throw');
    return null;
  }
}

/**
 * Persist a compact profiles row.
 * - Auth UUID → `.upsert(..., { onConflict: 'id' })`
 * - Legacy / local id → never use onConflict id; `.update` if found else `.insert`
 *
 * @param {Record<string, unknown>} row
 * @param {{ phone?: string|null, username?: string|null, email?: string|null }} [lookupHints]
 * @returns {Promise<{ data: { id?: string }|null, error: any, legacySkipped?: boolean }>}
 */
async function persistProfileRow(row, lookupHints = {}) {
  if (isRemoteProfilesDisabled()) {
    return { data: null, error: null, legacySkipped: true, localFallback: true };
  }

  try {
    // Always sanitize — only PROFILE_SAFE_WRITE_COLUMNS leave this function
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
        data: { id: id || lookupHints.username || 'local:offline' },
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
      if (result.error && isHttp400Error(result.error)) {
        openRemoteProfilesCircuit('upsert-400');
        return { data: null, error: result.error, legacySkipped: true, localFallback: true };
      }
      return result;
    } catch (err) {
      if (isHttp400Error(err)) openRemoteProfilesCircuit('upsert-throw');
      return { data: null, error: err, legacySkipped: true, localFallback: true };
    }
  } catch (err) {
    if (isHttp400Error(err)) openRemoteProfilesCircuit('persist-throw');
    return { data: null, error: err, legacySkipped: true, localFallback: true };
  }
}

/**
 * OTP SUBMIT / registration → `public.profiles` save (V1 allowlist + soft strip).
 *
 * @param {object} userData — registration payload from RoleSelection
 * @param {{ id?: string } | null} [authUser] — supabase.auth user after verifyOtp
 */
export async function upsertRegisteredProfile(userData = {}, authUser = null) {
  const { id, v1, soft, lookup } = buildRegistrationProfilePayload(userData, authUser);

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
    // Single sanitized upsert for auth UUID only (max 2 schema-strip retries)
    let payload = sanitizeProfileWritePayload({ ...v1, id });
    let { data, error, legacySkipped, localFallback } = await persistProfileRow(
      payload,
      lookup
    );

    if (localFallback || legacySkipped || isRemoteProfilesDisabled()) {
      return localProfileSuccess(id, 'persist-local-fallback');
    }

    let guard = 0;
    while (
      error &&
      isSchemaCacheError(error) &&
      !isHttp400Error(error) &&
      guard < 2
    ) {
      guard += 1;
      const missing = extractMissingColumn(error);
      if (!missing || !(missing in payload) || missing === 'id') break;
      payload = sanitizeProfileWritePayload(omitKeys(payload, [missing]));
      ({ data, error, legacySkipped, localFallback } = await persistProfileRow(
        payload,
        lookup
      ));
      if (localFallback || legacySkipped || isRemoteProfilesDisabled()) {
        return localProfileSuccess(id, 'persist-local-fallback-retry');
      }
    }

    if (error) {
      if (isHttp400Error(error) || isInvalidUuidError(error)) {
        return localProfileSuccess(id, 'upsert-400');
      }
      // One warn, then local success so registration never loops
      logUpsertFailure('v1-persist', error, payload);
      return localProfileSuccess(id, 'upsert-error');
    }

    const savedId = data?.id || id;

    // Soft patch once — never on failure cascades
    const softPatch = omitKeys(sanitizeProfileWritePayload(soft), ['id']);
    if (
      Object.keys(softPatch).length > 0 &&
      isUuid(savedId) &&
      !isRemoteProfilesDisabled()
    ) {
      try {
        const softResult = await supabase
          .from('profiles')
          .update(softPatch)
          .eq('id', savedId)
          .select('id')
          .maybeSingle();
        if (softResult.error && isHttp400Error(softResult.error)) {
          openRemoteProfilesCircuit('soft-patch-400');
        }
      } catch (_) {
        openRemoteProfilesCircuit('soft-patch-throw');
      }
    }

    return { ok: true, fromCloud: true, id: savedId, error: null };
  } catch (error) {
    if (isHttp400Error(error)) {
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
