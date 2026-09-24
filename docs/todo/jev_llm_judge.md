# TypeSafe **Jev** as an LLM judge — implementation plan

> **Decision record:** `docs/adr/0001-llm-judge-provider-architecture.md` — why this seam exists, what it rules out, and the step order. This file is the implementation detail.

**Scope:** a new `llm_provider` value (`typesafe_jev`) for AI Judges, its service adapter,
the AI Judge form preset, tests, and manual-test coverage. No database migrations. No change
to `RunJudgeJudyJob`, `Judgement`, or any scoring code.

> **Read `docs/todo/llm_judge_shared_foundation.md` first.** The extraction this plan needs
> (§3 D1) is the same one `docs/todo/llm_judge_openai_batch.md` §4.1 needs. Done once, up front,
> Jev collapses to **two files**: an `LlmJudgeAdapters::Jev` adapter and an `LlmProviders`
> registry entry. The per-file breakdown in §4 below describes the *standalone* shape, kept for
> the case where the foundation PR is skipped.
>
> **Landed (ADR §5.3 B0–B2):** `LlmJudgeAdapters::Jev` implements this plan's §3 decisions, and
> the registry entry is a real provider — the "coming soon" notice is gone, the endpoint and model
> it dictates stay read-only, and the help text explains that the book's scale becomes the
> criteria. What remains of this document is background: the API research and the reasoning
> behind the mapping choices.

## 1. Why, and why it doesn't fit the existing code path

Jev is TypeSafe's "System One" model: it does **not** generate text. You hand it a `state`
and a map of **typed questions** (`noul` = yes/no, `choice` = pick one, `score` = position on
an ordered 2–10 level scale) and it returns typed answers with a probability distribution and
a confidence value. Relevance judging is exactly a `score` question, and the model's answer is
structurally incapable of landing outside the scale we hand it — which is the precise failure
`RunJudgeJudyJob` currently has to defend against (`app/jobs/run_judge_judy_job.rb:36`).
It is also priced and rated for bulk work ($0.042/M input tokens, output free; 1,200 req/min).

API surface we have to speak:

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <key>
Content-Type: application/json

{
  "model": "jev-latest",
  "state": { ... },
  "questions": {
    "relevance": {
      "type": "score",
      "instructions": "How relevant is this document to the query?",
      "criteria": ["Irrelevant ...", "Somewhat ...", "Mostly ...", "Perfect ..."]
    }
  }
}
```

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "relevance": {
      "type": "score",
      "score": 1.43,
      "confidence": 0.35,
      "probabilities": { "0": 0.0, "1": 0.57, "2": 0.43 },
      "legend": { "0": "Irrelevant ...", "1": "Somewhat ...", "2": "Perfect ..." }
    }
  },
  "usage": { "input_tokens": 392, "output_tokens": 65 }
}
```

Every assumption baked into `LlmService` breaks here:

| `LlmService` assumes | Jev |
| --- | --- |
| a chat request with `system` + `user` messages | no messages, no system prompt — `instructions` live *per question* |
| the model returns a JSON string to `JSON.parse` | the response *is* typed JSON; nothing to parse out of a content blob |
| `{explanation:, judgment:}` | `{score:, confidence:, probabilities:, legend:}` — **no free text at all** |
| an integer rating on the book's scale | a continuous score over level *indexes* (`1.43`), not scale values |
| multimodal: `image_url` blocks (`llm_service.rb:80`) | **text only** — strings, JSON objects, arrays |
| scale lives only in the system prompt (`augment_system_prompt_for_scale`) | scale *is* the `criteria` array, capped at 10 levels |

So this is a new adapter, not another branch in `get_llm_response`.

## 2. What we reuse

| Piece | Location | Reuse |
| --- | --- | --- |
| AI judge = `User` with `llm_key` + `system_prompt` + `judge_options` | `app/models/user.rb` | as-is |
| Provider dispatch entry point (`LlmService.new(key, judge_options)` → `perform_safe_judgement`) | `app/jobs/run_judge_judy_job.rb:19`, `app/controllers/ai_judges/prompts_controller.rb:40` | as-is — **callers must not change** |
| Faraday conn + JSON middleware + 429 retry | `LlmService#build_connection` | copy, add `529` |
| Book scale + labels + guidelines | `Book#scale`, `#scale_with_labels`, `#scoring_guidelines` | source of `criteria` |
| Prompt preview page (renders `rating` + `explanation` only) | `app/views/ai_judges/prompts/_form.html.erb:47` | works unchanged |
| Provider preset JS | `app/views/ai_judges/_form.html.erb:215` | extend |
| `webmock` stubbing style | `test/services/llm_service_test.rb` | copy |

## 3. Design decisions

**D1 — Separate service, façade dispatch.** *(Superseded by the shared foundation, if that
lands: Jev becomes `LlmJudgeAdapters::Jev` implementing `request_envelope` / `apply_response`,
and the dispatch below is the registry's job. The design decisions D2–D9 are unaffected.)*
New `app/services/jev_service.rb` owning its own
Faraday connection, request building and response mapping. `LlmService#perform_judgement` gains
one early branch:

```ruby
JEV_PROVIDERS = %w[typesafe_jev].freeze

def perform_judgement judgement, book: nil
  return JevService.new(@llm_key, @options).perform_judgement(judgement, book: book) if jev_provider?
  ...
end
```

`perform_safe_judgement`'s rescue of `RuntimeError`/`Faraday::Error` then covers Jev too, so both
callers keep working with zero changes. Rejected: a fourth `if` cascade through
`compute_completions_path` / `compute_auth_headers` / `parse_response` — those three all assume the
chat-completions shape and would each need a special case for no gain.

**D2 — `state` is a JSON object, not the YAML blob.** TypeSafe recommends objects over serialized
strings:

```ruby
{ query: qdp.query_text, information_need: qdp.information_need.presence, document: qdp.document_fields }.compact
```

`document_fields['image']` is passed through as a plain URL field and is *not* fetched — Jev is
text-only. This must be stated in the provider help text, because today an image-bearing judge
silently gets multimodal behaviour and on Jev would silently lose it.

**D3 — Context guard.** Jev's limit is 64k tokens total, 32k for `state` + the longest question.
Cap each `document_fields` value at `JevService::MAX_FIELD_CHARS` (4_000) and the serialized state
at `MAX_STATE_CHARS` (80_000), truncating with a visible ` …[truncated]` marker rather than letting
the API 422.

**D4 — Book scale → `criteria`.** Sort the scale numerically ascending (`book.scale.sort_by(&:to_f)`);
level index `i` ↔ `sorted_scale[i]`. Each criterion's text comes from `book.scale_with_labels[value]`,
falling back to `"Rating #{value} on this book's scale"` when unlabeled (reusing
`LlmService::MAX_SCALE_LABEL_LENGTH` sanitising, which exists for the same prompt-injection reason).

- 2–10 scale values → **`score`** question (ordinal, which is what graded relevance is).
- more than 10 values → **`choice`** question instead (criteria *map* keyed by the scale value,
  up to 255 options); the answer's `choice` key *is* the rating, no rounding needed.
- empty scale → raise `RuntimeError` with a clear message; `perform_safe_judgement` turns that into
  an `unrateable` judgement explaining that Jev requires a configured book scale. (Unlike the chat
  providers, there is no sane "no scale" request to make.)

**D5 — `score` → `rating`: snap to the scale.** `level = score.round` clamped to `0..n-1`,
`rating = sorted_scale[level].to_f`. The raw continuous score is *not* stored as the rating:
`RunJudgeJudyJob:36` marks any rating outside `book.scale` unrateable, and scorers/exports assume
scale membership. The raw value is preserved in the explanation instead.

**D6 — Synthesised explanation.** Jev returns no prose, and the judging UI + prompt preview both
show `explanation`. Build one that is genuinely more informative than a chat model's:

```
Jev rated 1 ("Not what I'm looking for, but I see why") — raw score 1.43 of 0–3,
confidence 0.35. Distribution: 0: 0%, 1: 57%, 2: 43%, 3: 0%. (model jev-1.13.0)
```

**D7 — Optional confidence gate.** `judge_options[:jev_min_confidence]` (default blank = off).
Below the threshold → `judgement.mark_unrateable` with the explanation kept, so a human picks it up
in the normal unrateable flow. This is the one genuinely new capability Jev gives us over the chat
providers; keep it opt-in so existing behaviour is the default.

**D8 — `system_prompt` becomes the question's `instructions`.** The stock
`AiJudgesController::DEFAULT_SYSTEM_PROMPT` (0–3 scale, JSON output format, three worked examples)
is actively wrong for Jev: the scale comes from `criteria`, and there is no output format to specify.
Add `AiJudgesController::JEV_DEFAULT_INSTRUCTIONS` — a couple of lines, e.g. *"Judge how well this
document satisfies the user's query and information need."* — and have the form preset install it
**only when the textarea still holds the default prompt or is blank**, never over a hand-edited one
(manual scenario 12.1 explicitly checks that presets don't clobber deliberate overrides).
`book.scoring_guidelines` is appended to `instructions` when present, since that is the human-facing
rubric for the same decision.

**D9 — No new config or migration.** URL and model come from `judge_options`
(`https://api.typesafe.ai`, `jev-latest`) exactly like the other providers; `llm_api_version`
is unused and stays blank.

## 4. Code changes

1. **`app/services/jev_service.rb`** (new, ~140 lines) — `#perform_judgement(judgement, book:)`;
   private: `build_connection` (retry on `429`, `529`), `build_state`, `build_question`,
   `score_question` / `choice_question`, `criteria_for`, `apply_answer`, `explanation_for`,
   `truncate`.
2. **`app/services/llm_service.rb`** — `JEV_PROVIDERS` constant + `jev_provider?` + the one-line
   delegation in `perform_judgement` (D1). Nothing else in the file moves.
3. **`app/views/ai_judges/_form.html.erb`** — `['TypeSafe Jev', 'typesafe_jev']` in the provider
   select (`:54`) and a `PROVIDER_PRESETS.typesafe_jev` entry: URL `https://api.typesafe.ai`,
   model `jev-latest`, blank api version, `system_prompt` (per D8), and help text covering
   the key, the scale-drives-criteria behaviour, **no image support**, and the optional
   `jev_min_confidence` option.
4. **`app/controllers/ai_judges_controller.rb`** — add `JEV_DEFAULT_INSTRUCTIONS`. Defaults for
   `new` stay OpenAI; no other change (`judge_options` is already a free-form permitted hash, so
   `jev_min_confidence` needs no strong-params work).
5. **`docs/manual-testing/12-ai-judges.md`** — new scenario **12.6 "Configure and run a TypeSafe
   Jev judge"** (create judge → preset fills URL/model/instructions → prompt-preview a single pair
   → bounded Judge Judy run → confirm ratings land on the book's scale and explanations carry the
   distribution), plus a line in 12.1/12.2 that switching to Jev swaps the system prompt.
   `tracking.yml`: add the 12.6 entry with `paths: ["app/services/jev_service.rb",
   "app/services/llm_service.rb", "app/views/ai_judges/_form.html.erb"]` and extend 12.1's `paths`.
6. **`docs/`** — a short "AI judge providers" note only if one already exists; otherwise the help
   text in the form is the documentation.

## 5. Tests (`test/services/jev_service_test.rb`, webmock, no live calls)

- happy path 0–3 scale: request body asserted (path `v1/systemone`, `Authorization: Bearer`,
  `model`, `criteria` order low→high from `scale_with_labels`), `score: 1.43` → `rating == 1.0`.
- rounding boundary (`1.5` → `2`), clamping (`score` at the top level), and a **non-zero-based
  scale** (`["1","2","3","4"]` → level 0 maps to rating `1.0`, not `0.0`).
- unlabeled scale values → generated criterion text; label sanitising (newlines/length).
- scale of 11+ values → `choice` question is sent and `choice: "7"` → `rating == 7.0`.
- empty scale → unrateable with an explanatory message (via `perform_safe_judgement`).
- `jev_min_confidence` above the returned confidence → unrateable, explanation retained;
  unset → rated.
- image field present → request is still text-only and no `image_url` block is sent.
- `401` / `422` / `529` → `BOOM:` explanation + unrateable (through `perform_safe_judgement`).
- state truncation: an oversized `document_fields` value is capped.
- **`test/services/llm_service_test.rb`** — one dispatch test: provider `typesafe_jev` hits
  `/v1/systemone` (proves the façade branch), leaving the existing 400+ lines untouched.
- **`test/jobs/run_judge_judy_job_test.rb`** (or the existing job test) — a Jev judge produces
  in-scale ratings and never trips the out-of-scale guard.

Run: `bin/docker r rails test test/services/jev_service_test.rb` then the full `bin/docker r rails test`,
plus `bin/docker r rails test:rubocop` for the new file.

## 6. Phasing

1. **Service + tests** (items 1–2, §5) — reviewable on its own, no UI surface.
2. **Form preset + default instructions** (items 3–4).
3. **Manual test pass + tracker/prose updates** (item 5) — drive 12.6 via Playwright MCP against a
   real key; without a key, drive it with a webmock-free stub endpoint and say so in `notes`.

## 7. Open questions / risks

- **Key for a live smoke test.** Everything above is testable offline, but scenario 12.6 wants one
  real call. Needed before phase 3 can honestly be marked `pass`.
- **Language.** Jev is English-first; other languages (incl. CJK) are accepted at reduced accuracy.
  Non-English books should be validated against a human-judged sample before trusting it.
- **No prose reasoning.** Teams that read judge explanations to debug their rubric get a
  distribution instead of an argument. That is arguably better signal, but it *is* a UX change worth
  calling out in the help text.
- **Model pinning.** `jev-latest` floats; `judge_options[:llm_model]` can pin `jev-1.13` if a team
  needs reproducible judgements across a book.
- **Jev is never batch-processed.** Not "not yet" — there is no TypeSafe batch endpoint, and
  the batch feature (`docs/todo/llm_judge_openai_batch.md`) must never route a Jev judge through
  `judgement_batches`. Enforced, not just documented: `batch?` is permanently false on the Jev
  provider registry entry, `LlmBatchService` raises `UnsupportedProviderError`, and
  `SubmitJudgementBatchJob` rejects the judge up front rather than building a chat-shaped JSONL
  for a model that does not speak it. Test it explicitly.
- **Throughput comes from concurrency, not batching.** If `RunJudgeJudyJob`'s sequential loop is
  too slow for a big book on Jev, the answer is parallel requests against the 1,200 req/min limit
  (20k pairs ≈ 17 minutes at the cap), not a batch API. Out of scope here; noted so nobody
  reaches for the batch tables to solve it.
