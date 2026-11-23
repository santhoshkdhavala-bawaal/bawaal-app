/**
 * Legacy phone helpers — SMS OTP auth has been replaced by email + password
 * (`authPassword.js`). Kept so existing imports of `normalizePhoneE164` continue
 * to resolve (e.g. profilesService).
 */
export {
  normalizePhoneE164,
  normalizeEmail,
  isValidEmail,
} from './authPassword';
