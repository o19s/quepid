# LLM-as-Judge via OpenAI Batch API — implementation plan

> **Deferred — not scheduled.** ADR 0001 (`docs/adr/0001-llm-judge-provider-architecture.md`) D6
> defers this work and records the trigger for starting it (§5.4). The seam it depends on is built
> first and is held to a batch-readiness contract (ADR §3), so this plan stays additive.

**Scope:** backend + database only. No UI in this plan (no views, no Stimulus, no Turbo
partials). The only controller work is the minimum needed to kick a batch off and to let
existing pages keep working.

## 1. Why

`RunJudgeJudyJob` judges one query/doc pair per HTTP round trip, synchronously, inside a
single SolidQueue job (`app/jobs/run_judge_judy_job.rb:20`). For a book with 20k pairs that
is 20k sequential requests, a job that runs for hours, and full retail token pricing.

OpenAI's Batch API takes a JSONL file of up to 50,000 requests, runs them asynchronously
within a 24h completion window, and bills at 50%. It fits the "judge a whole book" workload
far better than the current loop. The trade-off is that it is *asynchronous across process
restarts* — we submit, we go away, we come back later — so it needs durable state in the
database rather than a long-lived job.

## 2. What already exists (and what we reuse)

| Piece | Location | Reuse |
| --- | --- | --- |
| AI judge = a `User` with `llm_key` + `system_prompt` + `judge_options` | `app/models/user.rb:224`, `:290` | as-is |
| Provider config (`llm_provider`, `llm_service_url`, `llm_model`, `llm_api_version`, `llm_timeout`) | `app/controllers/ai_judges_controller.rb:70` | as-is |
| Prompt construction (`make_user_prompt`, text + optional `image_url` block) | `app/services/llm_service.rb:37` | **extract & share** |
| Response shape (`{explanation:, judgment:}` JSON object) | `app/services/llm_service.rb:141` | **extract & share** |
| Pair selection | `SelectionStrategy.random_query_doc_based_on_strategy` | extend (see §5) |
| Book ↔ judges join | `books_ai_judges` | as-is |
| Blob storage for large files | Active Storage, `:db` service in dev/prod (`config/environments/*.rb`) | reuse — same thing `Book#import_file`/`#export_file` use |
| Concurrency guard pattern | `PopulateBookJob.limits_concurrency` (`app/jobs/populate_book_job.rb:16`) | copy |
| HTTP stubbing in tests | `webmock` (`Gemfile:94`) | reuse |

## 3. Database

Two new tables. Both must be adapter-neutral (MySQL **and** PostgreSQL — see
`7ef7a3fb`), and every index needs a globally unique name (see `20260902120000`).

### 3.1 `judgement_batches` — one row per provider batch

```ruby
create_table :judgement_batches do |t|
  t.references :book, null: false, foreign_key: true, index: { name: 'index_judgement_batches_on_book_id' }
  t.integer :user_id, null: false          # the AI judge; users.id is :integer, not bigint
  t.string  :run_uuid, null: false, limit: 36   # groups the N provider batches of one "judge this book" run
  t.integer :sequence, null: false, default: 0  # 0-based position within the run (chunking, see §4.3)

  t.string  :state, null: false, default: 'pending', limit: 32
  t.string  :provider, null: false, limit: 64         # snapshot of judge_options[:llm_provider]
  t.string  :model, limit: 255                        # snapshot of judge_options[:llm_model]
  t.string  :completion_window, limit: 16, default: '24h'

  t.string  :remote_batch_id, limit: 255      # OpenAI "batch_abc123"
  t.string  :remote_input_file_id, limit: 255
  t.string  :remote_output_file_id, limit: 255
  t.string  :remote_error_file_id, limit: 255
  t.string  :remote_status, limit: 64         # raw provider status, unmapped

  t.integer :total_count, null: false, default: 0
  t.integer :succeeded_count, null: false, default: 0
  t.integer :failed_count, null: false, default: 0

  t.datetime :submitted_at
  t.datetime :last_polled_at
  t.datetime :completed_at
  t.integer  :poll_attempts, null: false, default: 0
  t.text     :error_message

  t.timestamps
end

add_index :judgement_batches, :remote_batch_id, name: 'index_judgement_batches_on_remote_batch_id'
add_index :judgement_batches, [ :state, :last_polled_at ], name: 'index_judgement_batches_on_state_and_last_polled_at'
add_index :judgement_batches, [ :run_uuid, :sequence ], unique: true, name: 'index_judgement_batches_on_run_uuid_and_sequence'
add_index :judgement_batches, :user_id, name: 'index_judgement_batches_on_user_id'
```

No FK on `user_id` — `judgements.user_id` has none either, and `users.id` is `:integer`
while everything new is `:bigint`; keep the association at the model layer.

**States** (our own, distinct from `remote_status`):

```
pending → building → submitted → polling → downloading → ingested
                         ↘ failed        ↘ expired      ↘ cancelled
```

- `pending` — row created with its items and input file, **nothing sent yet**. A durable
  waiting state, not a transient one: chunks beyond `llm_batch_max_in_flight` sit here until a
  sibling finishes (§4.3.1).
- `building` — JSONL being assembled + uploaded.
- `submitted` — `POST /v1/batches` accepted, we have `remote_batch_id`.
- `polling` — provider reports `validating`/`in_progress`/`finalizing`.
- `downloading` — provider reported `completed`; we are pulling output/error files.
- `ingested` — terminal success. Judgements written.
- `failed` / `expired` / `cancelled` — terminal. `error_message` explains.

Use a plain string column with constants + scopes, not a state-machine gem (none in the
Gemfile, don't add one).

### 3.2 `judgement_batch_items` — one row per request line

```ruby
create_table :judgement_batch_items do |t|
  t.references :judgement_batch, null: false, foreign_key: true,
               index: { name: 'index_judgement_batch_items_on_judgement_batch_id' }
  t.references :query_doc_pair, null: false, foreign_key: true,
               index: { name: 'index_judgement_batch_items_on_query_doc_pair_id' }
  t.references :judgement, foreign_key: true,            # nil until ingested
               index: { name: 'index_judgement_batch_items_on_judgement_id' }

  t.string  :custom_id, null: false, limit: 64   # what we put in the JSONL line
  t.string  :state, null: false, default: 'queued', limit: 32  # queued|succeeded|failed|unrateable
  t.float   :rating
  t.text    :explanation
  t.text    :error_message
  t.integer :prompt_tokens
  t.integer :completion_tokens

  t.timestamps
end

add_index :judgement_batch_items, [ :judgement_batch_id, :custom_id ], unique: true,
          name: 'index_judgement_batch_items_on_batch_id_and_custom_id'
add_index :judgement_batch_items, [ :judgement_batch_id, :state ],
          name: 'index_judgement_batch_items_on_batch_id_and_state'
```

`custom_id` is `"qdp-<query_doc_pair_id>"` — deterministic, ≤64 chars (OpenAI's limit), and
directly resolvable on the way back without a lookup table. The unique index makes ingest
idempotent.

### 3.3 Attachments

On `JudgementBatch`:

```ruby
has_one_attached :input_file    # the JSONL we uploaded
has_one_attached :output_file   # raw JSONL from output_file_id
has_one_attached :error_file    # raw JSONL from error_file_id
```

Keeping the raw files means a bad ingest can be replayed without re-hitting the API, and
gives us the exact prompt that produced a disputed rating. They go in the `db` Active Storage
service like `Book#export_file`, so **they are rows in `active_storage_blobs`** — a 50k-line
JSONL is tens of MB. Add a purge path (§7).

## 4. Code

### 4.1 Extract the shared prompt/parse logic

> **Superseded by `docs/todo/llm_judge_shared_foundation.md` if that lands first.** The same
> extraction is needed by `docs/todo/jev_llm_judge.md`, which adds a provider whose request and
> response shapes are not chat-completions at all. The shared version replaces the
> builder/parser pair with one adapter returning a **path + body envelope** the batch writer
> serialises directly into a JSONL line, which makes the byte-identical-request property below
> structural rather than test-enforced. If the foundation PR is skipped, build it as described
> here.

`LlmService` currently owns both "how do we ask" and "how do we transport". Batch mode needs
the first without the second. Pull out:

- `app/services/judgement_prompt_builder.rb` — `.user_prompt(query_doc_pair)` (the current
  `make_user_prompt` body verbatim) and `.chat_body(query_doc_pair, system_prompt, options)`
  returning the `{model:, temperature:, response_format:, messages:}` hash that
  `get_openai_response` builds today.
- `app/services/judgement_response_parser.rb` — `.parse(content_string)` → `{explanation:, judgment:}`,
  plus the `strip_markdown_code_block` helper.

Then rewrite `LlmService#make_user_prompt` / `#get_openai_response` / `#parse_response` to
delegate. **This must be behaviour-preserving** — `test/services/llm_service_test.rb` is the
guard, do not change its expectations. The point is that a batch-judged pair and a
sync-judged pair get a byte-identical request body.

### 4.2 `app/services/llm_batch_service.rb`

A thin Faraday wrapper over the four Batch endpoints. Constructed like `LlmService`
(`LlmBatchService.new(judge.llm_key, judge.judge_options)`), reusing its
`compute_auth_headers` / retry-on-429 connection setup — worth extracting that into an
`LlmConnection` concern or just a small module shared by both.

```ruby
upload_input(io, filename)   # POST /v1/files  (multipart, purpose: 'batch') -> file_id
create_batch(input_file_id:, metadata:, completion_window:)
                             # POST /v1/batches -> {id:, status:, ...}
fetch_batch(remote_batch_id) # GET  /v1/batches/:id
download_file(file_id)       # GET  /v1/files/:id/content -> raw JSONL string/IO
cancel_batch(remote_batch_id)# POST /v1/batches/:id/cancel
```

Notes:
- Multipart upload needs `faraday-multipart`. It is in `Gemfile.lock` transitively only —
  **add it to the `Gemfile` explicitly** and require `faraday/multipart`.
- The batch response body is JSON, not the JSON-in-a-string that chat completions returns, so
  the shared `parse_response` does not apply here.
- `provider_supports_batch?` guard: only `openai` in this pass. `azure_openai` has a
  batch API with a different path shape (`/openai/batches?api-version=`) and requires a
  Global-Batch deployment; `anthropic` has Message Batches with an entirely different
  request/response shape. Structure `LlmBatchService` so those become subclasses later, but
  raise `LlmBatchService::UnsupportedProviderError` for anything that isn't `openai` now.

### 4.3 JSONL builder — `app/services/judgement_batch_builder.rb`

Given a book, a judge, and a set of query/doc pairs, stream one line per pair:

```json
{"custom_id":"qdp-12345","method":"POST","url":"/v1/chat/completions",
 "body":{"model":"gpt-4o","temperature":0.7,"response_format":{"type":"json_object"},
         "messages":[{"role":"system","content":"…"},{"role":"user","content":[…]}]}}
```

`body` comes straight from `JudgementPromptBuilder.chat_body`. Build with
`Tempfile` + `find_each(batch_size: 500)`, never `map` over the whole book into memory —
`query_doc_pairs.document_fields` is a `mediumtext` column and a big book will not fit.

**Chunking — N batches, always.** OpenAI caps a batch at 50,000 requests and 200 MB of input
file. A book larger than that is not an error to refuse; it is the normal case. One "judge this
book" run produces however many provider batches the work needs — one, two, or forty — and the
`run_uuid` + `sequence` columns (§3.1) are what stitch them back into a single logical run.

```ruby
MAX_REQUESTS_PER_BATCH = 50_000
MAX_FILE_BYTES         = 180.megabytes   # headroom under the 200MB limit
```

Roll to a new chunk when either limit is hit, streaming the relation with
`find_each(batch_size: 500)` and writing to a `Tempfile` per chunk — the builder never holds
more than one chunk's worth of `document_fields` in memory, so a 2M-pair book costs the same
RSS as a 500-pair one.

Also cap per-line size: a query/doc pair whose `document_fields` serialises to something absurd
should be marked `failed` on its item ("payload too large") rather than poisoning the file and
taking a whole 50k-request chunk down with it.

#### 4.3.1 Bounding *concurrent* batches, not total requests

Chunking removes any reason to cap total work, but it introduces a different question: do we
fire all forty chunks at OpenAI at once?

Probably not, for three reasons:

- **Enqueued-token limits.** Batch queues are metered per-org on enqueued tokens, not just
  requests. Dumping forty batches at once can get later ones rejected outright at
  `create_batch` time, which turns a clean run into a partially-submitted mess.
- **Blast radius.** Forty in-flight batches built from a bad `system_prompt` is forty batches
  of spend to discover the mistake. Two in flight means the damage is bounded and the operator
  sees results from chunk 0 before chunk 39 is even submitted.
- **Selection hostage-taking.** Every queued item suppresses its pair from `SelectionStrategy`
  (§5). Submitting everything at once makes the entire book unjudgeable by that judge for 24h;
  submitting in waves keeps most of it available.

So add `judge_options[:llm_batch_max_in_flight]` (default 2–4). It throttles *concurrency*,
never total volume:

```ruby
MAX_IN_FLIGHT = judge.judge_options.fetch(:llm_batch_max_in_flight, 3)
```

Chunks beyond the limit are persisted as `JudgementBatch` rows in `pending` with their items
and input file already built, but not submitted. When a batch reaches a terminal state,
`IngestJudgementBatchJob` (or the sweeper) submits the next `pending` chunk of the same
`run_uuid` by `sequence`. The run drains itself.

This means `pending` is a real, durable state — a chunk waiting its turn — not just a
momentary value before `building`. Worth saying out loud because the sweeper needs to know
that a `pending` batch older than N hours with no open siblings is a stalled run to kick, not
garbage to expire.

### 4.4 Jobs

**`SubmitJudgementBatchJob(book, judge, number_of_pairs = nil)`** — `queue_as :bulk_processing`.

```ruby
limits_concurrency to: 1,
                   key: ->(book, judge, _n) { "judgement_batch_#{book.id}_#{judge.id}" },
                   duration: 30.minutes,
                   on_conflict: :discard
```

1. Guard: `judge.ai_judge?`, provider supports batch, and **no open batch from a *different*
   `run_uuid`** for this book+judge — discard with a log line if there is. Note the shape of
   that check: a single run legitimately has many open batches at once (§4.3), so the guard is
   "another run is already going", not "any batch is open". Getting this wrong either blocks
   chunking entirely or lets two runs overlap and double-submit.
2. Select pairs: same predicate as `SelectionStrategy` — pairs this judge hasn't judged and
   with `< 3` judgements — but returning a *relation*, not one random row (§5).
3. `run_uuid = SecureRandom.uuid`. Stream the relation through `JudgementBatchBuilder`; for
   each chunk create the `JudgementBatch` (`pending`) and its `JudgementBatchItem` rows via
   `insert_all` in slices of 1000, and attach the JSONL. **No API call yet** — this pass is
   pure local persistence, so a 40-chunk run is fully recorded before a single dollar is spent.
4. Submit the first `MAX_IN_FLIGHT` chunks by `sequence`: `building` → `upload_input` →
   `create_batch` → store ids → `submitted`. The rest stay `pending` and are submitted later by
   `SubmitNextJudgementBatchChunkJob`, triggered when a sibling goes terminal.
5. Enqueue `PollJudgementBatchJob.set(wait: 5.minutes).perform_later(batch)` for each submitted
   chunk.

Wrap each chunk in its own transaction, so a failure on chunk 7 does not roll back the six
batches already sitting at OpenAI. A chunk that fails after `create_batch` but before commit
is the one genuinely nasty case: log `remote_batch_id` loudly so it can be reconciled by hand.

**Run-level rollup.** With N batches per run, "is this book done?" is a question about the
`run_uuid`, not about any one row: `JudgementBatch.where(run_uuid:)` all terminal, with counts
summed across them. Add `JudgementBatch.run(uuid)` scope plus `#run_siblings`, and have the
rake `status` task report per-run rather than per-batch — otherwise an operator watching a
40-chunk run sees forty unrelated-looking rows.

**`PollJudgementBatchJob(batch)`** — `queue_as :default`.

- `fetch_batch`, write `remote_status`, `request_counts` into `succeeded_count`/`failed_count`,
  bump `poll_attempts`, set `last_polled_at`.
- `validating|in_progress|finalizing` → state `polling`, re-enqueue with capped exponential
  backoff (5m → 10m → 20m → … capped at 1h), give up past ~26h → `expired`.
- `completed` → `downloading`, enqueue `IngestJudgementBatchJob`.
- `failed|expired|cancelled` → mirror to our terminal state, copy the provider's error into
  `error_message`.

**`PollPendingJudgementBatchesJob`** — recurring sweeper, added to `config/recurring.yml`
(dev + production) at `every 10 minutes`. Picks up any batch in `submitted`/`polling` whose
`last_polled_at` is older than 15 minutes and re-enqueues `PollJudgementBatchJob`. This is
the self-healing net: if a scheduled poll job is lost (deploy, queue wipe, crash), the batch
still gets collected. Without it a dropped poll job strands the batch forever.

**`IngestJudgementBatchJob(batch)`** — `queue_as :bulk_processing`.

1. Download `output_file_id` → attach as `output_file`; same for `error_file_id` if present.
2. Stream the output JSONL line by line. Each line:
   ```json
   {"id":"batch_req_…","custom_id":"qdp-12345",
    "response":{"status_code":200,"request_id":"…","body":{ …chat completion… }},
    "error":null}
   ```
3. Per line, in its own transaction:
   - Find the item by `(judgement_batch_id, custom_id)`. Unknown `custom_id` → log, skip.
   - Skip if the item is already terminal (idempotent replay).
   - `status_code == 200` → `JudgementResponseParser.parse(body.dig('choices',0,'message','content'))`.
     `Judgement.find_or_create_by!(query_doc_pair_id:, user: judge)`, set `rating` /
     `explanation`, `mark_unrateable` when the rating is blank (same rule as
     `RunJudgeJudyJob:36`), save, link `judgement_id` onto the item, item → `succeeded`
     (or `unrateable`). Record `usage.prompt_tokens` / `completion_tokens`.
   - Non-200 or `error` present, or a parse failure → item `failed` with `error_message`, and
     write a `Judgement` with `unrateable: true` and `explanation: "BOOM: …"` — matching what
     `LlmService#perform_safe_judgement` does today, so a failed batch pair looks the same in
     the data as a failed sync pair.
4. Also walk the error file, if any, for lines that never made it into the output file.
5. Any item still `queued` after both files → `failed`, "no response returned".
6. `batch.update!(state: 'ingested', completed_at: Time.zone.now)`, recompute counts, then
   enqueue `SubmitNextJudgementBatchChunkJob(run_uuid)` to release the next `pending` chunk
   (§4.3.1).
7. `UpdateCaseJob.perform_later(book)` — same tail as `RunJudgeJudyJob:45` — but only once the
   **whole run** is terminal, not per chunk. Forty chunks should not enqueue forty case
   updates; check `JudgementBatch.run(run_uuid).where.not(state: TERMINAL_STATES).empty?` first.

**`SubmitNextJudgementBatchChunkJob(run_uuid)`** — `queue_as :bulk_processing`. Takes the
lowest-`sequence` `pending` batch of the run and submits it, provided the run's in-flight count
is under `llm_batch_max_in_flight`. Idempotent and safe to call spuriously — it is also what
the sweeper calls when it finds a run with `pending` chunks and no open ones (a stalled run).

**`CancelJudgementBatchJob(batch, cancel_run: false)`** — calls `cancel_batch`, sets state.
Needed because a 24h window with a wrong prompt is expensive to just wait out. With
`cancel_run: true` it cancels every open batch of the `run_uuid` and marks the remaining
`pending` chunks `cancelled` without ever submitting them — which is the actually useful
operation when someone realises mid-run that the prompt was wrong, and the reason a run-level
handle matters more than a per-batch one.

### 4.5 Models

- `app/models/judgement_batch.rb` — `belongs_to :book`, `belongs_to :user` (the judge),
  `has_many :judgement_batch_items, dependent: :delete_all`, the three attachments, state
  constants, `scope :open`, `scope :terminal`, `#judge` alias, `#progress` (`succeeded+failed / total`).
- `app/models/judgement_batch_item.rb` — `belongs_to :judgement_batch`, `:query_doc_pair`,
  `belongs_to :judgement, optional: true`.
- `Book` — `has_many :judgement_batches, dependent: :destroy`.
- `User` — `has_many :judgement_batches, dependent: :destroy`, plus a
  `#supports_batch_judging?` predicate (Quepid predicate style: no `has_` prefix).
- `QueryDocPair` — `has_many :judgement_batch_items, dependent: :delete_all`. Note the
  existing `has_many :query_doc_pairs, dependent: :delete_all` on `Book` means deleting a book
  bypasses callbacks; the FK from `judgement_batch_items` will block it unless we add
  `dependent: :delete_all` there and order the deletes. Verify with a test that destroys a book
  that has an open batch.

## 5. Selection: keeping in-flight pairs out of a second batch

This is the subtle part. `SelectionStrategy.random_query_doc_pair_for_multiple_judges`
excludes pairs where the judge already has a `Judgement`. In batch mode there is a 24-hour
gap where a pair is *submitted but unjudged* — so a second run (or the sync Judge Judy button)
would happily pick it again and we'd pay twice and race on the unique index.

Add to `SelectionStrategy`:

```ruby
# Pairs this user can still judge, as a relation. The batch path needs the whole set;
# the interactive path keeps taking .first off a weighted random ordering.
def self.judgeable_query_doc_pairs book, user
  book.query_doc_pairs
    .left_joins(:judgements)
    .group('query_doc_pairs.id')
    .having('COUNT(CASE WHEN judgements.user_id = ? THEN 1 END) = 0', user.id)
    .having('COUNT(judgements.id) < 3')
    .where.not(id: JudgementBatchItem.in_flight_for(book, user).select(:query_doc_pair_id))
end
```

with

```ruby
# JudgementBatchItem
scope :in_flight_for, ->(book, user) {
  joins(:judgement_batch)
    .where(state: 'queued')
    .where(judgement_batches: { book_id: book.id, user_id: user.id, state: JudgementBatch::OPEN_STATES })
}
```

Then `random_query_doc_pair_for_multiple_judges` becomes
`judgeable_query_doc_pairs(book, user).order(…weighted…).first`, preserving today's exact
ordering semantics. `test/` already covers the weighting — that suite must stay green
unchanged.

The `NOT IN (subquery)` costs something on the interactive path, but it is bounded by the
`(judgement_batch_id, state)` index and only non-empty while a batch is open. If it measures
badly, the fallback is to skip the exclusion when the book has no open batch
(`JudgementBatch.open.exists?(book:, user:)`), which is one cheap indexed lookup.

## 6. Controller / entry points

Minimum viable, no UI:

- `BooksController#run_judge_judy` (`app/controllers/books_controller.rb:302`) gains a
  `batch_mode` param: when true (and the provider supports it) enqueue
  `SubmitJudgementBatchJob` instead of `RunJudgeJudyJob`. Same redirect, different notice.
  The existing form keeps working untouched because the param defaults to false.
- A rake task for operators, `lib/tasks/judgements.rake`:
  - `judgements:batch:submit[book_id,judge_id]`
  - `judgements:batch:poll[batch_id]` (force a poll now)
  - `judgements:batch:status[book_id]` (print open **runs**, rolled up across their chunks, with
    per-run counts and how many chunks are still `pending`)
  - `judgements:batch:cancel[batch_id]` / `judgements:batch:cancel_run[run_uuid]`
  - `judgements:batch:reingest[batch_id]` (re-run ingest off the stored `output_file`)

That's enough to drive the whole feature from the console while the UI is built later.

## 7. Operational concerns

- **Secrets.** `llm_key` is `encrypts`-ed on `User`; it is read the same way `LlmService` reads
  it. Never write it into the JSONL, the batch `metadata`, or `error_message`. The metadata we
  do send: `{quepid_book_id:, quepid_judge_id:, quepid_run_uuid:, quepid_batch_id:}` — ids
  only, so a batch found in the OpenAI dashboard can be traced back.
- **Data leaving the box.** A batch file ships every selected pair's `document_fields` to
  OpenAI in one shot, and the uploaded file persists on their side until deleted. Delete the
  input file (`DELETE /v1/files/:id`) after ingest; keep our Active Storage copy.
- **Blob growth.** Add `judgements:batch:purge_files[days]` to `purge` attachments on batches
  ingested more than N days ago, and mention it in the deploy docs. With the `db` service these
  blobs sit in the app database.
- **No request cap — chunk instead.** A book bigger than one batch is not an error condition,
  it is the normal case; the answer is N batches, never a refusal and never a silent truncation.
  See §4.3. What *is* worth bounding is how many of those N are in flight at once (§4.3.1),
  because that is the knob that actually controls spend-in-progress and blast radius.
- **Rate limits.** `/v1/files` and `/v1/batches` are cheap, but the 429 retry middleware in
  `LlmService#build_connection` should be shared into the batch connection too.
- **Token accounting.** Storing `prompt_tokens`/`completion_tokens` per item gives us a real
  cost report later with no extra API calls.

## 8. Tests (Minitest, `bin/docker r rails test`)

Fixtures: `test/fixtures/judgement_batches.yml`, `test/fixtures/judgement_batch_items.yml`.
Canned provider payloads under `test/fixtures/files/openai_batch/` — `batch_created.json`,
`batch_in_progress.json`, `batch_completed.json`, `output.jsonl`, `errors.jsonl`.

- `test/models/judgement_batch_test.rb` — state transitions, `open` scope, progress, destroy cascade.
- `test/models/judgement_batch_item_test.rb` — `in_flight_for` scope.
- `test/services/judgement_prompt_builder_test.rb` — **asserts the built body is identical to
  what `LlmService` sends today**, including the image block. This is the regression guard for §4.1.
- `test/services/llm_batch_service_test.rb` — webmock each of the five endpoints; unsupported-provider raise.
- `test/services/judgement_batch_builder_test.rb` — line format, `custom_id` shape, chunk roll at
  the request-count boundary and at the byte boundary, oversized-pair handling. Explicitly:
  a pair count above `MAX_REQUESTS_PER_BATCH` produces N chunks and **never raises or truncates**;
  every input pair appears in exactly one chunk (assert the union equals the input set).
- `test/jobs/submit_judgement_batch_job_test.rb` — creates rows, marks items queued; submits
  only `llm_batch_max_in_flight` chunks and leaves the rest `pending`; a run larger than one
  batch succeeds end-to-end; the open-run guard blocks a *second run* but not the sibling
  chunks of the current one (the regression this guard is easy to get backwards on).
- `test/jobs/submit_next_judgement_batch_chunk_job_test.rb` — releases the lowest-`sequence`
  `pending` chunk, respects the in-flight ceiling, is a no-op when nothing is pending, and is
  safe to run twice.
- `test/jobs/poll_judgement_batch_job_test.rb` — each provider status → correct state + reschedule.
- `test/jobs/ingest_judgement_batch_job_test.rb` — enqueues `UpdateCaseJob` only when the last
  chunk of a run lands, not once per chunk; happy path writes `Judgement`s;
  **running it twice changes nothing** (idempotency); a non-200 line produces an unrateable
  judgement with a `BOOM:` explanation; a missing line lands as `failed`; `UpdateCaseJob` enqueued.
- `test/models/selection_strategy_test.rb` — extend: a pair with a queued item in an open batch
  is not selected; once the batch is terminal it is selectable again. Existing weighting tests
  unchanged.
- `test/integration/judge_judy_flow_test.rb` — add a batch-mode sibling covering submit → poll → ingest.

## 9. Suggested PR sequence

1. **Refactor only.** Extract `JudgementPromptBuilder` + `JudgementResponseParser`, rewire
   `LlmService`, add the equivalence test. No behaviour change, no schema.
   **Prefer the shared version** (`docs/todo/llm_judge_shared_foundation.md` step A), which does
   this plus the scale/finalizer/connection/provider-registry extractions that steps 3–4 below
   and the Jev plan both otherwise duplicate.
2. **Schema + models.** Both migrations, both models, associations, fixtures, model tests.
3. **Services.** `LlmBatchService` + `JudgementBatchBuilder` with webmock tests. Add
   `faraday-multipart` to the `Gemfile`.
4. **Jobs.** Submit / Poll / Ingest / Cancel + the recurring sweeper entry.
5. **Selection.** `judgeable_query_doc_pairs` + the in-flight exclusion.
6. **Entry points.** `batch_mode` param on `run_judge_judy`, rake tasks, purge task, docs.

Steps 1–3 are independently mergeable and low-risk. Step 5 is the one that touches an existing
hot query — keep it its own PR so it can be reverted alone.

## 10. Open questions

- **Azure.** Most Quepid batch users are likely on `azure_openai`. Azure's batch API needs a
  Global-Batch deployment and a different URL shape. Worth confirming whether OpenAI-only is
  genuinely enough for the first cut, or whether Azure should land in the same pass.
- **Implicit judgements.** `Book#support_implicit_judgements` makes the sync path round
  ratings (`books_controller.rb:282`). The batch path writes `Judgement` directly — should it
  round too? Assume yes, mirror the sync behaviour.
- **In-flight default.** Is 3 concurrent batches the right starting point? It is a guess. The
  right number depends on the org's batch queue limits, which we can't see from here — worth
  starting conservative (2) and raising once there's a real run to measure.
- **Multiple judges.** Nothing stops two AI judges batching the same book concurrently; the
  scoping is by `(book, user)` throughout and the unique index on `judgements` protects the
  tail. Worth an explicit test.
- **Kraken mode broadcasts.** `RunJudgeJudyJob` pushes Turbo stream updates per pair. Batch mode
  has nothing to push for hours. Left out of scope here; when the UI lands it will want a
  progress broadcast from `PollJudgementBatchJob` instead.
