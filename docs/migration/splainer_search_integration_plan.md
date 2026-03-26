# Splainer-Search Integration Plan

Replace internal Quepid JS modules with splainer-search v3 (`vanilla-simplify` branch)
where splainer-search provides richer, well-tested functionality. Keep internal code
where it is genuinely better suited to Quepid's architecture.

## Setup: Local splainer-search dependency (DONE)

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

## What to keep vs. replace

| Internal module | Action | Rationale |
|----------------|--------|-----------|
| `query_template.js` | **Delete later** — used internally until Phase 3 replaces `search_executor.js`; splainer-search's searchers call `hydrate` internally so it becomes unused | Line-for-line identical copy |
| `explain_parser.js` | **Delete** — use splainer-search `explainSvc` + `normalDocsSvc` | splainer-search has 15+ explain subclasses with proper `vectorize()`, `matchDetails()`, `toStr()`, `rawStr()`. Internal version is a simplified heuristic. |
| `settings_validator.js` | **Keep** (for now) | Tightly integrated with Quepid's proxy architecture. splainer-search's `SettingsValidatorFactory` could replace it later but isn't a priority. |
| `search_executor.js` | **Replace** — use splainer-search searcher factories via `searcher_adapter.js` | splainer-search's searchers provide NormalDoc model, explain, pagination, explainOther. Proxy handled via splainer-search's `proxyUrl` config. |
| `field_renderer.js` | **Keep** | Quepid-specific UI rendering, no splainer-search equivalent |
| `ratings_store.js` | **Keep** | Quepid-specific, not in splainer-search |
| `scorer.js` / `scorer_executor.js` | **Keep** | Quepid-specific scoring logic |
| `api_url.js`, `json_fetch.js`, `html_escape.js`, `flash_helper.js`, `wizard_settings.js` | **Keep** | Quepid infrastructure, nothing to do with splainer-search |

---

## Phases

### Phase 0: Spike — local splainer-search in importmap (DONE)

Vendored the ESM bundle to `vendor/javascript/splainer-search.js` and added
importmap pin. Verified the bundle loads and exports all expected symbols.

---

### Phase 1: FieldSpec + Query Template (IN PROGRESS)

**Goal:** Replace the two simplest modules with splainer-search equivalents.

1. **`query_template.js`** — kept for now. `queryTemplateSvc.hydrate` is not in
   splainer-search's public exports (it's used internally by the searcher factories).
   When we switch to splainer-search searchers in Phase 3, the internal module becomes
   unused and can be deleted.

2. **`createFieldSpec()` — DONE.** Replaced internal `parseFieldSpec()` in
   `search_executor.js` with `createFieldSpec` from splainer-search. Changes:
   - `parseFieldSpec()` now delegates to `createFieldSpec()`
   - Updated `normalizeDoc()` to use `fieldSpec.embeds` (was `.media`)
   - Added wildcard `subs: '*'` handling in `normalizeDoc()`
   - Updated Solr `fl` to use `fieldSpec.fieldList()` method
   - Updated ES `_source` to use `fieldSpec.fieldList()` method
   - splainer-search's FieldSpec adds support for: `highlight`, `function`,
     `unabridged`, `image`, wildcard `subs: '*'`, JSON-object field specs

**Tests:** Awaiting system test results.

---

### Phase 2: Transport adapter (DONE)

splainer-search's `proxyUrl` config prepends a URL prefix to all target URLs.
Quepid's proxy endpoint is `/proxy/fetch?url=<target>`. These are already compatible —
main branch uses the same pattern: `searcherOptions.proxyUrl = rootUrl + '/proxy/fetch?url='`.

Created `app/javascript/modules/searcher_adapter.js` which:
- Translates Quepid's `tryConfig` (snake_case API data) to splainer-search's
  `createSearcher()` options (camelCase)
- Sets `proxyUrl` from `apiUrl('proxy/fetch?url=')` when `proxy_requests !== false`
- Handles custom headers, basic auth, API method, number of rows
- Compiles SearchAPI mapper_code into `docsMapper`/`numberOfResultsMapper` functions
- Merges try-level + query-level `qOption` for per-query template variables
- Adds `echoParams=all` for Solr (matches main's behavior)
- Treats `static` engine as `solr` (matches main's behavior)

No custom transport adapter needed — Option B works out of the box.

---

### Phase 3: Searcher factories + NormalDoc model

**Goal:** Replace the core of `search_executor.js` with splainer-search searchers.

This is the largest phase. The splainer-search searcher provides:
- `searcher.search()` → executes the query, populates `searcher.docs`, `searcher.numFound`
- `searcher.pager()` → returns a new searcher for the next page
- `searcher.explainOther()` → Solr/ES explain against alternate query (Doc Finder)
- `searcher.linkUrl` → browseable URL to the search engine
- `searcher.docs` → array of engine-specific Doc objects with `.origin()`, `.explain()`,
  `.highlight()`, `.snippet()`, `._url()`
- `normalDocsSvc.createNormalDoc(fieldSpec, doc)` → NormalDoc with `.explain()`, `.score()`,
  `.hotMatchesOutOf()`, `.subSnippets()`, `.subsList`, `._url()`

#### Step 3a: Create a searcher adapter module (DONE — Phase 2)

Implemented as `app/javascript/modules/searcher_adapter.js`. See that file for
the full implementation.

#### Step 3b: Update `query_row_controller.js` to use splainer-search docs

The controller currently calls `executeSearch()` and gets back flat
`{ id, title, subs, thumb, ... }` objects. It needs to switch to NormalDoc objects.

Key changes:
- `result.docs` → array of NormalDocs instead of flat objects
- Doc rendering uses `doc.title`, `doc.subs` (already compatible)
- Explain rendering uses `doc.explain().toStr()` and `doc.hotMatchesOutOf(maxScore)`
  instead of the internal `parseExplain()` + `hotMatchesOutOf()`
- Score display uses `doc.score()` instead of `doc._source.score`
- Doc URL link uses `doc._url()` instead of nothing (new feature)
- `result.linkUrl` comes from `searcher.linkUrl`

#### Step 3c: Update pagination

Replace `_loadNextPage()` (which re-calls `executeSearch` with offset) with
`searcher.pager()`:

```js
this.currentSearcher = this.currentSearcher.pager();
if (!this.currentSearcher) return; // no more pages
await this.currentSearcher.search();
this.lastSearchDocs = this.lastSearchDocs.concat(
  this.currentSearcher.docs.map(doc => normalDocsSvc.createNormalDoc(fieldSpec, doc))
);
```

#### Step 3d: Delete internal `search_executor.js`

Once all callers use the searcher adapter, delete `search_executor.js` and its
importmap pin. Keep `fetchWithCorsFallback` if it's used as the transport adapter.

**Tests:** This phase needs careful visual parity testing. The rendering of docs,
explains, and hot matches must match what main produces. Use the existing
screenshot comparison tooling.

---

### Phase 4: Explain and Debug features

**Goal:** Full explain parity with main branch.

1. **Delete `explain_parser.js`** — use NormalDoc's `.explain()`, `.hotMatchesOutOf()`,
   `.score()`, `.matchDetails()` instead.

2. **Wire up explain modal** — the debug/explain modal needs `doc.explain().toStr()` for
   the human-readable tree and `doc.explain().rawStr()` for the raw JSON view.

3. **Wire up hot matches chart** — `doc.hotMatchesOutOf(maxScore)` returns the same
   `[{ description, percentage }]` array the chart expects, but the data comes from
   splainer-search's proper `vectorize()` decomposition instead of the heuristic.

4. **`solrExplainExtractorSvc` / `esExplainExtractorSvc`** — import these from
   splainer-search for the `normalizeDocExplains` flow used in rated-doc display
   and Doc Finder.

---

### Phase 5: Doc Finder (explainOther)

**Goal:** Implement the Doc Finder panel using splainer-search's `explainOther`.

Main's Doc Finder (`docFinder.js`) lets users search for specific documents and see
how the main query scores them. This requires:

1. `searcher.explainOther(otherQuery, fieldSpec)` — runs the main query with Solr's
   `explainOther` param, then fetches the alternate docs
2. `solrExplainExtractorSvc.docsWithExplainOther()` — normalizes the results
3. Pagination via `searcher.pager()` on the explainOther results

Create a new Stimulus controller (or extend the existing query row controller) that:
- Accepts a custom query string
- Creates a searcher from current try settings
- Calls `explainOther` and renders the rated docs

---

### Phase 6: Doc Resolver + Snapshot integration

**Goal:** Use splainer-search's `docResolverSvc` for snapshot doc resolution.

1. **Import `docResolverSvc.createResolver()`** from splainer-search
2. Use it to resolve docs by ID when displaying snapshots from engines that support
   lookup-by-ID (Solr, ES/OS, Algolia)
3. For engines that don't (Vectara, SearchAPI), fall back to the existing pattern of
   reading stored snapshot fields

4. **Snapshot creation:** When saving snapshots, store `doc.explain().rawStr()` and
   `doc.subsList` per doc (matching main's behavior in `querySnapshotSvc`)

5. **Snapshot display:** When loading snapshots, reconstitute NormalDocs using
   `normalDocsSvc.explainDoc(doc, explainJson)` so explain data is interactive

---

### Phase 7: Highlighting

**Goal:** Enable Solr/ES highlighting support.

1. splainer-search's Solr searcher already requests highlighting via `hl=true` +
   `hl.simple.pre/post` with the `HIGHLIGHTING_PRE/POST` marker strings
2. ES highlighting is requested via `highlight: { fields: {...} }` in the query DSL
3. NormalDoc's `subSnippets(hlPre, hlPost)` and `getHighlightedTitle(hlPre, hlPost)`
   replace the markers with HTML tags

Wire the doc rendering in `query_row_controller.js` to use `subSnippets('<strong>', '</strong>')` instead of raw field values.

This is a visual enhancement, not a functional requirement. It can be deferred.

---

### Phase 8: Cleanup

1. Remove `splainer-search: "^2.35.1"` from `package.json` (the old npm version)
2. Remove any remaining `// splainer-search` comments referencing the internal ports
3. Update `docs/stimulus_and_modern_js_conventions.md` to document the splainer-search
   integration pattern
4. Update `DEVELOPER_GUIDE.md` with the local splainer-search setup instructions

---

## Contributions back to splainer-search

These should happen in parallel on the `vanilla-simplify` branch:

1. **`hasSubstr` → `includes`** (already done on vanilla-simplify)
2. **Drop `urijs`** (already done on vanilla-simplify)
3. **Fix `SearchAPI.pager()` returning undefined** instead of null
4. **Fix swallowed rejections** in explainOther/explain/fetchDocs catch handlers
5. **Fix `BatchSender` timer leak** — use clearable interval or flush-on-enqueue
6. **Pluggable transport** (Phase 2 Option A) — allow consumers to inject custom fetch
7. **Collapse identical DocFactories** — Algolia/SearchAPI/Vectara → one GenericDocFactory
8. **Merge preprocessors into searcher classes** — eliminate 5 single-caller service files

---

## Risk mitigation

- **Visual parity:** Use the existing screenshot comparison tooling after each phase to
  catch rendering regressions.
- **Incremental delivery:** Each phase is independently deployable. If Phase 3 stalls,
  Phases 1-2 still provide value.
- **Rollback:** Since the internal modules are being deleted (not modified), git history
  provides easy rollback per phase.
- **Test coverage:** splainer-search has ~11K lines of tests. Quepid's system tests
  cover the integration points. Add JS unit tests for the adapter layer (Phase 3a).
