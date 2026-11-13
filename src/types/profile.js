/**
 * BAWAAL V1 `public.profiles` field contract.
 * Keep in sync with `supabase/ENSURE_PROFILES_SPORTS_HUBS.sql` and
 * `upsertRegisteredProfile` in `src/services/profilesService.js`.
 */

/** @typedef {'fan'|'athlete'|'scout'|string} BawaalRole */

/**
 * @typedef {Object} BawaalProfileRow
 * @property {string} id — uuid referencing auth.users(id)
 * @property {string|null} username — unique handle (no leading @)
 * @property {string|null} real_name
 * @property {number|null} [age] — soft-optional; omitted from upsert when null / missing in schema cache
 * @property {string|null} gender
 * @property {string|null} email — unique
 * @property {string|null} phone — unique E.164
 * @property {string|null} country
 * @property {string|null} category — BAWAAL sport taxonomy label
 * @property {BawaalRole|null} role
 * @property {string|null} [avatar_url]
 * @property {'White'|'Yellow'|'Blue'|'Purple'|'Gold'|null} [belt_tier]
 * @property {string} [created_at]
 */

/** Belt / ranking tiers shown on Arena + Passport. */
export const BAWAAL_BELT_TIERS = Object.freeze([
  'White',
  'Yellow',
  'Blue',
  'Purple',
  'Gold',
]);

/**
 * Canonical V1 column names written on registration upsert.
 * `age` is soft-optional — only sent when present; stripped on schema-cache miss.
 * Never upsert `list_bucket` from registration (Passport-only / may be absent).
 */
export const PROFILE_V1_COLUMNS = Object.freeze([
  'id',
  'username',
  'real_name',
  'age',
  'gender',
  'email',
  'phone',
  'country',
  'category',
  'role',
  'created_at',
]);

export default PROFILE_V1_COLUMNS;
