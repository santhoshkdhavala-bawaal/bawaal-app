/* eslint-disable global-require */
/**
 * BAWAAL custom skeleton emoji asset map.
 * Keys are clean short names (no `skel_` prefix). Use via `BawaalEmoji` or `getBawaalEmojiSource`.
 * Skull set lives in `skullEmojiRegistry.js` and is merged below.
 */
import {
  SKULL_EMOJIS,
  SKULL_EMOJI_KEYS,
  SKULL_QUICK_REACTION_KEYS,
  getSkullEmojiSource,
  hasSkullEmoji,
  DEFAULT_SKULL_EMOJI_KEY,
} from './skullEmojiRegistry';

export {
  SKULL_EMOJIS,
  SKULL_EMOJI_KEYS,
  SKULL_QUICK_REACTION_KEYS,
  getSkullEmojiSource,
  hasSkullEmoji,
  DEFAULT_SKULL_EMOJI_KEY,
};

/** Asset-map key for the default fallback (`skel_laughing1.png`). Alias: `laughing`. */
export const DEFAULT_BAWAAL_EMOJI_KEY = 'laughing1';

/** Primary map: short name → bundled PNG require (skel_* + all skull_*). */
export const BAWAAL_EMOJI_ASSETS = {
  angry: require('../../assets/skel_angry.png'),
  archery: require('../../assets/skel_archery.png'),
  badminton: require('../../assets/skel_badminton.png'),
  baseball: require('../../assets/skel_baseball.png'),
  big_tongue_out: require('../../assets/skel_big_tongue_out.png'),
  bjj: require('../../assets/skel_bjj.png'),
  bjj_gi: require('../../assets/skel_bjj_gi.png'),
  black_belt: require('../../assets/skel_black_belt.png'),
  blue_belt: require('../../assets/skel_blue_belt.png'),
  bmx: require('../../assets/skel_bmx.png'),
  bodybuilding: require('../../assets/skel_bodybuilding.png'),
  boxing_glove_punching: require('../../assets/skel_boxing_glove_punching.png'),
  bronze_cup: require('../../assets/skel_bronze_cup.png'),
  bronze_medal: require('../../assets/skel_bronze_medal.png'),
  cap_goggles_gold_chain_locket: require('../../assets/skel_cap_goggles_gold_chain_locket.png'),
  champagne_flowing: require('../../assets/skel_champagne_flowing.png'),
  climbing: require('../../assets/skel_climbing.png'),
  confused: require('../../assets/skel_confused.png'),
  cool: require('../../assets/skel_cool.png'),
  cricket: require('../../assets/skel_cricket.png'),
  cricket1: require('../../assets/skel_cricket1.png'),
  cycling: require('../../assets/skel_cycling.png'),
  dance: require('../../assets/skel_dance.png'),
  dancing: require('../../assets/skel_dancing.png'),
  embarrassed: require('../../assets/skel_embarrassed.png'),
  f1: require('../../assets/skel_f1.png'),
  football: require('../../assets/skel_football.png'),
  football_green_card: require('../../assets/skel_football_green_card.png'),
  football_red_card: require('../../assets/skel_football_red_card.png'),
  football1: require('../../assets/skel_football1.png'),
  formula1_dress: require('../../assets/skel_formula1_dress.png'),
  formula1_flag: require('../../assets/skel_formula1_flag.png'),
  gold_cup: require('../../assets/skel_gold_cup.png'),
  gold_medal: require('../../assets/skel_gold_medal.png'),
  golf: require('../../assets/skel_golf.png'),
  guitar: require('../../assets/skel_guitar.png'),
  gym: require('../../assets/skel_gym.png'),
  gym1: require('../../assets/skel_gym1.png'),
  happy: require('../../assets/skel_happy.png'),
  head_on_fire: require('../../assets/skel_head_on_fire.png'),
  hockey: require('../../assets/skel_hockey.png'),
  holding_skull_headless: require('../../assets/skel_holding_skull_headless.png'),
  holding_skull_high_both_hands: require('../../assets/skel_holding_skull_high_both_hands.png'),
  holding_skull_high_gold_crown: require('../../assets/skel_holding_skull_high_gold_crown.png'),
  icehockey: require('../../assets/skel_icehockey.png'),
  kabaddi: require('../../assets/skel_kabaddi.png'),
  kickboxing_kick: require('../../assets/skel_kickboxing_kick.png'),
  kungfu: require('../../assets/skel_kungfu.png'),
  laughing1: require('../../assets/skel_laughing1.png'),
  loser: require('../../assets/skel_loser.png'),
  /** Heart-eyed skeleton — must appear in Vault as key `love`. */
  love: require('../../assets/skel_love.png'),
  meditation: require('../../assets/skel_meditation.png'),
  mindblown: require('../../assets/skel_mindblown.png'),
  mma: require('../../assets/skel_mma.png'),
  mma_gloves: require('../../assets/skel_mma_gloves.png'),
  mma1: require('../../assets/skel_mma1.png'),
  motogp: require('../../assets/skel_motogp.png'),
  ok_sign: require('../../assets/skel_ok_sign.png'),
  olive_crown: require('../../assets/skel_olive_crown.png'),
  one_hand_handstand: require('../../assets/skel_one_hand_handstand.png'),
  powerlifting: require('../../assets/skel_powerlifting.png'),
  purple_belt: require('../../assets/skel_purple_belt.png'),
  pushups: require('../../assets/skel_pushups.png'),
  referee_whistle_out: require('../../assets/skel_referee_whistle_out.png'),
  referee_whistle_out_yellow_card: require('../../assets/skel_referee_whistle_out_yellow_card.png'),
  referee_yellow_card: require('../../assets/skel_referee_yellow_card.png'),
  rugby: require('../../assets/skel_rugby.png'),
  running: require('../../assets/skel_running.png'),
  sad: require('../../assets/skel_sad.png'),
  sad1: require('../../assets/skel_sad1.png'),
  sailing: require('../../assets/skel_sailing.png'),
  scared: require('../../assets/skel_scared.png'),
  screaming: require('../../assets/skel_screaming.png'),
  scuba: require('../../assets/skel_scuba.png'),
  shocked: require('../../assets/skel_shocked.png'),
  shocked1: require('../../assets/skel_shocked1.png'),
  shouting: require('../../assets/skel_shouting.png'),
  silver_cup: require('../../assets/skel_silver_cup.png'),
  silver_medal: require('../../assets/skel_silver_medal.png'),
  skateboard: require('../../assets/skel_skateboard.png'),
  skateboard1: require('../../assets/skel_skateboard1.png'),
  skiing: require('../../assets/skel_skiing.png'),
  ...SKULL_EMOJIS,
  skydiving: require('../../assets/skel_skydiving.png'),
  sleepy: require('../../assets/skel_sleepy.png'),
  speedskating: require('../../assets/skel_speedskating.png'),
  streetfight: require('../../assets/skel_streetfight.png'),
  sumo: require('../../assets/skel_sumo.png'),
  surfing: require('../../assets/skel_surfing.png'),
  swimming: require('../../assets/skel_swimming.png'),
  tabletennis: require('../../assets/skel_tabletennis.png'),
  taekwondo: require('../../assets/skel_taekwondo.png'),
  tennis: require('../../assets/skel_tennis.png'),
  thumbs_down: require('../../assets/skel_thumbs_down.png'),
  thumbs_up: require('../../assets/skel_thumbs_up.png'),
  tongue_out_ears_teasing: require('../../assets/skel_tongue_out_ears_teasing.png'),
  tongue_out_ears_teasing1: require('../../assets/skel_tongue_out_ears_teasing1.png'),
  veryangry: require('../../assets/skel_veryangry.png'),
  veryconfused: require('../../assets/skel_veryconfused.png'),
  verycool: require('../../assets/skel_verycool.png'),
  victory: require('../../assets/skel_victory.png'),
  warning: require('../../assets/skel_warning.png'),
  waving: require('../../assets/skel_waving.png'),
  weeping: require('../../assets/skel_weeping.png'),
  wink: require('../../assets/skel_wink.png'),
  worried: require('../../assets/skel_worried.png'),
  yellow_belt: require('../../assets/skel_yellow_belt.png'),
};

/**
 * Friendly aliases → primary keys (resolved after normalize).
 * `laughing` is the public default for `skel_laughing1.png`.
 */
const BAWAAL_EMOJI_ALIASES = {
  laughing: 'laughing1',
  // Matches chat/banter shortcut: crown → gold skull crown asset
  crown: 'holding_skull_high_gold_crown',
  gold_crown: 'holding_skull_high_gold_crown',
  olive: 'olive_crown',
  boxing: 'boxing_glove_punching',
  punch: 'boxing_glove_punching',
  kickboxing: 'kickboxing_kick',
  handstand: 'one_hand_handstand',
  tongue: 'tongue_out_ears_teasing',
  teasing: 'tongue_out_ears_teasing',
  champagne: 'champagne_flowing',
  fire: 'head_on_fire',
  mind_blown: 'mindblown',
  ok: 'ok_sign',
  thumbs: 'thumbs_up',
  ice_hockey: 'icehockey',
  table_tennis: 'tabletennis',
  street_fight: 'streetfight',
  moto_gp: 'motogp',
  formula1: 'f1',
};

export const BAWAAL_EMOJI_KEYS = Object.keys(BAWAAL_EMOJI_ASSETS);

/** Normalize vault key for prefix checks (`Skull_Goal` → `skull_goal`). */
function vaultSortKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/^:+|:+$/g, '')
    .replace(/\.png$/i, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * Absolute skull vault group — keys that **start with** `skull`
 * (e.g. `skull_goal`, `skull_mvp`). Mid-string matches like `holding_skull_*` are skel.
 */
export function isSkullVaultKey(key) {
  return vaultSortKey(key).startsWith('skull');
}

/** Keys that **start with** `skel` (placed immediately after the skull block). */
export function isSkelVaultKey(key) {
  return vaultSortKey(key).startsWith('skel');
}

/**
 * Vault tier:
 * 0 = starts with `skull` (absolute first)
 * 1 = starts with `skel` (immediately after skulls)
 * 2 = remaining skeleton short names (`love`, `gym`, `holding_skull_*`, …)
 */
export function vaultEmojiTier(key) {
  const k = vaultSortKey(key);
  if (k.startsWith('skull')) return 0;
  if (k.startsWith('skel')) return 1;
  return 2;
}

/**
 * Vault / tray order: `skull*` first, then `skel*` / skeleton assets;
 * alphabetical within each group so the flex-wrap grid stays stable.
 */
export function compareVaultEmojiKeys(a, b) {
  const aTier = vaultEmojiTier(a);
  const bTier = vaultEmojiTier(b);
  if (aTier !== bTier) return aTier - bTier;
  return vaultSortKey(a).localeCompare(vaultSortKey(b));
}

export function sortVaultEmojiKeys(keys) {
  return [...(keys || [])].sort(compareVaultEmojiKeys);
}

/**
 * Static vault key list that populates FullEmojiPickerDrawer.
 * Order: all `skull…` keys → all `skel…` / skeleton assets (incl. `love`).
 */
export const ALL_SKELETON_KEYS = Object.freeze(
  sortVaultEmojiKeys(
    Array.from(new Set(['love', ...SKULL_EMOJI_KEYS, ...BAWAAL_EMOJI_KEYS]))
  )
);

if (!ALL_SKELETON_KEYS.includes('love') || !BAWAAL_EMOJI_ASSETS.love) {
  // eslint-disable-next-line no-console
  console.warn('[bawaalEmojiAssets] Vault missing love / skel_love.png');
}

if (SKULL_EMOJI_KEYS.some((key) => !BAWAAL_EMOJI_ASSETS[key])) {
  // eslint-disable-next-line no-console
  console.warn('[bawaalEmojiAssets] Vault missing one or more skull_*.png assets');
}

function normalizeEmojiKey(name) {
  if (name == null) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/^skel_/, '')
    .replace(/\.png$/i, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * Resolve a short name / alias / `skel_*` filename to a bundled Image source.
 * Missing keys fall back to `skel_laughing1.png` so callers never crash.
 */
export function getBawaalEmojiSource(name) {
  const raw = normalizeEmojiKey(name);
  const aliased = BAWAAL_EMOJI_ALIASES[raw] || raw;
  return (
    BAWAAL_EMOJI_ASSETS[aliased] ||
    BAWAAL_EMOJI_ASSETS[DEFAULT_BAWAAL_EMOJI_KEY] ||
    BAWAAL_EMOJI_ASSETS.laughing1
  );
}

export function hasBawaalEmoji(name) {
  const raw = normalizeEmojiKey(name);
  const aliased = BAWAAL_EMOJI_ALIASES[raw] || raw;
  return Boolean(BAWAAL_EMOJI_ASSETS[aliased]);
}
