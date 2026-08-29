module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void somePromise()` is the codebase's explicit marker for a
    // deliberately un-awaited write (persistence, cleanup). Rewriting those to
    // satisfy the rule would hide the intent rather than clarify it.
    'no-void': 'off',

    // react-native-paper's List.Item takes `left`/`right` render props by
    // design. The rule cannot tell them apart from an accidentally nested
    // component, and hoisting them would mean threading theme and row state
    // back through props for no benefit.
    'react/no-unstable-nested-components': [
      'warn',
      { allowAsProps: true, customValidators: [] },
    ],

    // Theme colours only exist at runtime, so a style that reads from
    // `colors.*` cannot live in StyleSheet.create. Static styles still should,
    // and reviewers can see the difference.
    'react-native/no-inline-styles': 'off',
  },
  overrides: [
    {
      files: ['jest.config.js', 'jest.setup.js', '__tests__/**/*'],
      env: { jest: true },
    },
  ],
};
