/**
 * BAWAAL Battles feed store — Battle Rewind challenges + HOT FEATURE live cards.
 * Consumed by BattlesScreen (BAWAAL_BATTLES_PAGE).
 */

/** @typedef {'OPEN' | 'HOT' | 'LIVE' | 'SCHEDULED'} BattleStatus */

/**
 * @typedef {Object} BattleChallengeCard
 * @property {string} id
 * @property {string} sport
 * @property {string|null} target
 * @property {string|null} description
 * @property {string} host
 * @property {number} responses
 * @property {BattleStatus} status
 * @property {string} [videoUri]
 * @property {number} [targetReps]
 * @property {number} [timeLimitSec]
 * @property {string} [source] 'BATTLE_REWIND' | 'BATTLE_BAWAAL'
 * @property {boolean} [isHotFeature]
 * @property {object} [liveMatch]
 */

/** @type {BattleChallengeCard[]} */
let pendingBattles = [];
/** @type {BattleChallengeCard | null} */
let hotFeature = null;
const battleListeners = new Set();
const hotFeatureListeners = new Set();

function emitBattles(battle) {
  battleListeners.forEach((fn) => {
    try {
      fn(battle);
    } catch (_) {
      /* ignore */
    }
  });
}

function emitHotFeature(card) {
  hotFeatureListeners.forEach((fn) => {
    try {
      fn(card);
    } catch (_) {
      /* ignore */
    }
  });
}

/** Push an async Battle Rewind challenge into the Battles list. */
export function pushBattleChallenge(battle) {
  if (!battle) return;
  const card = {
    responses: 0,
    status: 'OPEN',
    sport: 'GYM',
    source: 'BATTLE_REWIND',
    isHotFeature: false,
    ...battle,
    id: battle.id || `rewind-${Date.now()}`,
  };
  pendingBattles.push(card);
  emitBattles(card);
}

/** Publish a top-priority LIVE 1v1 HOT FEATURE for the Battles page. */
export function pushHotFeatureBattle(feature) {
  if (!feature) return;
  const card = {
    responses: 0,
    status: 'LIVE',
    sport: 'GYM',
    source: 'BATTLE_BAWAAL',
    isHotFeature: true,
    host: '@MUMBAI_STRIKER',
    target: feature.challengeTitle || feature.target || 'Live 1v1 Open Challenge',
    description: feature.description || null,
    ...feature,
    id: feature.id || `live-bawaal-${Date.now()}`,
    liveMatch: feature.liveMatch || {
      category: `[GYM] ${feature.challengeTitle || 'Live 1v1 Open Challenge'}`,
      timerLabel: '00:00',
      spectatorsLabel: 'JUST LIVE',
      host: {
        id: 'host-you',
        handle: feature.host || '@MUMBAI_STRIKER',
        flag: feature.hostFlag || '🇮🇳',
        label: feature.hostLabel || 'INDIA',
        reps: 0,
        rtcUid: 1001,
        streamId: `rtc-host-${Date.now()}`,
      },
    },
  };
  hotFeature = card;
  pendingBattles.unshift(card);
  emitHotFeature(card);
  emitBattles(card);
  return card;
}

export function getHotFeatureBattle() {
  return hotFeature;
}

export function subscribeBattleChallenges(fn) {
  battleListeners.add(fn);
  pendingBattles.forEach((b) => {
    try {
      fn(b);
    } catch (_) {
      /* ignore */
    }
  });
  return () => battleListeners.delete(fn);
}

export function subscribeHotFeature(fn) {
  hotFeatureListeners.add(fn);
  if (hotFeature) {
    try {
      fn(hotFeature);
    } catch (_) {
      /* ignore */
    }
  }
  return () => hotFeatureListeners.delete(fn);
}

export function drainPendingBattles() {
  const out = pendingBattles.slice();
  pendingBattles = [];
  return out;
}

/** Page / store key used by product docs */
export const BAWAAL_BATTLES_PAGE = 'BAWAAL_BATTLES_PAGE';

const battlesFeedStore = {
  pushBattleChallenge,
  pushHotFeatureBattle,
  subscribeBattleChallenges,
  subscribeHotFeature,
  getHotFeatureBattle,
  drainPendingBattles,
  BAWAAL_BATTLES_PAGE,
};

export default battlesFeedStore;
