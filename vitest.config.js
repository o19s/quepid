/**
 * Vitest for `app/javascript/` (importmap + Stimulus). Legacy Angular specs stay on Karma.
 *
 * Import aliases mirror `config/importmap.rb` pins — add new pins here when modules
 * are imported by bare path in tests or under test.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["app/javascript/**/*.test.js"],
    globals: false,
  },
  resolve: {
    alias: {
      "@hotwired/stimulus": path.resolve(repoRoot, "app/javascript/test/stimulus_stub.js"),
      "api/fetch": path.resolve(repoRoot, "app/javascript/api/fetch.js"),
      "utils/quepid_root": path.resolve(repoRoot, "app/javascript/utils/quepid_root.js"),
      "utils/bs_tooltip": path.resolve(repoRoot, "app/javascript/utils/bs_tooltip.js"),
      "utils/bs_popover": path.resolve(repoRoot, "app/javascript/utils/bs_popover.js"),
      "utils/text_paste": path.resolve(repoRoot, "app/javascript/utils/text_paste.js"),
      "utils/count_up": path.resolve(repoRoot, "app/javascript/utils/count_up.js"),
      "utils/share_case_teams": path.resolve(repoRoot, "app/javascript/utils/share_case_teams.js")
    },
  },
})
