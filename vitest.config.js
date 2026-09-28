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
      { find: "modules/editor", replacement: path.resolve(repoRoot, "app/javascript/modules/editor.js") },
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
      { find: "utils/error_message", replacement: path.resolve(repoRoot, "app/javascript/utils/error_message.js") },
      { find: "utils/search_error", replacement: path.resolve(repoRoot, "app/javascript/utils/search_error.js") },
      { find: "utils/search_engine_name", replacement: path.resolve(repoRoot, "app/javascript/utils/search_engine_name.js") },
      { find: "utils/browse_query", replacement: path.resolve(repoRoot, "app/javascript/utils/browse_query.js") },
      { find: "utils/rated_docs", replacement: path.resolve(repoRoot, "app/javascript/utils/rated_docs.js") },
      { find: "utils/scoring", replacement: path.resolve(repoRoot, "app/javascript/utils/scoring.js") },
      { find: "utils/scorer_catalog", replacement: path.resolve(repoRoot, "app/javascript/utils/scorer_catalog.js") },
      { find: "utils/user_runtime", replacement: path.resolve(repoRoot, "app/javascript/utils/user_runtime.js") },
      { find: "utils/search_endpoint_runtime", replacement: path.resolve(repoRoot, "app/javascript/utils/search_endpoint_runtime.js") },
      { find: "utils/mapper_search_runtime", replacement: path.resolve(repoRoot, "app/javascript/utils/mapper_search_runtime.js") },
      { find: "utils/diff_scores", replacement: path.resolve(repoRoot, "app/javascript/utils/diff_scores.js") },
      { find: "utils/diff_results", replacement: path.resolve(repoRoot, "app/javascript/utils/diff_results.js") },
      { find: "utils/query_state", replacement: path.resolve(repoRoot, "app/javascript/utils/query_state.js") },
      { find: "utils/qgraph", replacement: path.resolve(repoRoot, "app/javascript/utils/qgraph.js") },
      { find: "utils/tune_relevance", replacement: path.resolve(repoRoot, "app/javascript/utils/tune_relevance.js") },
      { find: "utils/core_angular_adapter", replacement: path.resolve(repoRoot, "app/javascript/utils/core_angular_adapter.js") },
      { find: "utils/editor_mode", replacement: path.resolve(repoRoot, "app/javascript/utils/editor_mode.js") },
      { find: "utils/query_lifecycle", replacement: path.resolve(repoRoot, "app/javascript/utils/query_lifecycle.js") },
      { find: "utils/query_service", replacement: path.resolve(repoRoot, "app/javascript/utils/query_service.js") },
      { find: "utils/live_query_search", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_search.js") },
      { find: "utils/live_query_model", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_model.js") },
      { find: "utils/live_query_documents", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_documents.js") },
      { find: "utils/live_query_factory", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_factory.js") },
      { find: "utils/live_query_commands", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_commands.js") },
      { find: "utils/live_query_events", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_events.js") },
      { find: "utils/live_query_execution", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_execution.js") },
      { find: "utils/live_query_runtime", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_runtime.js") },
      { find: "utils/live_query_lifecycle", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_lifecycle.js") },
      { find: "utils/live_query_diff", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_diff.js") },
      { find: "utils/live_query_state", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_state.js") },
      { find: "utils/live_query_registry", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_registry.js") },
      { find: "utils/live_query_collection", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_collection.js") },
      { find: "utils/live_query_transport", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_transport.js") },
      { find: "utils/live_query_compatibility", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_compatibility.js") },
      { find: "utils/live_query_adapters", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_adapters.js") },
      { find: "utils/live_query_capabilities", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_capabilities.js") },
      { find: "utils/live_query_runtime_initializer", replacement: path.resolve(repoRoot, "app/javascript/utils/live_query_runtime_initializer.js") },
      { find: "quepid_search", replacement: path.resolve(repoRoot, "app/javascript/quepid_search.js") },
      { find: "utils/query_model", replacement: path.resolve(repoRoot, "app/javascript/utils/query_model.js") },
      { find: "utils/query_documents", replacement: path.resolve(repoRoot, "app/javascript/utils/query_documents.js") },
      { find: "utils/query_runtime", replacement: path.resolve(repoRoot, "app/javascript/utils/query_runtime.js") },
      { find: "utils/curator_vars", replacement: path.resolve(repoRoot, "app/javascript/utils/curator_vars.js") },
      { find: "utils/book_sync", replacement: path.resolve(repoRoot, "app/javascript/utils/book_sync.js") },
      { find: "utils/doc_cache", replacement: path.resolve(repoRoot, "app/javascript/utils/doc_cache.js") },
      { find: "utils/ratings_store", replacement: path.resolve(repoRoot, "app/javascript/utils/ratings_store.js") },
      { find: "utils/snapshot_searcher", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_searcher.js") },
      { find: "utils/snapshot_model", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_model.js") },
      { find: "utils/snapshot_hydration", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_hydration.js") },
      { find: "utils/snapshot_api", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_api.js") },
      { find: "utils/snapshot_import", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_import.js") },
      { find: "utils/snapshot_payload", replacement: path.resolve(repoRoot, "app/javascript/utils/snapshot_payload.js") },
      { find: "utils/query_scoring", replacement: path.resolve(repoRoot, "app/javascript/utils/query_scoring.js") },
      { find: "utils/wizard_contracts", replacement: path.resolve(repoRoot, "app/javascript/utils/wizard_contracts.js") },
      { find: "stores/case_score_store", replacement: path.resolve(repoRoot, "app/javascript/stores/case_score_store.js") },
      { find: "stores/query_collection_store", replacement: path.resolve(repoRoot, "app/javascript/stores/query_collection_store.js") },
      { find: "stores/query_documents_store", replacement: path.resolve(repoRoot, "app/javascript/stores/query_documents_store.js") },
      { find: "stores/diff_state_store", replacement: path.resolve(repoRoot, "app/javascript/stores/diff_state_store.js") },
      { find: /^controllers\/(.*)$/, replacement: path.resolve(repoRoot, "app/javascript/controllers") + "/$1" }
    ],
  },
})
