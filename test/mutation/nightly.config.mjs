import config from "../../stryker.config.mjs"

// Scheduled full run (.github/workflows/mutation.yml). Not incremental, because CI has no
// cache; static mutants are skipped as in local runs (docs/js_tooling.md). The break line sits
// a little under the current score, so it catches a real drop in how well the specs assert
// without failing on noise.
export default {
  ...config,
  incremental: false,
  ignoreStatic: true,
  reporters: ["clear-text"],
  clearTextReporter: { allowColor: false },
  thresholds: { high: 85, low: 80, break: 80 }
}
