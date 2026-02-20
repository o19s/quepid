/**
 * ESLint flat config for Quepid.
 *
 * Replaces JSHint. Rules are mapped from .jshintrc equivalents:
 * - bitwise, curly, eqeqeq, eqnull, latedef, newcap, noarg, strict, trailing, undef, unused
 * - indent, quotmark, smarttabs → Prettier
 * - globals: test (describe, it, expect, etc.) and browser
 *
 * @see docs/linting.md
 */

import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      'vendor/**',
      'node_modules/**',
      'app/assets/builds/**',
      'app/assets/javascripts/mode-json.js',
      'db/scorers/**',
      'test/fixtures/**',
      '**/sortablejs.js',
      'coverage/**',
      'public/javascripts/**',
      'lib/assets/javascripts/**',
      'lib/*.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Test globals (Vitest/Jasmine-style)
        after: 'readonly',
        afterEach: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        inject: 'readonly',
        it: 'readonly',
        quepidMocks: 'readonly',
        spyOn: 'readonly',
        testTry: 'readonly',
        // Bundled/imported globals
        Turbo: 'readonly',
        CodeMirror: 'readonly',
        bootstrap: 'readonly',
        CalHeatmap: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 2024,
      },
    },
    rules: {
      // JSHint bitwise: true → disallow bitwise operators
      'no-bitwise': 'error',
      // JSHint curly: true → require braces
      curly: ['error', 'all'],
      // JSHint eqeqeq: true, eqnull: true → require === except allow == null for null/undefined check
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // JSHint eqnull: true → allow == null (for null/undefined check)
      'no-eq-null': 'off',
      // JSHint latedef: true → no use before declaration
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      // JSHint newcap: true → require new for constructors
      'new-cap': ['error', { newIsCap: true, capIsNew: true }],
      // JSHint noarg: true → no arguments.callee
      'no-caller': 'error',
      // JSHint strict: true → ES modules are implicitly strict; legacy scripts use "use strict"
      strict: ['error', 'safe'],
      // JSHint trailing: true → no trailing spaces (Prettier also handles)
      'no-trailing-spaces': 'error',
      // JSHint undef: true → no undefined variables
      'no-undef': 'error',
      // JSHint unused: true → no unused variables
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // JSHint boss: true, expr: true → allow assignments/expressions in conditionals
      'no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
    },
  },
  eslintConfigPrettier,
];
