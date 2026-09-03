// Flat ESLint config for the Expo client. The server has its own in server/.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['node_modules/**', 'ios/**', 'android/**', '.expo/**', 'dist/**', 'server/**', 'docs/**'],
  },
  {
    rules: {
      // Hooks deps are enforced; exhaustive-deps stays a warning so intentional
      // one-shot effects can be reviewed rather than silenced.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
