/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  bundleMode: true,
  strictGlobal: true,
  importForwarding: {
    moduleNames: ['axios', 'three', 'three/tsl', '@apollo/client', 'remend'],
  },
};

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    production: {
      plugins: ['react-native-paper/babel'],
    },
  },
  plugins: [
    ['inline-import', { extensions: ['.sql'] }],
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '^@/(.+)': './source/\\1',
        },
      },
    ],
    ['react-native-worklets/plugin', workletsPluginOptions],
  ],
};
