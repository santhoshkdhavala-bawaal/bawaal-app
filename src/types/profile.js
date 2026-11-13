/**
 * BAWAAL `public.profiles` field contract.
 * Keep in sync with `supabase_schema.sql` + `upsertRegisteredProfile`.
 *
 * Live writes must only use PROFILE_SAFE_WRITE_COLUMNS — the base CREATE TABLE
 * shape in schema cache. Extended V1 columns (real_name, age, …) are form-only
 * until ENSURE SQL is applied and the API schema cache is refreshed.
 */

/** @typedef {'fan'|'athlete'|'scout'|string} BawaalRole */

/**
 * @typedef {Object} BawaalProfileRow
 * @property {string} id — uuid referencing auth.users(id)
 * @property {string|null} username — unique handle (no leading @)
 * @property {string|null} [full_name]
 * @property {string|null} [avatar_url]
 * @property {string|null} [primary_sport]
 * @property {string|null} [email]
 * @property {string|null} [real_name] — extended / form-only until ENSURE applied
 * @property {number|null} [age]
 * @property {string|null} [gender]
 * @property {string|null} [phone]
 * @property {string|null} [country]
 * @property {string|null} [category]
 * @property {BawaalRole|null} [role]
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
 * Columns safe to WRITE on registration insert/update/upsert.
 * Matches `supabase_schema.sql` CREATE TABLE public.profiles (+ optional email).
 * Never client-write `created_at` (DB default).
 */
export const PROFILE_SAFE_WRITE_COLUMNS = Object.freeze([
  'id',
  'username',
  'full_name',
  'avatar_url',
  'primary_sport',
  'email',
]);

/**
 * Form / Passport / extended keys that must NEVER be sent to PostgREST writes
 * until the live schema cache exposes them (prevents PGRST204 400s).
 */
export const PROFILE_PAYLOAD_DENYLIST = Object.freeze([
  'real_name',
  'age',
  'gender',
  'phone',
  'country',
  'category',
  'role',
  'location',
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
  'avatar_uri',
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
]);

/**
 * Legacy V1 extended column names (documentation / ENSURE SQL).
 * Not used for live writes — see PROFILE_SAFE_WRITE_COLUMNS.
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
