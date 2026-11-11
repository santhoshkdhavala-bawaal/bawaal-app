/**
 * Athlete registration / Enter the Arena — canonical onboarding entry.
 * Implementation lives in RoleSelection (locked visual contract).
 * Continue → signInWithOtp; SUBMIT → verifyOtp then upserts V1 `public.profiles`.
 */
export { default } from './RoleSelection';
