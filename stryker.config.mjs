// StrykerJS mutation testing config for the modern `app/javascript/` tree (Vitest).
// Legacy Angular (`app/assets/javascripts/`, Karma) is intentionally excluded — it's
// being phased out by the Angular -> Stimulus migration, see CLAUDE.md.
//
// Scope starts at `api/` and `utils/` since those are the directories with a strict
// "new/changed logic needs a colocated test" policy (CLAUDE.md § Tests). Expand
// `mutate` to specific controllers as they gain solid Vitest coverage.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "yarn",
  testRunner: "vitest",
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  mutate: ["app/javascript/api/**/*.js", "app/javascript/utils/**/*.js", "!app/javascript/**/*.test.js"],
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
