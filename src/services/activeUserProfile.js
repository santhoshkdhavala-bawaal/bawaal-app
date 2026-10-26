/**
 * Active logged-in BAWAAL participant profile (mock / session stand-in).
 * Swap this for real auth + profile store when available.
 */
export const ACTIVE_USER = Object.freeze({
  id: 'user-santhosh',
  userId: 'user-santhosh',
  handle: '@SANTHOSH',
  displayName: 'Santhosh',
  username: 'SANTHOSH',
  flag: '🇮🇳',
  label: 'INDIA',
  country: 'IND',
  region: 'India',
  rtcUid: 2101,
  streamId: 'rtc-local-santhosh',
  reps: 0,
  votes: 0,
  verified: true,
  role: 'athlete',
});

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
