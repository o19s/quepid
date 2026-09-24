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
      { find: "utils/case_header", replacement: path.resolve(repoRoot, "app/javascript/utils/case_header.js") },
      { find: "utils/bs_tooltip", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_tooltip.js") },
      { find: "utils/bs_popover", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_popover.js") },
      { find: "utils/bs_modal", replacement: path.resolve(repoRoot, "app/javascript/utils/bs_modal.js") },
      { find: "utils/dynamic_modal", replacement: path.resolve(repoRoot, "app/javascript/utils/dynamic_modal.js") },
      { find: "utils/detailed_document_modal", replacement: path.resolve(repoRoot, "app/javascript/utils/detailed_document_modal.js") },
      { find: "utils/clipboard", replacement: path.resolve(repoRoot, "app/javascript/utils/clipboard.js") },
      { find: "utils/json_explorer", replacement: path.resolve(repoRoot, "app/javascript/utils/json_explorer.js") },
      { find: "utils/text_paste", replacement: path.resolve(repoRoot, "app/javascript/utils/text_paste.js") },
      { find: "utils/count_up", replacement: path.resolve(repoRoot, "app/javascript/utils/count_up.js") },
      { find: "utils/share_case_teams", replacement: path.resolve(repoRoot, "app/javascript/utils/share_case_teams.js") },
      { find: "utils/status_message", replacement: path.resolve(repoRoot, "app/javascript/utils/status_message.js") },
      { find: "utils/destructive_form", replacement: path.resolve(repoRoot, "app/javascript/utils/destructive_form.js") },
      { find: "utils/case_csv", replacement: path.resolve(repoRoot, "app/javascript/utils/case_csv.js") },
      { find: "utils/download_file", replacement: path.resolve(repoRoot, "app/javascript/utils/download_file.js") },
      { find: "utils/flash", replacement: path.resolve(repoRoot, "app/javascript/utils/flash.js") },
      { find: "utils/search_engine_name", replacement: path.resolve(repoRoot, "app/javascript/utils/search_engine_name.js") },
      { find: "utils/browse_query", replacement: path.resolve(repoRoot, "app/javascript/utils/browse_query.js") },
      { find: "utils/rated_docs", replacement: path.resolve(repoRoot, "app/javascript/utils/rated_docs.js") },
      { find: "utils/scoring", replacement: path.resolve(repoRoot, "app/javascript/utils/scoring.js") },
      { find: "utils/query_state", replacement: path.resolve(repoRoot, "app/javascript/utils/query_state.js") },
      { find: "utils/query_lifecycle", replacement: path.resolve(repoRoot, "app/javascript/utils/query_lifecycle.js") },
      { find: "stores/case_score_store", replacement: path.resolve(repoRoot, "app/javascript/stores/case_score_store.js") },
      { find: "stores/query_collection_store", replacement: path.resolve(repoRoot, "app/javascript/stores/query_collection_store.js") },
      { find: "stores/query_documents_store", replacement: path.resolve(repoRoot, "app/javascript/stores/query_documents_store.js") },
      { find: /^controllers\/(.*)$/, replacement: path.resolve(repoRoot, "app/javascript/controllers") + "/$1" }
    ],
  },
})
