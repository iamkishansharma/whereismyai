module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['jest.config.js', 'jest.setup.js', '__tests__/**/*'],
      env: { jest: true },
    },
  ],
};
