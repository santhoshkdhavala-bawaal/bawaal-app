const fs = require('fs');

const reg = fs.readFileSync('src/constants/skullEmojiRegistry.js', 'utf8');
const keys = [...reg.matchAll(/^\s+(skull_[a-z0-9_]+):/gm)].map((m) => m[1]);
const assets = fs
  .readdirSync('assets')
  .filter((f) => /^skull_.*\.png$/i.test(f))
  .map((f) => f.replace(/\.png$/i, ''))
  .sort();
const missing = assets.filter((a) => !keys.includes(a));
const extra = keys.filter((k) => !assets.includes(k));
const assetsFile = fs.readFileSync('src/constants/bawaalEmojiAssets.js', 'utf8');
const bawaal = fs.readFileSync('components/BawaalEmoji.js', 'utf8');

console.log({
  registryKeys: keys.length,
  assetFiles: assets.length,
  missing,
  extra,
  importsRegistry: assetsFile.includes('skullEmojiRegistry'),
  spreadsSkulls: assetsFile.includes('...SKULL_EMOJIS'),
  quickHasHattrick: reg.includes('skull_hattrick'),
  banterQuickUsesSkulls: bawaal.includes('SKULL_QUICK_REACTION_KEYS'),
  skullEmojiComponent: fs.existsSync('components/SkullEmoji.js'),
});

if (missing.length || extra.length || keys.length !== assets.length) {
  process.exitCode = 1;
}
