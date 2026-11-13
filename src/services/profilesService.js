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
  if (!PROFILE_LOOKUP_COLUMNS.includes(column)) {
    console.warn('[profilesService] profiles lookup skipped — unknown column', { column });
    return null;
  }

  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  // `id` is uuid in V1 schema — never filter with phone:/local: fallbacks
  if (column === 'id' && !isUuid(raw)) {
    console.warn(
      '[profilesService] profiles lookup skipped — id filter requires auth UUID',
      { value: raw }
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq(column, raw)
      .maybeSingle();

    if (error) {
      console.warn('[profilesService] profiles lookup query failed', {
        column,
        message: error.message || String(error),
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
      });
      return null;
    }

    return data?.id ? { id: String(data.id) } : null;
  } catch (err) {
    console.warn('[profilesService] profiles lookup threw', {
      column,
      message: err?.message || String(err),
    });
    return null;
  }
}

/**
 * Find an existing profiles row using V1 schema columns only.
 * Order: phone → username → email → uuid id. Never `.eq('id', nonUuid)`.
 * @param {{ id?: string, phone?: string, username?: string, email?: string }} keys
 */
async function findExistingProfileRow(keys = {}) {
  try {
    const phone = typeof keys.phone === 'string' ? keys.phone.trim() : '';
    const username = typeof keys.username === 'string' ? keys.username.trim() : '';
    const email = typeof keys.email === 'string' ? keys.email.trim() : '';
    const id = typeof keys.id === 'string' ? keys.id.trim() : '';

    // Prefer base-schema columns first (username / uuid id), then optional email/phone
    const byUsername = username
      ? await safeLookupProfileByColumn('username', username)
      : null;
    if (byUsername) return byUsername;

    if (id && isUuid(id)) {
      const byId = await safeLookupProfileByColumn('id', id);
      if (byId) return byId;
    }

    const byEmail = email ? await safeLookupProfileByColumn('email', email) : null;
    if (byEmail) return byEmail;

    const byPhone = phone ? await safeLookupProfileByColumn('phone', phone) : null;
    if (byPhone) return byPhone;

    return null;
  } catch (err) {
    console.warn('[profilesService] findExistingProfileRow failed', {
      message: err?.message || String(err),
    });
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
  try {
    // Always sanitize — only PROFILE_SAFE_WRITE_COLUMNS leave this function
    const payload = sanitizeProfileWritePayload(row);
    if (!payload || typeof payload !== 'object' || !Object.keys(payload).length) {
      return { data: null, error: new Error('empty profiles payload after sanitize') };
    }

    const id = payload.id != null ? String(payload.id) : null;
    const authUuid = id && isUuid(id);

    if (authUuid) {
      try {
        return await supabase
          .from('profiles')
          .upsert(payload, { onConflict: 'id' })
          .select('id')
          .maybeSingle();
      } catch (err) {
        console.warn('[profilesService] uuid upsert threw', {
          message: err?.message || String(err),
        });
        return { data: null, error: err };
      }
    }

    // Legacy / local fallback — do NOT call upsert onConflict id (400 on uuid PKs)
    console.warn(
      '[profilesService] non-UUID profiles.id — using insert/update branch (no onConflict).',
      { id }
    );

    const existing = await findExistingProfileRow({
      id: null,
      phone: lookupHints.phone || null,
      username:
        (typeof payload.username === 'string' && payload.username) ||
        lookupHints.username ||
        null,
      email:
        (typeof payload.email === 'string' && payload.email) ||
        lookupHints.email ||
        null,
    });

    if (existing?.id) {
      const patch = omitKeys(payload, ['id']);
      if (!Object.keys(patch).length) {
        return { data: { id: existing.id }, error: null };
      }
      try {
        // Update target id is always a real DB id from select — safe for uuid PK
        const result = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', existing.id)
          .select('id')
          .maybeSingle();
        if (result.error) {
          console.warn('[profilesService] legacy update failed', {
            message: result.error.message || String(result.error),
            code: result.error.code || null,
            targetId: existing.id,
          });
        }
        return result;
      } catch (err) {
        console.warn('[profilesService] legacy update threw', {
          message: err?.message || String(err),
          targetId: existing.id,
        });
        return { data: null, error: err };
      }
    }

    // Insert: keep legacy text id only for text-PK tables; soft-skip uuid syntax errors
    try {
      let insertPayload = { ...payload };
      // Prefer omitting non-UUID id on V1 uuid PK to avoid immediate 400
      if (insertPayload.id && !isUuid(String(insertPayload.id))) {
        insertPayload = omitKeys(insertPayload, ['id']);
      }

      if (!Object.keys(insertPayload).length) {
        return {
          data: null,
          error: new Error('legacy insert skipped — empty payload after id strip'),
          legacySkipped: true,
        };
      }

      const result = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select('id')
        .maybeSingle();

      if (result.error && isInvalidUuidError(result.error)) {
        logUpsertFailure('legacy-insert-uuid-pk', result.error, insertPayload);
        return {
          data: null,
          error: result.error,
          legacySkipped: true,
        };
      }

      if (result.error) {
        console.warn('[profilesService] legacy insert failed', {
          message: result.error.message || String(result.error),
          code: result.error.code || null,
          details: result.error.details || null,
        });
      }

      return result;
    } catch (err) {
      console.warn('[profilesService] legacy insert threw', {
        message: err?.message || String(err),
      });
      return { data: null, error: err, legacySkipped: true };
    }
  } catch (err) {
    console.warn('[profilesService] persistProfileRow failed', {
      message: err?.message || String(err),
    });
    return { data: null, error: err };
  }
}

/**
 * OTP SUBMIT / registration → `public.profiles` save (V1 allowlist + soft strip).
 *
 * @param {object} userData — registration payload from RoleSelection
 * @param {{ id?: string } | null} [authUser] — supabase.auth user after verifyOtp
 */
export async function upsertRegisteredProfile(userData = {}, authUser = null) {
  if (!isSupabaseConfigured()) {
    return { ok: false, fromCloud: false, error: new Error('Supabase not configured') };
  }

  const { id, v1, soft, lookup } = buildRegistrationProfilePayload(userData, authUser);

  if (!v1.id && !isUuid(id)) {
    // Legacy ids are stripped by sanitizer — still OK to attempt lookup/update path
  }
  if (!v1.id && isUuid(id)) {
    v1.id = id;
  }
  if (!v1.id && !lookup?.username && !lookup?.email && !lookup?.phone) {
    const error = new Error('profiles upsert requires id or username/email/phone');
    logUpsertFailure('missing-id', error, v1);
    return { ok: false, fromCloud: false, id: null, error };
  }

  try {
    // 1) Sanitized base-schema payload only
    let payload = sanitizeProfileWritePayload({ ...v1, id: isUuid(id) ? id : v1.id });
    let { data, error, legacySkipped } = await persistProfileRow(payload, lookup);

    // 2) Schema-cache soft strip if a safe column is still missing from API cache
    let guard = 0;
    while (error && isSchemaCacheError(error) && !legacySkipped && guard < 6) {
      guard += 1;
      const missing = extractMissingColumn(error);
      logUpsertFailure(`schema-strip-${guard}${missing ? `:${missing}` : ''}`, error, payload);
      if (missing && missing in payload && missing !== 'id') {
        payload = omitKeys(payload, [missing]);
      } else {
        break;
      }
      if (!payload.id && isUuid(id)) break;
      payload = sanitizeProfileWritePayload(payload);
      ({ data, error, legacySkipped } = await persistProfileRow(payload, lookup));
    }

    if (legacySkipped) {
      // Local/legacy id on uuid PK — registration continues offline without 400 spam
      logUpsertFailure('legacy-skip', error, payload);
      return {
        ok: false,
        fromCloud: false,
        id,
        error,
        legacySkipped: true,
      };
    }

    if (error) {
      logUpsertFailure('v1-persist', error, payload);
      throw error;
    }

    const savedId = data?.id || (isUuid(id) ? id : null) || data?.id;

    // 3) Best-effort soft UPDATE with the same sanitized columns only
    const softPatch = sanitizeProfileWritePayload(soft);
    if (Object.keys(softPatch).length > 0) {
      let targetId = savedId && isUuid(String(savedId)) ? String(savedId) : null;
      if (!targetId) {
        const found = await findExistingProfileRow({
          phone: lookup?.phone,
          username: lookup?.username || v1.username,
          email: lookup?.email || v1.email,
        });
        targetId = found?.id || null;
      }
      if (targetId) {
        let softRow = omitKeys(softPatch, ['id']);
        let softResult = await supabase
          .from('profiles')
          .update(softRow)
          .eq('id', targetId)
          .select('id')
          .maybeSingle();
        if (softResult.error && isSchemaCacheError(softResult.error)) {
          const miss = extractMissingColumn(softResult.error);
          if (miss && miss in softRow) {
            softRow = omitKeys(softRow, [miss]);
            softResult = await supabase
              .from('profiles')
              .update(softRow)
              .eq('id', targetId)
              .select('id')
              .maybeSingle();
          }
        }
        if (softResult.error) {
          logUpsertFailure('soft-compat', softResult.error, softPatch);
        }
      }
    }

    return { ok: true, fromCloud: true, id: savedId || id, error: null };
  } catch (error) {
    logUpsertFailure('catch', error, v1);
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
