/**
 * Run Prettier on the shared app/javascript lint scope (see config/javascript_lint_scope.mjs).
 *
 * Usage:
 *   node scripts/javascript_lint.mjs check
 *   node scripts/javascript_lint.mjs write
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listPrettierJavascriptFiles } from '../config/javascript_lint_scope.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];

if (mode !== 'check' && mode !== 'write') {
  console.error('Usage: node scripts/javascript_lint.mjs <check|write>');
  process.exit(1);
}

const files = listPrettierJavascriptFiles(repoRoot);
if (files.length === 0) {
  process.exit(0);
}

const prettierBin = join(repoRoot, 'node_modules/.bin/prettier');
const prettierArgs = [mode === 'write' ? '--write' : '--check', ...files];

const result = spawnSync(prettierBin, prettierArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
