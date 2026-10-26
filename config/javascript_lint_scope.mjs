/**
 * Single source of truth for ESLint + Prettier scope on `app/javascript/`
 * (plus `test/javascript/`, `test/playwright/` and `scripts/` for Prettier).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Directory names never linted or formatted (vendored legacy plugins, Playwright output). */
export const SKIPPED_DIRECTORIES = ['vendor', 'node_modules', 'test-results', 'playwright-report'];

/** File extensions the directory walk considers; `include` narrows them per scope. */
const SCRIPT_EXTENSIONS = ['.js', '.mjs', '.ts'];

/** Directories outside app/javascript/ whose `.js`, `.mjs` and `.ts` files Prettier formats. */
const PRETTIER_DIRECTORIES = ['test/javascript', 'test/playwright', 'scripts'];

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
 * Sorted repo-relative `.js`/`.mjs`/`.ts` paths under `directory` that pass `include`.
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
      } else if (SCRIPT_EXTENSIONS.some((extension) => name.endsWith(extension))) {
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
 * the app/javascript/ lint scope plus the Vitest specs under test/javascript/, the
 * Playwright specs and tooling under test/playwright/, and scripts/.
 * Project style is double quotes (see docs/js_tooling.md).
 * @param {string} path
 * @returns {boolean}
 */
export function isPrettierJavascriptPath(path) {
  const normalized = path.replace(/^\.\//, '');
  if (isLintableJavascriptPath(normalized)) {
    return true;
  }
  if (normalized.split('/').some((segment) => SKIPPED_DIRECTORIES.includes(segment))) {
    return false;
  }
  return (
    PRETTIER_DIRECTORIES.some((directory) => normalized.startsWith(`${directory}/`)) &&
    SCRIPT_EXTENSIONS.some((extension) => normalized.endsWith(extension))
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
    ...PRETTIER_DIRECTORIES.flatMap((directory) =>
      listJavascriptFiles(repoRoot, directory, isPrettierJavascriptPath)
    ),
  ];
}

/** ESLint `files` glob for the modern stack. */
export const ESLINT_FILES = ['app/javascript/**/*.js'];
