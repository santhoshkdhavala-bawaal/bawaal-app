const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

module.exports = defaultConfig;