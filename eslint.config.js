// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'lint-report.json'],
  },
  {
    // React Compiler rules flag normal RN / Reanimated patterns (shared values,
    // reset setState in effects, ref timing). Keep lint useful without forcing
    // risky refactors that would break production behavior.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
