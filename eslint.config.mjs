/**
 * ESLint flat config for Stimulus/modules/Vitest only.
 * Angular-era code lives under app/assets/javascripts/ and is intentionally excluded
 * (JSHint remains the gate for that tree via `rails test:jshint`).
 */
import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import globals from "globals"

const modernAppGlobs = [
  "app/javascript/controllers/**/*.js",
  "app/javascript/modules/**/*.js",
  "app/javascript/application_modern.js",
  "app/javascript/application.js",
  "app/javascript/admin_users.js",
  "app/javascript/analytics.js",
  "app/javascript/jquery_bundle.js",
]

export default [
  {
    ignores: [
      "**/node_modules/**",
      "app/assets/**",
      "vendor/**",
      "public/**",
      "tmp/**",
      "coverage/**",
      "spec/**",
      "lib/assets/**",
      "docs/**",
      "db/**",
      "test/fixtures/**",
      "build_angular_app.js",
      "build_templates.js",
      "build_css.js",
      "app/views/**/*.js",
      "app/javascript/angular_app.js",
      "app/javascript/quepid_app.js",
    ],
  },
  {
    files: modernAppGlobs,
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Globals provided by Hotwire / Bootstrap / bundled libs (not in `globals.browser`)
        Turbo: "readonly",
        CodeMirror: "readonly",
        bootstrap: "readonly",
        CalHeatmap: "readonly",
        $: "readonly",
        jQuery: "readonly",
      },
    },
    // Merge with recommended — a bare `rules: { … }` would replace all of `recommended.rules`.
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["test/javascript/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["vitest.config.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
]
