# LLM judge — shared foundation for the Jev and OpenAI-Batch plans

> **Decision record:** `docs/adr/0001-llm-judge-provider-architecture.md` — why this seam exists, what it rules out, and the step order. This file is the implementation detail.

**Why this file exists:** `docs/todo/llm_judge_openai_batch.md` (§4.1, §9 PR 1) and
`docs/todo/jev_llm_judge.md` (§3 D1) each begin by pulling apart the same class,
`app/services/llm_service.rb`, for the same reason — it welds *how we ask*, *how we transport*
and *what the answer means* into one object — but they cut it along different lines. Doing
either refactor first makes the other one a second refactor of the same code.

This is the seam both need, done once. It is a **behaviour-preserving** pass: no schema, no new
provider, no batch tables. Land it, then Jev and Batch both become additive.

## 1. What actually overlaps

| Concern | Batch plan wants | Jev plan wants | Shared answer |
| --- | --- | --- | --- |
| Build a request without sending it | `JudgementPromptBuilder.chat_body` so a line can go in a JSONL | a *different* body shape (`/v1/systemone`) | one adapter method returning **path + body**, §3.1 |
| Interpret a provider answer | `JudgementResponseParser.parse` | typed answer → rating + synthesised explanation | one adapter method that *applies* to a `Judgement`, §3.1 |
| The book's scale | ingest re-implements `RunJudgeJudyJob:36`'s guard | scale **is** the request (`criteria`) | `JudgeScale` value object, §3.2 |
| "Is this judgement usable?" | ingest duplicates blank/out-of-scale/`BOOM:` rules | adds a confidence gate | `JudgementFinalizer`, §3.3 |
| Faraday conn, auth, 429 retry | "worth extracting into an `LlmConnection` concern" (§4.2) | same, plus retry on `529` | `LlmConnection`, §3.4 |
| Which providers can do what | `provider_supports_batch?` guard | new provider + preset + defaults + "no images" | `LlmProviders` registry, §3.5 |

Only §3.1 is a genuinely new abstraction. The other four are duplication that already exists or
is about to be created twice.

## 2. What we deliberately do **not** unify

- **Jev is never batch-processed.** There is no TypeSafe batch endpoint and there is no plan for
  one: `judgement_batches` stays an OpenAI-shaped feature. `LlmProviders['typesafe_jev'].batch?`
  is permanently false, and that flag — not a comment — is what keeps a Jev judge out of
  `SubmitJudgementBatchJob` and `LlmBatchService`. A provider being batchable is a property of
  its API, so the flag lives with the provider, never in the batch code's own list.
- **No generalised "criteria" concept in the chat adapters.** Scale-as-criteria is a Jev property.
  The chat adapters keep describing the scale in prose (`augment_system_prompt_for_scale`), they
  just source it from `JudgeScale` instead of re-deriving it.
- **No state machine, no new gems.** Same rule the batch plan sets.
- **`SelectionStrategy`** (batch §5) is batch-only — a sync Jev run has no in-flight window.
- **`support_implicit_judgements` rounding** is in the *merge books* path
  (`books_controller.rb:282`), not the judging path. It is not a shared judging concern; the
  batch plan's §10 open question should be re-read with that in mind.

## 3. The seam

### 3.1 `LlmJudgeAdapter` — one dialect per class

`app/services/llm_judge_adapters/{base,open_ai,anthropic,jev}.rb`. Two public methods:

```ruby
# => { path: 'v1/chat/completions', body: {...}, headers: {...} }
def request_envelope query_doc_pair, system_prompt:, book:

# mutates the judgement: rating, explanation (never saves)
def apply_response judgement, response_body, book:
```

- **Sync path** (`LlmService`) posts the envelope and calls `apply_response`.
- **Batch path** writes `{custom_id:, method: 'POST', url: "/#{path}", body:}` JSONL lines from
  the *same* envelope, and calls the *same* `apply_response` on each output line. That is what
  makes "a batch-judged pair and a sync-judged pair get a byte-identical request body"
  (batch §4.1) true by construction instead of by a regression test.
- **Jev** is a third adapter and needs no new machinery: its envelope is
  `{ path: 'v1/systemone', body: { model:, state:, questions: } }`, its `apply_response` snaps
  the score to the scale (Jev plan D5) and synthesises the explanation (D6).

`LlmService` keeps its public surface exactly — `new(llm_key, judge_options)`,
`perform_judgement`, `perform_safe_judgement`, `make_user_prompt` — and becomes: pick adapter,
post, apply, rescue. `app/jobs/run_judge_judy_job.rb:19` and
`app/controllers/ai_judges/prompts_controller.rb:40` do not change.

The batch plan's `JudgementPromptBuilder` / `JudgementResponseParser` split disappears into this;
its equivalence test (§8) survives as the guard, retargeted at `LlmJudgeAdapters::OpenAi`.

### 3.2 `JudgeScale` — the book's scale as an object

`app/models/judge_scale.rb` (PORO), built from a `Book`:

```ruby
scale.values          # => [0.0, 1.0, 2.0, 3.0]  numerically sorted
scale.labels          # sanitised, length-capped (today's MAX_SCALE_LABEL_LENGTH rule)
scale.describe        # "0 (labeled \"Poor\"), 1 (labeled \"Fair\"), …"  <- prose adapters
scale.criteria        # ["Poor …", "Fair …", …]                          <- Jev score levels
scale.includes? 2.0
scale.nearest 1.43    # => 1.0   (index-rounded, clamped)
scale.size            # 2..10 gate for Jev's score primitive
```

Call sites collapsed onto it: `LlmService#augment_system_prompt_for_scale` /
`#sanitize_scale_label`, `RunJudgeJudyJob:36`'s membership check, the Jev criteria builder, and
the batch ingest guard. One definition of "is this rating legal for this book".

### 3.3 `JudgementFinalizer` — the rules, in one place

`app/services/judgement_finalizer.rb`, `.call(judgement, book:, source:)`:

1. blank/non-numeric rating → `mark_unrateable`
2. rating outside `JudgeScale` → annotate the explanation with the raw value, `mark_unrateable`
   (verbatim today's wording in `RunJudgeJudyJob:36-42`)
3. adapter-supplied gate (Jev's `jev_min_confidence`, D7) → `mark_unrateable`, explanation kept

Today only `RunJudgeJudyJob` applies rules 1–2; the prompt-preview page
(`ai_judges/prompts_controller.rb`) applies none, so the preview will happily show a rating the
real run would reject. Routing all three call sites (job, preview, batch ingest) through the
finalizer fixes that inconsistency as a side effect — worth a line in the PR description
because it is a visible behaviour change on the preview page.

### 3.4 `LlmConnection` — Faraday setup once

`app/services/llm_connection.rb`: `build(url:, auth_headers:, timeout:)` with the JSON
middleware and the retry block currently in `LlmService#build_connection`, plus `529` added to
`retry_statuses` (TypeSafe's "service overloaded"; harmless for the others). Used by
`LlmService`, `JevService`'s successor (the Jev adapter), and the batch plan's `LlmBatchService`.

### 3.5 `LlmProviders` — one registry instead of four lists

Provider knowledge is currently smeared across `LlmService::AZURE_PROVIDERS` /
`ANTHROPIC_PROVIDERS` / `compute_completions_path` / `compute_auth_headers`, the `<select>` in
`app/views/ai_judges/_form.html.erb:54`, and the `PROVIDER_PRESETS` JS object in the same file
(`:215`). Adding Jev means touching all of them; adding a batch capability flag means touching
them again.

`app/models/llm_provider.rb` + `app/models/llm_providers.rb` — a frozen registry keyed by
provider string, each entry carrying: `label`, `adapter`, `auth_style`, `default_service_url`,
`default_model`, `default_api_version`, `default_system_prompt`, `images?`, `batch?`, `help_html`.

Then:

- the `<select>` renders from `LlmProviders.all.map { [_1.label, _1.key] }`
- the JS presets become `<%= raw LlmProviders.presets_json %>` — the JS keeps its current
  behaviour (fill URL/model/api-version on change, show help), it just stops being a hand-kept
  copy of the Ruby list
- batch's guard is `LlmProviders[provider].batch?` (only `openai` true in the first cut)
- Jev's whole UI change (Jev plan §4 items 3–4) becomes **one registry entry**

## 4. PR sequence, both features

```
A. Shared foundation (this file)    ── behaviour-preserving, no schema
   A1 LlmProviders registry + form/JS render from it
   A2 JudgeScale + JudgementFinalizer (job, preview, wired)
   A3 LlmConnection
   A4 LlmJudgeAdapter{Base,OpenAi,Anthropic} + LlmService rewired
        ↓                                   ↓
B. Jev  (jev_llm_judge.md)          C. Batch (llm_judge_openai_batch.md)
   B1 Jev adapter + registry entry     C1 schema + models
   B2 manual-test 12.6                 C2 LlmBatchService + builder (envelope from A4)
                                       C3 jobs + sweeper
                                       C4 selection strategy
                                       C5 entry points + rake
```

A is one PR per extraction (ADR 0001 §5.2 splits it A1–A6, each separately deployable). B
collapses from the 5 files in its §4 to **two**: the adapter and the registry entry. C drops its
§4.1 entirely and its §9 PR 1 is already done.

**C is deferred** — ADR 0001 D6. Phases A and B ship no batch code, no batch tables and no batch
gems; what keeps C cheap later is the batch-readiness contract (ADR §3), which phase A tests
today without building any of C.

A must land before either. After that B and C are independent — nothing in Jev touches the
batch tables and nothing in batch touches the Jev adapter.

## 5. Tests for the foundation

- `test/services/llm_judge_adapters/open_ai_test.rb` — the equivalence guard the batch plan
  specifies: the envelope body is byte-identical to what `LlmService` builds today, image block
  included. Same for the Anthropic adapter against its current test expectations.
- `test/models/judge_scale_test.rb` — sorting, non-zero-based scales, `nearest` rounding/clamping,
  label sanitising, `describe` string identical to today's `augment_system_prompt_for_scale` output.
- `test/services/judgement_finalizer_test.rb` — the three rules, with the out-of-scale message
  asserted verbatim against the current `RunJudgeJudyJob` wording.
- `test/models/llm_providers_test.rb` — every registry entry resolves an adapter; the JSON the
  view renders matches the registry; `batch?` is true only for `openai` and false for
  `typesafe_jev`. Once the batch feature exists, one more: a Jev judge handed to
  `SubmitJudgementBatchJob` is rejected up front — never silently chat-formatted into a JSONL.
- **Unchanged and must stay green:** `test/services/llm_service_test.rb` (400+ lines) and the
  existing `RunJudgeJudyJob` tests. If either needs editing, the refactor is not
  behaviour-preserving.

## 6. Strategic note on sequencing B vs C

The batch project's motivation (§1: 20k sequential requests, hours per book, retail pricing) is
partly answered by Jev on its own — cheaper per token by orders of magnitude, far lower latency,
1,200 req/min, and structurally unable to return an out-of-scale rating. If the team's books
judge acceptably on Jev, the remaining case for OpenAI Batch is "we need *this specific* frontier
model's judgement at half price", which is real but narrower. Note the shapes differ too: batch
trades a 24h window for half price, while Jev is *synchronous and fast* — at the 1,200 req/min
ceiling a 20k-pair book is ~17 minutes of wall clock if the loop is parallelised, versus up to a
day. Those are different products, not two speeds of the same one.

So: land **A**, land **B** (small), run a real book through Jev, *then* decide how much of **C**
is still worth building. A is not wasted either way — it is the seam C assumes anyway.
