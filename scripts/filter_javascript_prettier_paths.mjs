/**
 * Filter staged paths to the Prettier scope (same as the ESLint scope).
 * Usage: node scripts/filter_javascript_prettier_paths.mjs path1 path2 ...
 */
import { isPrettierJavascriptPath } from "../config/javascript_lint_scope.mjs"

const paths = process.argv.slice(2).filter(isPrettierJavascriptPath)
for (const path of paths) {
  process.stdout.write(`${path}\n`)
}
