/**
 * ESLint flat config for Quepid's modern JavaScript (`app/javascript/`).
 *
 * Scope is defined in `config/javascript_lint_scope.mjs` (shared with Prettier).
 */
import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import {
  ESLINT_FILES,
  ESLINT_IGNORES,
} from './config/javascript_lint_scope.mjs';

export default [
  { ignores: ESLINT_IGNORES },
  {
    files: ESLINT_FILES,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Stimulus: 'readonly',
        Turbo: 'readonly',
        bootstrap: 'readonly',
        CodeMirror: 'readonly',
        ClipboardJS: 'readonly',
        Popper: 'readonly',
        ahoy: 'readonly',
        vegaEmbed: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Relaxed during migration — revisit when cleaning debug logging.
      'no-console': 'off',
      // Relaxed during migration — revisit when cleaning debug logging.
      'no-unused-vars': 'off',
    },
  },
];
