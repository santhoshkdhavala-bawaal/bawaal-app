/**
 * Open-callout kinds for the BATTLES tab —
 * OPEN CHALLENGES vs TIPS & BREAKDOWNS.
 */

export const CALLOUT_KIND_CHALLENGE = 'OPEN_CHALLENGE';
export const CALLOUT_KIND_TIP = 'TIP_BREAKDOWN';

const TIP_HINT =
  /\b(tip|how to|howto|form[\s-]?check|advice|breakdown|technique|coaching|explain|fix my)\b/i;

/**
 * Resolve callout bucket for BATTLES Open Callouts lists.
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

  const text = `${item.target || ''} ${item.statSticker || ''} ${item.targetDetails || ''} ${item.description || ''} ${item.title || ''}`;
  if (TIP_HINT.test(text)) return CALLOUT_KIND_TIP;
  return CALLOUT_KIND_CHALLENGE;
}

export function isTipCallout(item) {
  return resolveCalloutKind(item) === CALLOUT_KIND_TIP;
}

export function isChallengeCallout(item) {
  return resolveCalloutKind(item) === CALLOUT_KIND_CHALLENGE;
}

/** Seed Open Callouts for the BATTLES tab (challenges + tips). */
export function seedBattlesOpenCallouts() {
  return [
    {
      id: 'callout-combat-jab',
      sport: 'COMBAT',
      host: '@Aman_Striker',
      target: '6 jabs 5 crosses in 30s',
      description: null,
      responses: 7,
      status: 'HOT',
      calloutKind: CALLOUT_KIND_CHALLENGE,
      isOpenChallenge: true,
    },
    {
      id: 'callout-gym-bench',
      sport: 'GYM',
      host: '@Yuki_Lift',
      target: '140 KG x 3 Reps',
      description: null,
      responses: 10,
      status: 'OPEN',
      calloutKind: CALLOUT_KIND_CHALLENGE,
      isOpenChallenge: true,
    },
    {
      id: 'callout-cricket-drive',
      sport: 'CRICKET',
      host: '@Rohit_VK7',
      target: 'Cover drive · 6 balls',
      description: null,
      responses: 4,
      status: 'OPEN',
      calloutKind: CALLOUT_KIND_CHALLENGE,
      isOpenChallenge: true,
    },
    {
      id: 'tip-combat-jab-cross',
      sport: 'COMBAT',
      host: '@Nova_Strike',
      target: 'How to land a clean jab-cross?',
      description: null,
      responses: 0,
      status: 'OPEN',
      calloutKind: CALLOUT_KIND_TIP,
      isTipBreakdown: true,
      isOpenChallenge: true,
    },
    {
      id: 'tip-cricket-form-check',
      sport: 'CRICKET',
      host: '@Dev_Drive',
      target: 'Form check: front-foot drive',
      description: null,
      responses: 0,
      status: 'OPEN',
      calloutKind: CALLOUT_KIND_TIP,
      isTipBreakdown: true,
      isOpenChallenge: true,
    },
  ];
}
