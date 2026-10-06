import config from "../../stryker.config.mjs"

// The unchanged seven tests kill 15/22 mutants. A passing dry run alone
// misses runner regressions that silently skip every selected test.
export default {
  ...config,
  mutate: ["app/javascript/utils/record_identity.js"],
  testFiles: ["test/javascript/utils/record_identity.test.js"],
  incremental: false,
  concurrency: 2,
  reporters: ["clear-text"],
  thresholds: { high: 80, low: 68, break: 68 }
}
