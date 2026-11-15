/**
 * War Cry scheduling — UTC start + 5-hour registration cutoff.
 *
 * Rule: if current_time >= (event_start_time - 5 hours),
 * registration closes and the war room roster locks.
 */

export const WAR_CRY_REGISTRATION_CUTOFF_MS = 5 * 60 * 60 * 1000;

/** Primary tactical badge when registration is locked. */
export const WAR_CRY_REGISTRATIONS_CLOSED_BADGE = 'REGISTRATIONS CLOSED';

/** Secondary lock line for war-room surfaces. */
export const WAR_CRY_WAR_ROOM_LOCKED_SUB = 'WAR ROOM LOCKED';

/**
 * @param {string|number|Date|null|undefined} start
 * @returns {number|null} epoch ms
 */
export function parseWarCryStartMs(start) {
  if (start == null || start === '') return null;
  if (typeof start === 'number' && Number.isFinite(start)) return start;
  const ms = new Date(start).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Registration still open when now is earlier than (start - 5h).
 * Live-now battles (start <= now) are always closed for new registration.
 *
 * @param {string|number|Date|null|undefined} startUtc
 * @param {number} [nowMs]
 */
export function isWarCryRegistrationOpen(startUtc, nowMs = Date.now()) {
  const startMs = parseWarCryStartMs(startUtc);
  if (startMs == null) return true;
  return nowMs < startMs - WAR_CRY_REGISTRATION_CUTOFF_MS;
}

/**
 * @param {string|number|Date|null|undefined} startUtc
 * @param {number} [nowMs]
 */
export function isWarCryRegistrationClosed(startUtc, nowMs = Date.now()) {
  return !isWarCryRegistrationOpen(startUtc, nowMs);
}

/**
 * Scheduled start has been reached (join war room allowed).
 */
export function isWarCryStartReached(startUtc, nowMs = Date.now()) {
  const startMs = parseWarCryStartMs(startUtc);
  if (startMs == null) return true;
  return nowMs >= startMs;
}

/**
 * Derive registration_open for persist / UI.
 */
export function resolveWarCryRegistrationOpen(startUtc, nowMs = Date.now()) {
  return isWarCryRegistrationOpen(startUtc, nowMs);
}

/**
 * Single registration-state snapshot for all War Cry callers.
 * @returns {{
 *   startMs: number|null,
 *   registrationOpen: boolean,
 *   registrationClosed: boolean,
 *   startReached: boolean,
 *   badge: string|null,
 *   badgeSub: string|null,
 *   joinLabel: string,
 * }}
 */
export function getWarCryRegistrationState(startUtc, nowMs = Date.now()) {
  const startMs = parseWarCryStartMs(startUtc);
  const registrationOpen = isWarCryRegistrationOpen(startUtc, nowMs);
  const registrationClosed = !registrationOpen;
  const startReached = isWarCryStartReached(startUtc, nowMs);
  return {
    startMs,
    registrationOpen,
    registrationClosed,
    startReached,
    badge: registrationClosed ? WAR_CRY_REGISTRATIONS_CLOSED_BADGE : null,
    badgeSub: registrationClosed ? WAR_CRY_WAR_ROOM_LOCKED_SUB : null,
    joinLabel: startReached ? 'JOIN WAR ROOM' : 'WAR ROOM OPENS SOON',
  };
}

export function warCryRegistrationBadge(startUtc, nowMs = Date.now()) {
  const state = getWarCryRegistrationState(startUtc, nowMs);
  if (!state.registrationClosed) return null;
  return `${state.badge} – ${state.badgeSub}`;
}

export function warCryJoinLabel(startUtc, nowMs = Date.now()) {
  return getWarCryRegistrationState(startUtc, nowMs).joinLabel;
}
