# Embedders (query vectorizing service) plan

Proposed 2026-10-05. **Phases 1 and 2 are implemented** (branch `embedders`); phases 3–4 are not started.

An **embedder** is a team-shareable connection to an external API that turns text into a vector (OpenAI, Voyage, Ollama, any OpenAI-compatible server such as vLLM/TEI). A case can point at one embedder, the same way it points at a scorer; every query in that case is then vectorized and the vector is stored in `queries.options.query_vec`, where search templates can already reach it as `#$qOption.query_vec##`.

Delivered in four phases, each shippable on its own:

1. Embedder CRUD, provider registry and adapters.
2. Case link to an embedder.
3. Vectorization pipeline: jobs, triggers, staleness, progress.
4. Using the vector in search: browser and background evaluation.

## Existing patterns to reuse

| Need | Copy from |
| --- | --- |
| Owned + team-shared resource with an encrypted credential | `SearchEndpoint` (`has_and_belongs_to_many :teams`, `owner`, `ForUserScope`, `MaskableCredential`, `encrypts`) |
| Vendor registry as code, not data; provider presets/help in the form | `LlmProvider::DEFINITIONS` + `app/views/ai_judges/_form.html.erb` |
| Per-vendor request dialect | `LlmJudgeAdapters::{Base,OpenAi,Anthropic,Jev}` |
| HTTP client with 429/529 backoff | `LlmConnection.build` |
| "Test it" button on the form | `AiJudges::WizardController#test_prompt` |
| Long-running work + push state | ActiveJob/SolidQueue + ActionCable (`RunJudgeJudyJob`, `BroadcastJudgeActivityJob`) |

`AiJudge` is STI on `users`; embedders are not actors and must **not** follow that — they get their own table like `search_endpoints`.

## Phase 1 — Embedder CRUD

### Provider registry: `EmbedderProvider` (plain ActiveModel, like `LlmProvider`)

Each definition declares what the vendor supports, so the form and the adapter agree without per-provider conditionals:

| key | adapter | default URL | default model | dimensions param | instructions |
| --- | --- | --- | --- | --- | --- |
| `openai` | `OpenAi` | `https://api.openai.com` | `text-embedding-3-small` | `dimensions` (text-embedding-3-* only) | no |
| `voyage` | `Voyage` | `https://api.voyageai.com` | `voyage-3.5` | `output_dimension` (256/512/1024/2048 on supporting models) | no, but sends `input_type: "query"` |
| `ollama` | `Ollama` | from config, like `LlmProvider` ollama | `qwen3-embedding:0.6b` | `dimensions` on `/api/embed` (verify minimum Ollama version) | yes (prompt template) |
| `openai_compatible` | `OpenAi` | blank | blank | `dimensions` (server-dependent) | yes (prompt template) |

Registry attributes: `key`, `label`, `adapter`, `auth_style` (`:bearer`/`:none`), `default_service_url`, `default_model`, `supports_dimensions` (bool), `allowed_dimensions` (optional list), `supports_instructions` (bool), `default_instruction_template`, `max_batch_size` (OpenAI 2048, Voyage 1000, Ollama/compat a conservative 64), `help_html`.

**Instructions** are not an API feature but a text format: Qwen3-Embedding / E5 / GTE-style models expect the query wrapped, e.g.

```text
Instruct: {instruction}
Query: {query}
```

So "supports instructions" means the embedder stores an `instruction` and an `input_template` (default above) and the adapter renders it client-side before sending. Providers with `supports_instructions: false` hide those fields.

**Truncation** has two modes, chosen per embedder:

- `native` — send the provider's dimensions parameter (only offered when `supports_dimensions`).
- `client` — request the full vector, keep the first N components and L2-renormalize. Only valid for Matryoshka-trained models; the form says so. This covers Matryoshka models behind servers that don't take a dimensions parameter.
- `none` — default.

### Adapters: `app/services/embedder_adapters/`

`Base#embed(texts) -> Array<Array<Float>>` handles batching (`max_batch_size`), input templating, client-side truncation/normalization, and validates that every vector has the expected length. Subclasses implement only `request_body(texts)`, `path`, and `parse(response_body)`:

- `OpenAi` — `POST /v1/embeddings {model, input: [...], dimensions?}` → `data[].embedding` (sort by `index`).
- `Voyage` — `POST /v1/embeddings {model, input, input_type: "query", output_dimension?}` → `data[].embedding`.
- `Ollama` — `POST /api/embed {model, input: [...], dimensions?, truncate: true}` → `embeddings`.

Use `LlmConnection.build` for the HTTP client (POST retries only on 429/529, which is correct here too: a retried embedding call is cheap but must not loop on timeouts).

### Model and schema

```ruby
create_table :embedders do |t|
  t.string  :name, null: false
  t.string  :provider, null: false, limit: 50     # EmbedderProvider key
  t.string  :service_url, limit: 500
  t.string  :model, null: false
  t.string  :api_key, limit: 4000                 # encrypts, non-deterministic
  t.integer :dimensions                           # nil = model default
  t.string  :truncation, default: 'none'          # none | native | client
  t.text    :instruction
  t.text    :input_template
  t.integer :timeout, default: 30
  t.json    :options                              # provider extras (e.g. voyage output_dtype)
  t.boolean :archived, default: false
  t.integer :owner_id
  t.timestamps
end
create_table :teams_embedders, id: false do |t|
  t.integer :team_id; t.bigint :embedder_id
end
```

`Embedder` includes `ForUserScope`, `MaskableCredential`; validates provider exists, `dimensions` positive and in `allowed_dimensions` when present, `truncation: native` only when the provider supports it, `instruction` blank unless the provider supports it. A `#fingerprint` method returns a digest of `provider/model/dimensions/truncation/instruction/input_template` — used in phase 3 to detect stale vectors.

### UI (Rails pages, Stimulus — not core/Angular)

- `EmbeddersController` with index/new/edit/clone/create/update/destroy, mirroring `AiJudgesController` (team pre-select, `apply_team_ids`).
- `_form.html.erb` with provider dropdown, preset/help panel, and fields shown/hidden from the registry's `supports_*` flags (one Stimulus controller, `embedder_form_controller.js`).
- **Test** button → `Embedders::TestController#create`: embeds a sample text, returns dimension count, the first few components, and latency. Works for unsaved embedders (`:embedder_id = 'new'`, same trick as the AI judge wizard routes).
- Team page: an embedders list next to search endpoints, with share/unshare. *(Not done in phase 1: sharing is done from the embedder form's team checkboxes, and `GET api/v1/teams/:id/embedders` exists.)*
- Nav entry next to AI Judges.

### API

`api/v1/embedders` (index/show/create/update/destroy) and `api/v1/teams/:id/embedders` index, with the key masked in JSON output.

### Tests

Model validations, a registry test that every definition's adapter class exists, adapter tests with WebMock fixtures per provider (batching, ordering, truncation + renormalization, dimension mismatch error), controller tests, and the API tests.

## Phase 2 — Case link

An embedder is attached to a **case only**, exactly like a scorer (`cases.scorer_id`). Books get no embedder: a case doesn't need a book (`belongs_to :book, optional: true`), and a book-level default would make a case's embedder change when its book is swapped, without anyone touching the case.

- Migration: `cases.embedder_id` (nullable, indexed). `Case belongs_to :embedder, optional: true`; `Embedder has_many :cases, dependent: :nullify`.
- API, mirroring `Api::V1::CaseScorersController`: `GET api/cases/:case_id/embedders` (embedders the user can pick, plus the current one) and `PUT api/cases/:case_id/embedders/:id`, with `0` meaning "remove". Unlike the scorer endpoint, check the id against `current_user.embedders_involved_with` -- assigning an embedder means spending its owner's API key.
- `embedder_id` (and the embedder's name) included in the case JSON.
- UI: per the `angular-case-migration` rule, the picker on the core case page is **Stimulus**, not Angular. Model it on the existing toolbar modals in `queriesLayout.html` (`share-case-core`, `clone-case-core`; base class `core_modal_trigger_controller_base.js`): a button opening a modal listing the visible embedders, with "None". Show the current embedder, the vectorized/total query count, and a "Re-vectorize" button.
- Cases list / case wizard: no picker in phase 2; the case page is the one place to set it.
- Case clone keeps `embedder_id`. Export writes the embedder **name** only (ids aren't portable); import leaves the link empty.
- Archiving an embedder keeps existing links working (no new assignments); deleting it nullifies them. Vectors already in `query.options` stay, and phase 3 marks them stale.

## Phase 3 — Vectorization pipeline

### Storage in `queries.options`

```json
{
  "query_vec": [0.0123, -0.0456, ...],
  "query_vec_meta": {
    "embedder_id": 7,
    "embedder_name": "Voyage 1024",
    "provider": "voyage",
    "model": "voyage-3.5",
    "dimensions": 1024,
    "truncation": "native",
    "fingerprint": "ab12cd34ef56ab78",
    "text_digest": "9f1e…",
    "vectorized_at": "2026-10-05T10:00:00Z"
  }
}
```

- `query_vec` is the vector the search templates use (`#$qOption.query_vec##`).
- `query_vec_meta` records **how** that vector was made, readable by a person opening the query's options: which embedder (id and name at the time), provider, model, size and truncation, when. `fingerprint` is `Embedder#fingerprint` at the time (it covers every setting that changes the output: provider, URL, model, dimensions, truncation, instruction, template); `text_digest` is a digest of the exact text sent (query text through the input template).
- A failed attempt writes `query_vec_error` instead (`message`, `fingerprint`, `at`) and keeps any older `query_vec`/`query_vec_meta` untouched, so the status below can say *failed* rather than silently *pending*. A later success removes `query_vec_error`.
- Write with merges into `options`, never overwriting the user's own keys, so the "Set Options" modal keeps working. Round components to ~7 significant digits to keep the JSON size bounded.

### Vector status per query

Computed server-side by one method, `Query#vector_status(embedder)` (embedder = the case's), so the rules live in one place:

| Status | When | Shown on the query row |
| --- | --- | --- |
| `none` | the case has no embedder | nothing |
| `pending` | embedder set, no `query_vec` (new query, or embedder just assigned) | grey "pending vectorisation" badge |
| `stale` | there is a `query_vec`, but its meta's `embedder_id` or `fingerprint` differs from the case's embedder, or `text_digest` differs from the text that would be sent now | amber "vector outdated" badge; tooltip says what changed (e.g. "made with OpenAI small, case now uses Voyage 1024", or "embedder settings changed since 2026-10-05") |
| `failed` | `query_vec_error` matches the current fingerprint | red badge, tooltip with the error |
| `current` | meta matches | nothing (or a subtle [::] mark) |

- The queries JSON (`api/v1/queries/_query.json.jbuilder`) gains `vector_status` and `vector_status_reason`, computed with the case's embedder. The Angular query row only renders a badge from these two fields, so no fingerprint logic runs in the browser.
- `VectorizeCaseQueriesJob` picks up exactly the `pending`, `stale` and `failed` queries (all of them with `force`), so "what the badge says" and "what the job will redo" can't drift apart.
- Changing the case's embedder or editing the embedder makes statuses change without any write to the queries: the meta no longer matches, so they read as `stale` until re-vectorized.
- When the embedder changes in the case picker, or a vectorisation run broadcasts progress, the case page reloads the queries' statuses so the badges update without a page reload.

### Service and jobs

- `QueryVectorizer.new(embedder).vectorize(queries)` — renders the input text, calls the adapter in batches, and merges `query_vec` + `query_vec_meta` into each query's options in one transaction per batch.
- `VectorizeCaseQueriesJob(case_id, force: false)` — loads the `pending`, `stale` and `failed` queries (all of them when `force`; see Vector status), runs the vectorizer, and broadcasts progress (`n/total`, errors) over ActionCable to the case. Uses a per-case concurrency key (SolidQueue `limits_concurrency`) so repeated triggers don't run in parallel.
- Failures: per-batch errors are recorded on the case (or in a small log) and broadcast. A failed batch leaves those queries without a vector instead of failing the whole run.

### Triggers

| Event | Action |
| --- | --- |
| Case's embedder set or changed | enqueue `VectorizeCaseQueriesJob` |
| Embedder edited so its fingerprint changes | enqueue the job for every case whose effective embedder it is |
| Single query added (`Api::V1::QueriesController#create`) | vectorize **synchronously** with a short timeout so the first search already has the vector; on error, fall back to enqueueing the job |
| Bulk paths: `Api::V1::Bulk::QueriesController` and `RatingsImporter` use `Query.insert_all` (no callbacks); also `CaseImporter`, book refresh / `UpdateCaseJob` (`RatingsManager` creating missing queries), information-need import | explicitly enqueue `VectorizeCaseQueriesJob` after the insert |
| User clicks "Re-vectorize" | enqueue with `force: true` |
| Query `information_need` changed and the template uses it | mark stale / re-enqueue (only if we decide to support `{information_need}` in the template) |

Do the single-query case with an explicit call in the controller rather than an `after_commit` on `Query`: the `insert_all` paths bypass callbacks anyway, and an implicit external HTTP call on every save would also hit tests and imports.

### Frontend

- The core case page listens on the case channel. When vectorization finishes, reload the affected queries' `options` (`GET .../queries/:id/options`, already exists) and re-run the search for them, because templates using `#$qOption.query_vec##` return nothing useful without a vector.
- Per query, the status badge from **Vector status per query** above.
- The options modal: collapse `query_vec` to `[1024 floats]` in the editor so it doesn't open as an unreadable wall of numbers, keep it unchanged on save, and show `query_vec_meta` as is so people can read how the vector was made.

### Books

A book has no queries table and no `options` column. Query options live on `query_doc_pairs.options`, so a query's options are repeated on every one of its doc pairs. `PopulateBookJob` overwrites each pair's options with `query.options`. In the other direction, `RatingsManager#sync_judgements_to_ratings` copies a pair's options onto a query only when it creates a missing query.

**Requirement:** `PopulateBookJob` must not copy `query_vec` or `query_vec_meta` into `query_doc_pair.options`. Copy every other key unchanged. Leave a comment at the copy site explaining why:

- The vector would be stored once per rated doc instead of once per query (10 docs × ~40 KB for a 3072-dim vector), and nothing reads vectors from a book.
- A case is always vectorized by its own embedder. A vector copied back from the book could come from a different embedder and would need re-vectorizing anyway.
- Longer term, query-level data (options, information need, notes) should be stored in the book **once per query**, not on every query/doc pair. That restructuring is out of scope here, but the comment should note it as the proper fix.

Because the book carries no vectors, a case created from a book starts without `query_vec`. Creating the missing queries enqueues `VectorizeCaseQueriesJob` (see Triggers).

Books have no embedder (see Phase 2). Vectorizing the book's query/doc pairs is out of scope unless something consumes those vectors.

## Phase 4 — Using the vector in search

- **Browser (splainer-search):** `queriesSvc.js` already merges `query.options` into `searcherOptions.qOption`, and `queryTemplateSvc` resolves `#$qOption.query_vec##`. In JSON bodies a value that is exactly `"#$qOption.query_vec##"` is replaced by the raw array, which is what ES/OpenSearch `knn.query_vector` needs. For Solr `{!knn f=vec topK=10}[#$qOption.query_vec##]` the array is stringified as comma-separated numbers, so the template supplies the brackets. Document both in the search endpoint help and add a Vitest/Karma check.
- **Background evaluation — gap to close:** `FetchService#replace_values` and `#build_get_params` substitute only `#$query##`. Nightly runs and `RunCaseEvaluationJob` would send the literal placeholder. Extend them to resolve `#$qOption.<path>##` from the merged case/query options, with the same "whole-string placeholder → raw JSON value" rule as the JS. This is required for parity; without it vector cases score differently in the background than in the browser.
- If the `search_backend_interface.md` migration lands first, implement this substitution once in the shared runner instead of in `FetchService`.

## Docs and manual tests (same PRs)

- `docs/data_mapping.md`: `embedders`, `teams_embedders`, `cases.embedder_id`, the `query_vec`/`query_vec_meta` option keys.
- `docs/app_structure.md`: the `embedder_adapters` service and the jobs.
- `docs/manual-testing/`: new scenarios (embedder CRUD + test button per provider, link a case, add a query → vector present, change model → re-vectorized, kNN search using `#$qOption.query_vec##`), with `paths` in `tracking.yml`.

## Open questions

1. **Single query add:** synchronous vectorization (proposed) or always async plus re-search on broadcast?
2. **Payload size:** a 3072-dim vector is ~40 KB of JSON per query, and the case page loads every query's options. Acceptable at the start, or cap dimensions / move vectors to a separate `query_vectors` table and inject them into `qOption` server-side?
3. **Who can use an embedder's key:** any team member who can see the case triggers paid API calls on the owner's key. Is team-sharing enough, or do we need an owner-only "may be used by team" flag?
4. **Template variables:** should the input template support `{information_need}` besides `{query}`?
