/**
 * FACEOFF open-callout kinds — OPEN CHALLENGES vs TIPS & BREAKDOWNS.
 */

export const CALLOUT_KIND_CHALLENGE = 'OPEN_CHALLENGE';
export const CALLOUT_KIND_TIP = 'TIP_BREAKDOWN';

const TIP_HINT =
  /\b(tip|how to|howto|form[\s-]?check|advice|breakdown|technique|coaching|explain|fix my)\b/i;

/**
 * Resolve callout bucket for FACEOFF lists + alert ticker.
 * Explicit `calloutKind` / `kind` wins; otherwise heuristic on target text.
 * @param {object|null|undefined} item
 * @returns {typeof CALLOUT_KIND_CHALLENGE | typeof CALLOUT_KIND_TIP}
 */
export function resolveCalloutKind(item) {
  if (!item) return CALLOUT_KIND_CHALLENGE;
  const raw = String(
    item.calloutKind || item.kind || item.challengeKind || ''
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (
    raw === CALLOUT_KIND_TIP ||
    raw === 'TIP' ||
    raw === 'TIPS' ||
    raw === 'BREAKDOWN' ||
    raw === 'TIPS_BREAKDOWNS' ||
    raw === 'FORM_CHECK' ||
    raw === 'ADVICE'
  ) {
    return CALLOUT_KIND_TIP;
  }
  if (
    raw === CALLOUT_KIND_CHALLENGE ||
    raw === 'CHALLENGE' ||
    raw === 'OPEN' ||
    raw === 'BATTLE' ||
    raw === 'BENCHMARK' ||
    raw === '1V1'
  ) {
    return CALLOUT_KIND_CHALLENGE;
  }
  if (item.isTipBreakdown === true || item.isTip === true) {
    return CALLOUT_KIND_TIP;
  }

  const text = `${item.target || ''} ${item.statSticker || ''} ${item.targetDetails || ''} ${item.title || ''}`;
  if (TIP_HINT.test(text)) return CALLOUT_KIND_TIP;
  return CALLOUT_KIND_CHALLENGE;
}

export function isTipCallout(item) {
  return resolveCalloutKind(item) === CALLOUT_KIND_TIP;
}

export function isChallengeCallout(item) {
  return resolveCalloutKind(item) === CALLOUT_KIND_CHALLENGE;
}
