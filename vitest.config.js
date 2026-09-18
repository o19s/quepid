/**
 * Vitest for `app/javascript/` (importmap + Stimulus). Legacy Angular specs stay on Karma.
 * Specs live under `test/javascript/`, mirroring `app/javascript/` — not colocated with source.
 *
 * Import aliases mirror `config/importmap.rb` pins — add new pins here when modules
 * are imported by bare path in tests or under test. `controllers/*` resolves via a
 * wildcard, matching the `pin_all_from` in `config/importmap.rb`.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/javascript/**/*.test.js"],
    globals: false,
  },
  resolve: {
    alias: [
      { find: "@hotwired/stimulus", replacement: path.resolve(repoRoot, "app/javascript/test/stimulus_stub.js") },
      { find: "api/fetch", replacement: path.resolve(repoRoot, "app/javascript/api/fetch.js") },
      { find: "utils/quepid_root", replacement: path.resolve(repoRoot, "app/javascript/utils/quepid_root.js") },
      { find: "utils/bs_tooltip", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_tooltip.js") },
      { find: "utils/bs_popover", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_popover.js") },
      { find: "utils/bs_modal", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_modal.js") },
      { find: "utils/text_paste", replacement: path.resolve(repoRoot, "app/javascript/utils/text_paste.js") },
      { find: "utils/count_up", replacement: path.resolve(repoRoot, "app/javascript/utils/count_up.js") },
      { find: "utils/share_case_teams", replacement: path.resolve(repoRoot, "app/javascript/utils/share_case_teams.js") },
      { find: "utils/status_message", replacement: path.resolve(repoRoot, "app/javascript/utils/status_message.js") },
      { find: "utils/destructive_form", replacement: path.resolve(repoRoot, "app/javascript/utils/destructive_form.js") },
      { find: "utils/case_csv", replacement: path.resolve(repoRoot, "app/javascript/utils/case_csv.js") },
      { find: "utils/download_file", replacement: path.resolve(repoRoot, "app/javascript/utils/download_file.js") },
      { find: /^controllers\/(.*)$/, replacement: path.resolve(repoRoot, "app/javascript/controllers") + "/$1" }
    ],
  },
})
