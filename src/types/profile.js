/**
 * BAWAAL `public.profiles` field contract.
 * Keep in sync with `supabase_schema.sql`, ENSURE SQL, and `upsertRegisteredProfile`.
 *
 * Registration writes use PROFILE_SAFE_WRITE_COLUMNS. Missing-column (PGRST204)
 * responses are soft-stripped client-side so older schema caches never loop.
 */

/** @typedef {'fan'|'athlete'|'scout'|string} BawaalRole */

/**
 * @typedef {Object} BawaalProfileRow
 * @property {string} id — uuid referencing auth.users(id)
 * @property {string|null} username — unique handle (no leading @)
 * @property {string|null} [full_name]
 * @property {string|null} [real_name]
 * @property {number|null} [age]
 * @property {string|null} [gender]
 * @property {string|null} [email]
 * @property {string|null} [phone]
 * @property {string|null} [country]
 * @property {string|null} [location]
 * @property {string|null} [city_country]
 * @property {string|null} [category]
 * @property {BawaalRole|null} [role]
 * @property {string|null} [avatar_url]
 * @property {string|null} [avatar_uri]
 * @property {string|null} [primary_sport]
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
 * Minimal columns always present on the base CREATE TABLE in supabase_schema.sql.
 * Used as the last-resort strip target when the live schema cache is stale.
 */
export const PROFILE_BASE_WRITE_COLUMNS = Object.freeze([
  'id',
  'username',
  'full_name',
  'avatar_url',
  'primary_sport',
  'email',
]);

/**
 * Columns safe to WRITE on registration insert/update/upsert.
 * Matches ENSURE_PROFILES + migration 008 (registration / Passport fields).
 * Never client-write `created_at` / `list_bucket` (DB default / Passport-only).
 */
export const PROFILE_SAFE_WRITE_COLUMNS = Object.freeze([
  'id',
  'username',
  'full_name',
  'real_name',
  'age',
  'gender',
  'email',
  'phone',
  'country',
  'location',
  'city_country',
  'category',
  'role',
  'avatar_url',
  'avatar_uri',
  'primary_sport',
]);

/**
 * Form / Passport / client-only keys that must NEVER be sent to PostgREST writes
 * (prevents PGRST204 400s from junk like list_bucket).
 */
export const PROFILE_PAYLOAD_DENYLIST = Object.freeze([
  'list_bucket',
  'listBucket',
  'mobile',
  'sport_interests',
  'sportInterests',
  'handle',
  'display_name',
  'displayName',
  'sport',
  'city',
  'updated_at',
  'bio',
  'avatarUri',
  'belt_tier',
  'created_at',
  'status_badge',
  'verified',
  'online',
  'followers',
  'following_count',
  'win_rate',
  'battles_won',
  'bawaal_pts',
  'rank',
  'tags',
  'authMode',
  'authPhone',
  'profileId',
  'profileSynced',
  'flag',
  'countryFlag',
  'label',
  'realName',
  'name',
  'sportInterest',
  'primarySport',
]);

/**
 * Legacy V1 extended column names (documentation / ENSURE SQL).
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

export default PROFILE_SAFE_WRITE_COLUMNS;
