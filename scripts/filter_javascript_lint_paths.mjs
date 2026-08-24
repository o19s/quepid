/**
 * Filter staged paths to the shared app/javascript lint scope.
 * Usage: node scripts/filter_javascript_lint_paths.mjs path1 path2 ...
 * Prints one repo-relative path per line (for bash mapfile / xargs).
 */
import { isLintableJavascriptPath } from '../config/javascript_lint_scope.mjs';

const paths = process.argv.slice(2).filter(isLintableJavascriptPath);
for (const path of paths) {
  process.stdout.write(`${path}\n`);
}
