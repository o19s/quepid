/**
 * Single source of truth for ESLint + Prettier scope on `app/javascript/`.
 *
 * Legacy Angular assets (`app/assets/javascripts/`) stay on JSHint — see
 * `lib/jshint/configuration.rb`.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Esbuild bridge files — not importmap/Stimulus; excluded from modern lint. */
export const LEGACY_ESBUILD_ENTRIES = [
  'app/javascript/angular_app.js',
  'app/javascript/quepid_app.js',
  'app/javascript/jquery_bundle.js',
  'app/javascript/splainer_search_adapter.js',
];

/** Directory names under app/javascript/ never linted (vendored Angular plugins). */
export const SKIPPED_DIRECTORIES = ['vendor'];

/**
 * Globs for ESLint flat-config `ignores` (repo-root-relative).
 * @type {string[]}
 */
export const ESLINT_IGNORES = [
  '**/node_modules/**',
  'app/assets/**',
  'public/**',
  'vendor/**',
  'spec/**',
  'test/**',
  'app/assets/builds/**',
  'app/javascript/vendor/**',
  ...LEGACY_ESBUILD_ENTRIES,
  'app/javascript/**/*.test.js',
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
  if (LEGACY_ESBUILD_ENTRIES.includes(normalized)) {
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
  const base = join(repoRoot, 'app/javascript');
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
        if (isLintableJavascriptPath(rel)) {
          results.push(rel);
        }
      }
    }
  }

  walk(base);
  return results.sort();
}

/**
 * Whether a repo-relative path is in the Prettier format scope.
 * Narrow scope avoids a one-shot Prettier reformat of all controllers/modules;
 * project style is double quotes (see docs/js_tooling.md).
 * @param {string} path
 * @returns {boolean}
 */
export function isPrettierJavascriptPath(path) {
  const normalized = path.replace(/^\.\//, '');
  return (
    normalized.startsWith('app/javascript/api/') ||
    normalized.startsWith('app/javascript/utils/')
  );
}

/**
 * Files Prettier checks (repo-relative paths).
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
export function listPrettierJavascriptFiles(repoRoot = process.cwd()) {
  return listLintableJavascriptFiles(repoRoot).filter(isPrettierJavascriptPath);
}

/** ESLint `files` glob for the modern stack. */
export const ESLINT_FILES = ['app/javascript/**/*.js'];
