/**
 * Passport ↔ Supabase `profiles` (+ V1 registration upsert).
 * V1 columns: id, username, real_name, age, gender, email, phone, country,
 * category, role, created_at — see `src/types/profile.js`.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import { CURRENT_USER, FOLLOWING, SUGGESTED } from '../data/athleteSocial';
import { normalizePhoneE164 } from './authOtp';
import { normalizeRemoteImageUri } from '../constants/mediaFallbacks';
import { PROFILE_V1_COLUMNS } from '../types/profile';

export const PROFILES_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_PROFILES_SPORTS_HUBS.sql (or supabase_schema.sql)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Only these keys may be sent on registration upsert.
 * Explicitly excludes `list_bucket` and other Passport-only / missing-cache fields.
 * `created_at` is DB-defaulted — never client-written on upsert.
 */
const PROFILE_UPSERT_ALLOWLIST = Object.freeze(
  PROFILE_V1_COLUMNS.filter((key) => key !== 'created_at')
);

/** Soft-compat extras — tried only after a successful V1 upsert is not required; stripped on miss. */
const PROFILE_SOFT_COMPAT_KEYS = Object.freeze([
  'display_name',
  'full_name',
  'primary_sport',
  'updated_at',
]);

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
 * Drop undefined / null / empty-string values so PostgREST never sees junk keys.
 * `id` is always retained when present.
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
    // Never allow known non-schema / Passport-only keys through
    if (key === 'list_bucket' || key === 'listBucket') continue;
    const value = src[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
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
 * Build a compact, allowlisted profiles upsert row from registration form data.
 * Omits null / undefined / empty strings and never includes `list_bucket`.
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
  const country =
    String(userData.country || userData.location || userData.city || '').trim() || null;
  const role = String(userData.role || 'fan').toLowerCase() || null;
  const category =
    String(
      userData.category ||
        userData.sportInterest ||
        userData.sport ||
        userData.primarySport ||
        ''
    ).trim() || null;
  const sport = category || 'OTHERS';
  const ageRaw = userData.age;
  const ageNum = Number(ageRaw);
  const age = Number.isFinite(ageNum) && ageNum > 0 ? Math.round(ageNum) : null;
  const gender = userData.gender ? String(userData.gender).trim() : null;
  const displayName = String(
    userData.displayName || userData.handle || username || realName || 'Athlete'
  ).trim();

  /** Canonical V1 fields only — primary upsert path. */
  const v1Raw = {
    id,
    username,
    real_name: realName || null,
    age,
    gender,
    email,
    phone,
    country,
    category: sport,
    role,
  };

  const v1 = compactProfilePayload(v1Raw, PROFILE_UPSERT_ALLOWLIST);

  /** Optional soft-compat — never includes list_bucket / mobile / handle arrays. */
  const softRaw = {
    display_name: displayName || null,
    full_name: realName || null,
    primary_sport: sport || null,
    updated_at: new Date().toISOString(),
  };
  const soft = compactProfilePayload(softRaw, PROFILE_SOFT_COMPAT_KEYS);

  return { id, v1, soft };
}

/** V1 `public.profiles` identity columns safe for `.eq` lookups (see ENSURE_PROFILES). */
const PROFILE_LOOKUP_COLUMNS = Object.freeze(['phone', 'username', 'email', 'id']);

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

    const byPhone = phone ? await safeLookupProfileByColumn('phone', phone) : null;
    if (byPhone) return byPhone;

    const byUsername = username
      ? await safeLookupProfileByColumn('username', username)
      : null;
    if (byUsername) return byUsername;

    const byEmail = email ? await safeLookupProfileByColumn('email', email) : null;
    if (byEmail) return byEmail;

    if (id && isUuid(id)) {
      return safeLookupProfileByColumn('id', id);
    }

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
 * @returns {Promise<{ data: { id?: string }|null, error: any, legacySkipped?: boolean }>}
 */
async function persistProfileRow(row) {
  try {
    const payload = compactProfilePayload(row);
    if (!payload || typeof payload !== 'object') {
      return { data: null, error: new Error('empty profiles payload') };
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
      // Never pass non-UUID id into lookup — findExistingProfileRow guards anyway
      id: authUuid ? id : null,
      phone: typeof payload.phone === 'string' ? payload.phone : null,
      username: typeof payload.username === 'string' ? payload.username : null,
      email: typeof payload.email === 'string' ? payload.email : null,
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

  const { id, v1, soft } = buildRegistrationProfilePayload(userData, authUser);

  if (!v1.id) {
    const error = new Error('profiles upsert requires a stable id');
    logUpsertFailure('missing-id', error, v1);
    return { ok: false, fromCloud: false, id: null, error };
  }

  try {
    // 1) Lean V1 allowlist only (no list_bucket / null junk)
    let payload = { ...v1 };
    let { data, error, legacySkipped } = await persistProfileRow(payload);

    // 2) Schema-cache soft strip (e.g. missing `age`)
    let guard = 0;
    while (error && isSchemaCacheError(error) && !legacySkipped && guard < 6) {
      guard += 1;
      const missing = extractMissingColumn(error);
      logUpsertFailure(`schema-strip-${guard}${missing ? `:${missing}` : ''}`, error, payload);
      if (missing && missing in payload && missing !== 'id') {
        payload = omitKeys(payload, [missing]);
      } else if ('age' in payload) {
        payload = omitKeys(payload, ['age']);
      } else {
        break;
      }
      if (!payload.id && isUuid(id)) break;
      ({ data, error, legacySkipped } = await persistProfileRow(payload));
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

    const savedId = data?.id || (isUuid(id) ? id : null) || id;

    // 3) Best-effort soft-compat UPDATE only (never insert / never onConflict)
    const softPatch = compactProfilePayload(soft, PROFILE_SOFT_COMPAT_KEYS);
    if (Object.keys(softPatch).length > 0) {
      let targetId = isUuid(savedId) ? savedId : null;
      if (!targetId) {
        const found = await findExistingProfileRow({
          phone: v1.phone,
          username: v1.username,
          email: v1.email,
        });
        targetId = found?.id || null;
      }
      if (targetId) {
        let softRow = softPatch;
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

    return { ok: true, fromCloud: true, id: savedId, error: null };
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
