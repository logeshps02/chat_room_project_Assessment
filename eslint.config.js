const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, io: 'readonly' },
    },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
