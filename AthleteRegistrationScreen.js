/**
 * Athlete registration / Enter the Arena — canonical onboarding entry.
 * Implementation lives in RoleSelection (locked visual contract).
 * SUBMIT verifies OTP then upserts `public.profiles` via profilesService.
 */
export { default } from './RoleSelection';
