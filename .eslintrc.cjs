/**
 * Pragmatic baseline: catch real defects (unused code, unsafe patterns) without
 * fighting the scaffold's pervasive `any`. Tighten incrementally as modules
 * get real implementations + tests.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, jest: true, es2022: true },
  ignorePatterns: ['dist/', 'node_modules/', 'supabase/', 'lib/', '*.js', '*.mjs', '*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-function': 'off',
  },
};
