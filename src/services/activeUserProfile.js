/**
 * Active logged-in BAWAAL participant profile (mock / session stand-in).
 * Swap this for real auth + profile store when available.
 */
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

/** Persist onboarding fields (incl. resolved location flag) into the live profile. */
export function applyRegisteredProfile(userData = {}) {
  const handleRaw = String(
    userData.handle || userData.displayName || ACTIVE_USER.handle || ''
  ).trim();
  const handle = handleRaw
    ? handleRaw.startsWith('@')
      ? handleRaw
      : `@${handleRaw.replace(/\s+/g, '_').toUpperCase()}`
    : ACTIVE_USER.handle;

  ACTIVE_USER.handle = handle;
  ACTIVE_USER.displayName =
    userData.displayName || userData.handle || userData.name || ACTIVE_USER.displayName;
  ACTIVE_USER.username = handle.replace(/^@/, '');
  ACTIVE_USER.name = userData.realName || userData.name || ACTIVE_USER.displayName;
  ACTIVE_USER.realName = userData.realName || userData.name || null;
  ACTIVE_USER.email = userData.email || ACTIVE_USER.email || null;
  ACTIVE_USER.phone = userData.phone || null;
  ACTIVE_USER.role = userData.role || ACTIVE_USER.role;
  ACTIVE_USER.sportInterest =
    userData.sportInterest || userData.sport || ACTIVE_USER.sportInterest;
  ACTIVE_USER.location = userData.location || ACTIVE_USER.location || '';
  ACTIVE_USER.flag = userData.flag || userData.countryFlag || ACTIVE_USER.flag;
  ACTIVE_USER.countryFlag =
    userData.countryFlag || userData.flag || ACTIVE_USER.flag;
  ACTIVE_USER.country = userData.country || ACTIVE_USER.country;
  ACTIVE_USER.label = userData.label || userData.country || ACTIVE_USER.label;
  ACTIVE_USER.region = userData.country || userData.location || ACTIVE_USER.region;

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
