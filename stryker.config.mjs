// StrykerJS mutation testing config for the modern `app/javascript/` tree (Vitest).
//
// Scope starts at `api/` and `utils/` since those are the directories with a strict
// "new/changed logic needs a test in test/javascript/" policy (CLAUDE.md § Tests). Expand
// `mutate` to specific controllers as they gain solid Vitest coverage.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "yarn",
  testRunner: "vitest",
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  mutate: ["app/javascript/api/**/*.js", "app/javascript/utils/**/*.js"],
  // Stryker copies the project into a sandbox. Skip directories the tests never read:
  // `volumes/` holds the live MySQL socket (copy fails with ENOENT) and `.claude/skills`
  // is a directory symlink (copy fails with EISDIR); the rest are just slow to copy.
  ignorePatterns: [
    ".agents",
    ".claude",
    ".mutant",
    ".playwright-mcp",
    "coverage",
    "docs",
    "log",
    "public",
    "storage",
    "volumes"
  ],
  vitest: {
    configFile: "vitest.config.js"
  },
  incremental: true,
  incrementalFile: "tmp/stryker-tmp/incremental.json",
  tempDirName: "tmp/stryker-tmp",
  htmlReporter: {
    fileName: "tmp/mutation-report/mutation-report.html"
  }
}
