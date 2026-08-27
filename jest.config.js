const esmPackages = [
  '(jest-)?react-native.*',
  '@react-native.*',
  '@react-navigation.*',
  '@legendapp.*',
  '@gorhom.*',
  'remend',
  'use-sync-external-store',
  '@op-engineering.*',
  'react-native-uuid',
].join('|');

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    require.resolve('@react-native/jest-preset/jest/setup.js'),
    './jest.setup.js',
  ],
  transformIgnorePatterns: [`node_modules/(?!(${esmPackages})/)`],
};
