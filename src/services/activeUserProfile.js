/**
 * Active logged-in BAWAAL participant profile (session stand-in).
 * Synced from AsyncStorage session on boot / registration.
 */
import { CURRENT_USER } from '../data/athleteSocial';

export const ACTIVE_USER = {
  id: 'user-santhosh',
  userId: 'user-santhosh',
  handle: '@SANTHOSH',
  displayName: 'Santhosh',
  username: 'SANTHOSH',
  flag: '🇮🇳',
  label: 'INDIA',
  country: 'IND',
  region: 'India',
  location: '',
  sportInterest: null,
  rtcUid: 2101,
  streamId: 'rtc-local-santhosh',
  reps: 0,
  votes: 0,
  verified: true,
  role: 'athlete',
};

export function getActiveUser() {
  return ACTIVE_USER;
}

/** Persist onboarding fields (incl. resolved location flag) into the live profile + Passport CURRENT_USER. */
export function applyRegisteredProfile(userData = {}) {
  const handleRaw = String(
    userData.handle || userData.displayName || ACTIVE_USER.handle || ''
  ).trim();
  const handle = handleRaw
    ? handleRaw.startsWith('@')
      ? handleRaw
      : `@${handleRaw.replace(/\s+/g, '_').toUpperCase()}`
    : ACTIVE_USER.handle;

  const displayName =
    userData.displayName ||
    userData.realName ||
    userData.name ||
    userData.handle ||
    ACTIVE_USER.displayName;
  const sportInterest =
    userData.sportInterest || userData.sport || ACTIVE_USER.sportInterest;
  const location = userData.location || ACTIVE_USER.location || '';
  const role = userData.role || ACTIVE_USER.role;

  ACTIVE_USER.handle = handle;
  ACTIVE_USER.displayName = displayName;
  ACTIVE_USER.username = handle.replace(/^@/, '');
  ACTIVE_USER.name = userData.realName || userData.name || displayName;
  ACTIVE_USER.realName = userData.realName || userData.name || null;
  ACTIVE_USER.email = userData.email || ACTIVE_USER.email || null;
  ACTIVE_USER.phone = userData.phone || null;
  ACTIVE_USER.role = role;
  ACTIVE_USER.gender = userData.gender || ACTIVE_USER.gender || null;
  ACTIVE_USER.age =
    userData.age != null && Number.isFinite(Number(userData.age))
      ? Number(userData.age)
      : ACTIVE_USER.age || null;
  ACTIVE_USER.sportInterest = sportInterest;
  ACTIVE_USER.sport = sportInterest;
  ACTIVE_USER.location = location;
  ACTIVE_USER.flag = userData.flag || userData.countryFlag || ACTIVE_USER.flag;
  ACTIVE_USER.countryFlag =
    userData.countryFlag || userData.flag || ACTIVE_USER.flag;
  ACTIVE_USER.country = userData.country || ACTIVE_USER.country;
  ACTIVE_USER.label = userData.label || userData.country || ACTIVE_USER.label;
  ACTIVE_USER.region = userData.country || userData.location || ACTIVE_USER.region;

  // Keep Passport hub card in sync (same object ProfileScreen seeds from)
  CURRENT_USER.handle = handle;
  CURRENT_USER.username = handle.replace(/^@/, '');
  CURRENT_USER.displayName = displayName;
  CURRENT_USER.role = role || CURRENT_USER.role;
  CURRENT_USER.gender = ACTIVE_USER.gender || CURRENT_USER.gender || null;
  CURRENT_USER.age = ACTIVE_USER.age ?? CURRENT_USER.age ?? null;
  CURRENT_USER.location = location || CURRENT_USER.location;
  CURRENT_USER.city = location || CURRENT_USER.city;
  if (sportInterest) {
    CURRENT_USER.primarySport = String(sportInterest).toUpperCase();
    const tags = Array.isArray(CURRENT_USER.tags) ? [...CURRENT_USER.tags] : [];
    const sportKey = CURRENT_USER.primarySport;
    if (!tags.map((t) => String(t).toUpperCase()).includes(sportKey)) {
      CURRENT_USER.tags = [sportKey, ...tags.filter((t) => String(t).toUpperCase() !== sportKey)];
    }
  }

  return ACTIVE_USER;
}

export function toChallengerAthlete(overrides = {}) {
  return {
    id: ACTIVE_USER.id,
    userId: ACTIVE_USER.userId,
    handle: ACTIVE_USER.handle,
    flag: ACTIVE_USER.flag,
    label: ACTIVE_USER.label,
    country: ACTIVE_USER.country,
    reps: ACTIVE_USER.reps,
    votes: ACTIVE_USER.votes,
    streamId: ACTIVE_USER.streamId,
    rtcUid: ACTIVE_USER.rtcUid,
    isSelf: true,
    ...overrides,
  };
}

export default ACTIVE_USER;
