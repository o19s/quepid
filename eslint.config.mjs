/**
 * ESLint flat config for Quepid's first-party JavaScript.
 *
 * Scope is defined in `config/javascript_lint_scope.mjs` (shared with Prettier).
 */
import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import {
  ESLINT_FILES,
  ESLINT_IGNORES,
  LEGACY_SCRIPT_FILES,
} from './config/javascript_lint_scope.mjs';

const recommendedRules = {
  ...js.configs.recommended.rules,
  ...eslintConfigPrettier.rules,
};

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
      ...recommendedRules,
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Relaxed during migration — revisit when cleaning debug logging.
      'no-console': 'off',
      // Relaxed during migration — revisit when cleaning debug logging.
      'no-unused-vars': 'off',
    },
  },
  {
    files: LEGACY_SCRIPT_FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ace: 'readonly',
        Shepherd: 'readonly',
        setupTour: 'readonly',
        startTour: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-var': 'off',
      'prefer-const': 'off',
    },
  },
  {
    files: ['test/javascript/**/*.js'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...recommendedRules,
      'no-console': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'config/javascript_lint_scope.mjs',
      'eslint.config.mjs',
      'stryker.config.mjs',
      'build_css.js',
      'audit_css.js',
      'vitest.config.js',
    ],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...recommendedRules,
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: [
      'lib/**/*.js',
      'db/scorers/**/*.js',
      'db/mapper_based_search_engines/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: {
      ...recommendedRules,
      // These files run inside MiniRacer with Quepid-provided globals.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-prototype-builtins': 'off',
      'no-redeclare': 'off',
      'no-useless-assignment': 'off',
    },
  },
];
