/**
 * Athlete registration / Enter the Arena — canonical onboarding entry.
 * Implementation lives in RoleSelection (locked visual contract).
 * Create Account → signUp(email, password, phone meta); Sign In → signInWithPassword;
 * then upserts V1 `public.profiles`.
 */
export { default } from './RoleSelection';
