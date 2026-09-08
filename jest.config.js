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
  // whisper.rn's `exports` map resolves the `react-native` condition to raw
  // `src/*.ts`, so Jest has to transform it rather than skip it.
  'whisper.rn',
].join('|');

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    require.resolve('@react-native/jest-preset/jest/setup.js'),
    './jest.setup.js',
  ],
  transformIgnorePatterns: [`node_modules/(?!(${esmPackages})/)`],
};
