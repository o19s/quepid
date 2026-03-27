# Splainer-Search Integration Plan (COMPLETE)

Replaced internal Quepid JS modules with splainer-search v3 (`vanilla-simplify` branch).
Kept internal code where it is genuinely better suited to Quepid's architecture.

## Setup: Local splainer-search dependency

The splainer-search `vanilla-simplify` branch builds a single ESM bundle
(`splainer-search.js`) via esbuild. We vendor this bundle directly:

```bash
# Copy the built bundle from the local splainer-search repo
cp ../splainer-search/splainer-search.js vendor/javascript/splainer-search.js
cp ../splainer-search/splainer-search.js.map vendor/javascript/splainer-search.js.map
```

Importmap pin in `config/importmap.rb`:
```ruby
pin 'splainer-search', to: 'splainer-search.js'
```

To update after changes to splainer-search: rebuild in that repo (`npm run build`)
then re-copy the bundle. When splainer-search v3 is published to npm, switch to
`bin/importmap pin splainer-search`.

---

## What was kept vs. replaced

| Module | Outcome | Rationale |
|--------|---------|-----------|
| `query_template.js` | **Deleted** | splainer-search's searchers call `hydrate` internally |
| `explain_parser.js` | **Deleted** | Replaced by splainer-search's `explainSvc` + NormalDoc `.explain()`, `.hotMatchesOutOf()` |
| `search_executor.js` | **Deleted** | Replaced by `searcher_adapter.js` + splainer-search searcher factories |
| `searcher_adapter.js` | **New** | Bridges Quepid's `tryConfig` to splainer-search's `createSearcher()` |
| `settings_validator.js` | **Kept** | Tightly integrated with Quepid's proxy architecture |
| `field_renderer.js` | **Kept** | Quepid-specific UI rendering |
| `ratings_store.js` | **Kept** | Quepid-specific |
| `scorer.js` / `scorer_executor.js` | **Kept** | Quepid-specific scoring logic |
| `api_url.js`, `json_fetch.js`, `html_escape.js`, `flash_helper.js`, `wizard_settings.js` | **Kept** | Quepid infrastructure |

---

## Phases (all complete)

### Phase 0: Vendor splainer-search bundle

Vendored the ESM bundle to `vendor/javascript/splainer-search.js` and added
importmap pin. Verified the bundle loads and exports all expected symbols.

### Phase 1: FieldSpec

Replaced internal `parseFieldSpec()` with splainer-search's `createFieldSpec`,
gaining support for highlight fields, function fields, wildcard subs, and
JSON-object field spec syntax.

### Phase 2: Transport / searcher adapter

Created `app/javascript/modules/searcher_adapter.js` which translates Quepid's
`tryConfig` (snake_case API data) to splainer-search's `createSearcher()` options.
No custom transport needed — splainer-search's `proxyUrl` config is compatible
with Quepid's `/proxy/fetch?url=` endpoint.

### Phase 3: Searcher factories + NormalDoc model

Replaced `executeSearch()` in `query_row_controller.js` with splainer-search
searchers. Created `flattenNormalDoc()` to bridge NormalDoc objects to the flat
shape the rendering code expects, with lazy getters for explain/score.
Pagination uses `searcher.pager()` instead of offset-based re-execution.

### Phase 4: Explain and debug features

- `doc_detail_modal_controller.js` uses `Explain.toStr()` for human-readable
  tree and `rawStr()` for raw JSON
- `_buildStackedChart()` calls `doc.hotMatchesOutOf()` directly
- `explainQuery()` uses pre-populated `lastResult` data (splainer-search
  searchers always request debug/explain)

### Phase 5: Doc Finder

`doc_finder_controller.js` uses `createQuepidSearcher` + `createNormalDoc`
instead of `executeSearch`. Uses `fieldSpec.id` with engine-aware `_id` default
for ES/OS rated-doc filtering.

### Phase 6: Snapshots

`snapshot_controller.js` serializes explain via `Explain.rawStr()` when
available, falling back to JSON stringify for raw objects.

### Phase 7: Highlighting

`_buildResultRow` uses `doc.subSnippets("<strong>", "</strong>")` for
highlighted field display, falling back to raw sub fields when no snippets
are available.

### Phase 8: Cleanup

- Removed `splainer-search: "^2.35.1"` from `package.json`
- Deleted `search_executor.js`, `explain_parser.js`, `query_template.js`
  and their importmap pins
- Removed dead imports from all controllers
- Updated test files to mock `searcher_adapter` and `splainer-search`
  instead of the deleted modules

---

## Known limitations

- **AbortController signal not passed to splainer-search searchers** — requests
  aren't cancellable. Would require a pluggable transport contribution to
  splainer-search.
- **Explain parsing is triggered during snapshot creation** — `doc.explain`
  lazy getter fires `rawStr()`, which initializes the full explain tree even
  though only the raw JSON is needed. Minor performance cost.

---

## Updating the vendored bundle

When splainer-search changes:

```bash
cd ../splainer-search
npm run build
cp splainer-search.js ../quepid/vendor/javascript/splainer-search.js
cp splainer-search.js.map ../quepid/vendor/javascript/splainer-search.js.map
```

Run `npx vitest run` in quepid to verify compatibility.
