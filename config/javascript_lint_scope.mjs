/**
 * Single source of truth for ESLint + Prettier scope on `app/javascript/`
 * (plus `test/javascript/` for Prettier).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Directory names under app/javascript/ never linted (vendored legacy plugins). */
export const SKIPPED_DIRECTORIES = ['vendor'];

/**
 * Globs for ESLint flat-config `ignores` (repo-root-relative).
 * @type {string[]}
 */
export const ESLINT_IGNORES = [
  '**/node_modules/**',
  'public/**',
  'vendor/**',
  'spec/**',
  'test/fixtures/**',
  'test/playwright/test-results/**',
  'test/playwright/playwright-report/**',
  'app/assets/builds/**',
  'app/javascript/vendor/**',
];

/**
 * Whether a repo-relative path is in the modern JS lint/format scope.
 * @param {string} path
 * @returns {boolean}
 */
export function isLintableJavascriptPath(path) {
  const normalized = path.replace(/^\.\//, '');
  if (!normalized.startsWith('app/javascript/')) {
    return false;
  }
  if (!normalized.endsWith('.js')) {
    return false;
  }
  if (normalized.startsWith('app/javascript/vendor/')) {
    return false;
  }
  return true;
}

/**
 * All lintable JS files under app/javascript/ (repo-relative paths).
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
export function listLintableJavascriptFiles(repoRoot = process.cwd()) {
  return listJavascriptFiles(repoRoot, 'app/javascript', isLintableJavascriptPath);
}

/**
 * Sorted repo-relative `.js` paths under `directory` that pass `include`.
 * @param {string} repoRoot
 * @param {string} directory
 * @param {(path: string) => boolean} include
 * @returns {string[]}
 */
function listJavascriptFiles(repoRoot, directory, include) {
  const base = join(repoRoot, directory);
  const results = [];

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (SKIPPED_DIRECTORIES.includes(name)) {
          continue;
        }
        walk(full);
      } else if (name.endsWith('.js')) {
        const rel = relative(repoRoot, full);
        if (include(rel)) {
          results.push(rel);
        }
      }
    }
  }

  walk(base);
  return results.sort();
}

/**
 * Whether a repo-relative path is in the Prettier format scope:
 * the app/javascript/ lint scope plus the Vitest specs under test/javascript/.
 * Project style is double quotes (see docs/js_tooling.md).
 * @param {string} path
 * @returns {boolean}
 */
export function isPrettierJavascriptPath(path) {
  const normalized = path.replace(/^\.\//, '');
  return (
    isLintableJavascriptPath(normalized) ||
    (normalized.startsWith('test/javascript/') && normalized.endsWith('.js'))
  );
}

/**
 * Files Prettier checks (repo-relative paths).
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
export function listPrettierJavascriptFiles(repoRoot = process.cwd()) {
  return [
    ...listLintableJavascriptFiles(repoRoot),
    ...listJavascriptFiles(repoRoot, 'test/javascript', isPrettierJavascriptPath),
  ];
}

/** ESLint `files` glob for the modern stack. */
export const ESLINT_FILES = ['app/javascript/**/*.js'];
