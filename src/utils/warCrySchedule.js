/**
 * War Cry scheduling — UTC start + 5-hour registration cutoff.
 *
 * Rule: if current_time >= (event_start_time - 5 hours),
 * registration closes and the war room roster locks.
 */

export const WAR_CRY_REGISTRATION_CUTOFF_MS = 5 * 60 * 60 * 1000;

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

export function warCryRegistrationBadge(startUtc, nowMs = Date.now()) {
  if (isWarCryRegistrationClosed(startUtc, nowMs)) {
    return 'REGISTRATION CLOSED – WAR ROOM LOCKED';
  }
  return null;
}

export function warCryJoinLabel(startUtc, nowMs = Date.now()) {
  if (!isWarCryStartReached(startUtc, nowMs)) {
    return 'WAR ROOM OPENS SOON';
  }
  return 'JOIN WAR ROOM';
}
