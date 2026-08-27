const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { bundleModeMetroConfig } = require('react-native-worklets/bundleMode');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
module.exports = mergeConfig(defaultConfig, bundleModeMetroConfig, {
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'sql'],
  },
});
