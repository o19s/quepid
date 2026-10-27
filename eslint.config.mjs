/**
 * ESLint flat config for Quepid's first-party JavaScript.
 *
 * Scope is defined in `config/javascript_lint_scope.mjs` (shared with Prettier).
 */
import js from '@eslint/js';
import stimulusConventions from './scripts/eslint/stimulus_conventions.mjs';
import jsonHelpers from './scripts/eslint/json_helpers.mjs';
import { readFileSync } from 'node:fs';

const stimulusBaseline = JSON.parse(readFileSync(new URL('./config/stimulus_conventions_baseline.json', import.meta.url), 'utf8'));
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
import {
  ESLINT_FILES,
  ESLINT_IGNORES,
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
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Stimulus: 'readonly',
        Turbo: 'readonly',
        bootstrap: 'readonly',
        Popper: 'readonly',
        ahoy: 'readonly',
        vega: 'readonly',
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
    },
  },
  {
    files: ['app/javascript/controllers/**/*.js'],
    plugins: { quepid: { rules: { 'stimulus-conventions': stimulusConventions } } },
    rules: { 'quepid/stimulus-conventions': ['error', stimulusBaseline] },
  },
  {
    // HTTP goes through api/: the api/json verb helpers, or apiFetch for non-JSON.
    files: ['app/javascript/**/*.js'],
    ignores: ['app/javascript/api/**'],
    plugins: { 'quepid-http': { rules: { 'json-helpers': jsonHelpers } } },
    rules: {
      'quepid-http/json-helpers': 'error',
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: 'Use the api/json verb helpers, or apiFetch from api/fetch for non-JSON responses.',
      }],
    },
  },
  {
    files: ['test/javascript/**/*.js'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: { vitest },
    rules: {
      ...recommendedRules,
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      // Shared assertion helpers and property-based checks call expect outside test bodies or in branches.
      'vitest/no-standalone-expect': 'off',
      'vitest/no-conditional-expect': 'off',
      'vitest/prefer-called-exactly-once-with': 'off',
      'no-console': 'off',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['test/playwright/**/*.ts'],
  })),
  {
    ...playwright.configs['flat/recommended'],
    files: ['test/playwright/**/*.ts'],
    languageOptions: {
      ...playwright.configs['flat/recommended'].languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // E2E specs branch on seed data and use force/waitForSelector deliberately; keep the bug-catching rules only.
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'playwright/no-force-option': 'off',
      'playwright/no-wait-for-selector': 'off',
      // shot() is capture-only: those specs exist to produce screenshots, not to assert.
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['shot', 'shareThenUnshare'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'test/playwright/**/*.mjs',
      'config/javascript_lint_scope.mjs',
      'eslint.config.mjs',
      'stryker.config.mjs',
      'build_css.js',
      'audit_css.js',
      'esbuild.config.js',
      'vitest.config.js',
    ],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...recommendedRules,
      'no-console': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    // Capture scripts pass callbacks to page.evaluate, which run in the browser.
    files: ['test/playwright/**/*.mjs'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: [
      'lib/**/*.js',
      'db/scorers/**/*.js',
      'db/mapper_based_search_engines/**/*.js',
    ],
    languageOptions: {
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
