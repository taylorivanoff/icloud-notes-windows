import eslint from '@eslint/js';
import globals from 'globals';

const nodeFiles = [
  'main/**/*.js',
  'preload/**/*.js',
  'scripts/**/*.js',
  'scripts/**/*.cjs',
  'src/**/*.js',
  'index.js',
  'examples/**/*.js',
  '*.js',
  '**/preload.js',
];

const browserFiles = ['renderer/**/*.js', 'ui/**/*.js'];

const unusedVarsRule = ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }];

/** Apply in ESM packages (`"type": "module"`) after the default export. */
export const esmOverride = {
  files: ['main/**/*.js', 'preload/**/*.js', 'scripts/**/*.js', 'src/**/*.js', '*.js'],
  languageOptions: {
    sourceType: 'module',
  },
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  {
    files: nodeFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': unusedVarsRule,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
    },
  },
  {
    files: browserFiles,
    ignores: ['**/preload.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': unusedVarsRule,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
    },
  },
];
