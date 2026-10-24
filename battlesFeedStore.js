/**
 * BAWAAL Battles feed store — persistent battlesList for Rewind + HOT FEATURE cards.
 * Page key: BAWAAL_BATTLES_PAGE
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
 * @property {string} [title]
 * @property {number} [targetReps]
 * @property {number} [timeLimit]
 * @property {number} [timeLimitSec]
 * @property {number} [timestamp]
 * @property {string} [source]
 * @property {boolean} [isHotFeature]
 * @property {object} [liveMatch]
 */

/** @type {BattleChallengeCard[]} */
let battlesList = [];
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

function prependBattle(card) {
  battlesList = [card, ...battlesList.filter((b) => b.id !== card.id)];
  emitBattles(card);
  return card;
}

/** Push an async Battle Rewind challenge — prepends to battlesList. */
export function pushBattleChallenge(battle) {
  if (!battle) return null;
  const timestamp = battle.timestamp || Date.now();
  const card = {
    responses: 0,
    status: 'OPEN',
    sport: 'GYM',
    source: 'BATTLE_REWIND',
    isHotFeature: false,
    host: '@MUMBAI_STRIKER',
    ...battle,
    id: battle.id || `rewind-${timestamp}`,
    title: battle.title || battle.target || 'Open Challenge',
    target: battle.target || battle.title || 'Open Challenge',
    description: battle.description ?? null,
    videoUri: battle.videoUri || null,
    targetReps: battle.targetReps,
    timeLimit: battle.timeLimit ?? battle.timeLimitSec,
    timeLimitSec: battle.timeLimitSec ?? battle.timeLimit,
    timestamp,
  };
  return prependBattle(card);
}

/** Publish a top-priority LIVE 1v1 HOT FEATURE for the Battles page. */
export function pushHotFeatureBattle(feature) {
  if (!feature) return null;
  const timestamp = feature.timestamp || Date.now();
  const card = {
    responses: 0,
    status: 'LIVE',
    sport: 'GYM',
    source: 'BATTLE_BAWAAL',
    isHotFeature: true,
    host: '@MUMBAI_STRIKER',
    target: feature.challengeTitle || feature.target || feature.title || 'Live 1v1 Open Challenge',
    title: feature.title || feature.challengeTitle || feature.target || 'Live 1v1 Open Challenge',
    description: feature.description || null,
    videoUri: feature.videoUri || null,
    ...feature,
    id: feature.id || `live-bawaal-${timestamp}`,
    timestamp,
    liveMatch: feature.liveMatch || {
      category: `[GYM] ${feature.challengeTitle || feature.title || 'Live 1v1 Open Challenge'}`,
      timerLabel: '00:00',
      spectatorsLabel: 'JUST LIVE',
      host: {
        id: 'host-you',
        handle: feature.host || '@MUMBAI_STRIKER',
        flag: feature.hostFlag || '🇮🇳',
        label: feature.hostLabel || 'INDIA',
        reps: 0,
        rtcUid: 1001,
        streamId: `rtc-host-${timestamp}`,
      },
    },
  };
  hotFeature = card;
  prependBattle(card);
  emitHotFeature(card);
  return card;
}

export function getBattlesList() {
  return battlesList.slice();
}

export function getHotFeatureBattle() {
  return hotFeature;
}

export function subscribeBattleChallenges(fn) {
  battleListeners.add(fn);
  battlesList.forEach((b) => {
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
  return battlesList.slice();
}

export const BAWAAL_BATTLES_PAGE = 'BAWAAL_BATTLES_PAGE';

const battlesFeedStore = {
  pushBattleChallenge,
  pushHotFeatureBattle,
  getBattlesList,
  subscribeBattleChallenges,
  subscribeHotFeature,
  getHotFeatureBattle,
  drainPendingBattles,
  BAWAAL_BATTLES_PAGE,
};

export default battlesFeedStore;
