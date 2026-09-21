# ADR 0001 — LLM-as-Judge provider architecture: the adapter seam, Jev now, batch later

- **Status:** Proposed
- **Date:** 2026-09-21
- **Affects:** `app/services/llm_service.rb`, `app/jobs/run_judge_judy_job.rb`,
  `app/controllers/ai_judges/prompts_controller.rb`, `app/views/ai_judges/_form.html.erb`
- **Plans that implement this:** `docs/todo/llm_judge_shared_foundation.md` (the seam),
  `docs/todo/jev_llm_judge.md` (Jev), `docs/todo/llm_judge_openai_batch.md` (batch — deferred)

---

## 1. Context

### 1.1 What an AI judge is today

An AI Judge is a `User` row with `llm_key`, `system_prompt` and a free-form `judge_options` hash
(`llm_provider`, `llm_service_url`, `llm_model`, `llm_api_version`, `llm_timeout`). Two call sites
use it, both through the same two lines:

```ruby
llm_service = LlmService.new judge.llm_key, judge.judge_options
llm_service.perform_safe_judgement(judgement, book: book)
```

— `RunJudgeJudyJob#perform` (the "Judge Judy" bulk run) and `AiJudges::PromptsController#update`
(the single-pair prompt preview). `LlmService` then does four different jobs in one object:

1. **Transport** — build a Faraday connection, pick an auth header style, pick a URL path.
2. **Request shaping** — turn a `QueryDocPair` into chat messages (`make_user_prompt`), with an
   `image_url` block when `document_fields['image']` is present.
3. **Scale semantics** — describe the book's rating scale in prose and staple it onto the system
   prompt (`augment_system_prompt_for_scale`).
4. **Answer interpretation** — pull a JSON string out of `choices[0].message.content`, parse it,
   coerce `judgment` to a number.

A fifth job lives outside the class, in the caller: `RunJudgeJudyJob:30-43` decides whether the
resulting rating is usable (blank → unrateable; outside `book.scale` → annotate + unrateable).
The prompt preview applies none of those rules, so it can display a rating the real run rejects.

### 1.2 Three pressures, arriving together

**(a) A provider that is not a chat model.** TypeSafe's Jev is a "System One" model: it does not
generate text. You POST a `state` plus typed questions (`noul` / `choice` / `score`) to
`/v1/systemone` and get back typed answers with a probability distribution and a confidence value.
Every one of the four responsibilities above assumes a chat completion, and all four are wrong for
Jev: no system prompt (instructions are per-question), no JSON-in-a-string to parse, no prose
explanation at all, a continuous score over *level indexes* rather than a scale value, text-only
input (the `image_url` branch has nowhere to go), and the scale is not prose — it **is** the
request, as a `criteria` array capped at 10 levels.

**(b) Bulk judging is slow and expensive — but that is a separate fix.** A 20k-pair book on the
current path is 20k sequential HTTPS round trips at retail token pricing. OpenAI's Batch API
answers that (50% price, 50k requests per file, 24h window) at the cost of durable cross-process
state: two tables, five jobs, a poll sweeper, chunking, and a selection guard so an in-flight pair
is not judged twice. That is a real project, and it is **not** this one.

**(c) Provider knowledge is already duplicated four ways.** `LlmService::AZURE_PROVIDERS` /
`ANTHROPIC_PROVIDERS`, the `case` in `compute_completions_path`, the `<select>` options in
`_form.html.erb:54`, and the hand-maintained `PROVIDER_PRESETS` JavaScript object at `:215`.
Adding any provider means editing all four and hoping they stay in agreement.

### 1.3 The forces

- Jev is wanted **now**; batch is wanted **later**, and might never be wanted if Jev's economics
  (orders of magnitude cheaper per token, sub-second, 1,200 req/min) remove the pressure.
- Doing the Jev refactor first and the batch refactor second means refactoring the same class
  twice, along two different axes, with the second one invalidating the first.
- Neither feature justifies a rewrite of a class that two production paths depend on, and whose
  behaviour is pinned by a 400+ line test file we want to keep green **unchanged**.
- Every step must be shippable on its own. Quepid deploys `main`; there is no long-lived feature
  branch to hide a half-finished refactor in.

---

## 2. Decision

**We introduce a provider-adapter seam now, sized so that Jev drops in as one adapter and OpenAI
Batch drops in later as a consumer of the same seam — and we implement only the seam and Jev.
No batch code, no batch tables, no batch gems, in any step this ADR schedules.**

Six decisions follow.

### D1 — A request is inert data ("the envelope"), not a side effect

Each adapter exposes exactly two operations:

```ruby
# pure: no I/O, no clock, no randomness
request_envelope(query_doc_pair, system_prompt:, book:)  # => { path:, body:, headers: }

# pure w.r.t. I/O: takes an already-parsed response body, mutates the judgement, never saves
apply_response(judgement, response_body, book:)
```

**Rationale.** This is the one property that decides whether batch is a later *addition* or a
later *refactor*. A batch JSONL line is literally `{custom_id:, method: 'POST', url: "/#{path}",
body:}`, and batch ingest is `apply_response` over a canned body pulled from a downloaded file
hours after the request was built, in a different process. If building a request requires a live
connection, or interpreting one requires a `Faraday::Response`, batch cannot reuse either and we
write both twice. Making the envelope inert costs nothing today and is the whole ballgame later.

*Alternatives rejected:*
- **`JudgementPromptBuilder` + `JudgementResponseParser`** (as `llm_judge_openai_batch.md` §4.1
  originally proposed) — splits by *stage* for one dialect. A second dialect then needs a second
  pair of classes and a dispatcher anyway.
- **Adapters that post for themselves** (`adapter.judge(pair)`) — simplest for sync, useless for
  batch, which must build many requests and send none.

### D2 — `LlmService`'s public surface is frozen

`LlmService.new(llm_key, judge_options)`, `#perform_judgement`, `#perform_safe_judgement`,
`#make_user_prompt` keep their names and semantics. Internally it becomes: resolve adapter, build
envelope, post, `apply_response`, rescue. `RunJudgeJudyJob` and `AiJudges::PromptsController` are
not edited.

**Rationale.** It makes every refactor step provable: if `test/services/llm_service_test.rb` has
to change, the step was not behaviour-preserving and is wrong. It also keeps each step revertable
in isolation — no caller is holding the new shape hostage.

### D3 — Four small extractions, each with a single reason to change

| Extraction | Owns | Replaces |
| --- | --- | --- |
| `LlmProviders` registry | label, adapter, auth style, defaults, `images?`, `batch?`, help text | two constants, two `case` statements, the `<select>`, the JS presets |
| `JudgeScale` | the book's scale as sorted values + labels; `describe`, `criteria`, `nearest`, `includes?` | prose building in `augment_system_prompt_for_scale`, membership check in `RunJudgeJudyJob:36` |
| `JudgementFinalizer` | "is this judgement usable?" — blank, out-of-scale, adapter gate | inline rules in `RunJudgeJudyJob:30-43` (and the *absence* of them in the preview) |
| `LlmConnection` | Faraday + JSON middleware + retry (429, 529) | `LlmService#build_connection` |

**Rationale.** Each is duplication that either exists today or is about to be created twice (once
by Jev, once by batch ingest). `batch?` in particular belongs on the *provider*, because
batchability is a property of a vendor's API — not a list maintained inside batch code.

### D4 — Jev is a provider, not a mode

Jev ships as one adapter plus one registry entry. Its judge-specific behaviour, in the adapter:
book scale → `criteria` (2–10 levels; >10 falls back to a `choice` question; empty scale is a
clear error); `score: 1.43` → snapped to the nearest scale value, because `RunJudgeJudyJob` and
every scorer assume scale membership; a synthesised `explanation` carrying the raw score,
confidence and full distribution, since Jev returns no prose; and an opt-in
`judge_options[:jev_min_confidence]` gate. Details in `docs/todo/jev_llm_judge.md` §3.

**Rationale.** Nothing about Jev is a new *concept* for Quepid — it is a judge that returns a
rating and an explanation, like every other judge. Keeping it inside the adapter boundary means
the job, the preview, the book, the scorers and the UI stay ignorant of it.

### D5 — Jev is never batch-processed

There is no TypeSafe batch endpoint and no plan for one. `LlmProviders['typesafe_jev'].batch?` is
permanently `false`, and when the batch feature exists that flag — not a comment — is what keeps a
Jev judge out of it. If Jev throughput ever disappoints, the answer is concurrency against the
1,200 req/min ceiling (a 20k-pair book is ~17 minutes at the cap), not a batch API.

### D6 — Batch is deferred, and the seam is held to a written contract instead

We do not build batch now. We do commit to not *foreclosing* it, and we make that testable rather
than aspirational — see §3. The batch plan stays on disk as the record of what it will cost.

**Rationale.** Batch's value is "the same frontier model at half price, 24 hours later". Jev's
value is "a much cheaper, much faster model, right now". If Jev judges acceptably on real books,
most of batch's motivation evaporates and we will have saved two tables, five jobs, a sweeper and
a change to the hottest selection query in the judging flow. Deferring it is not procrastination;
it is refusing to pay for an option we may not exercise. Meanwhile the seam costs the same either
way, so it is built now, when it is cheap and there is a second provider to prove it against.

---

## 3. The batch-readiness contract

"Keeping batch in mind" means exactly these six properties. Each is verifiable **today**, with no
batch code in the tree. If a step would violate one, that step is wrong.

| # | Property | Why batch needs it | Verified now by |
| --- | --- | --- | --- |
| **B1** | `request_envelope` performs no I/O and is deterministic | batch builds 50,000 requests and sends none; it streams them to a file | unit test calls it with no HTTP stub registered and asserts the hash |
| **B2** | The envelope is JSON-serialisable and contains everything needed to send the request | a JSONL line *is* the envelope plus a `custom_id` | test asserts `JSON.parse(envelope.to_json) == envelope.deep_stringify_keys` |
| **B3** | `apply_response` takes a parsed **Hash**, not a `Faraday::Response` | ingest replays bodies from a downloaded file, hours later, in another process | test applies a fixture Hash directly, no HTTP involved |
| **B4** | `apply_response` never saves, never broadcasts, never enqueues | ingest wraps its own transaction per line and links the `Judgement` to a batch item | test asserts the judgement is `new_record?`/dirty afterwards |
| **B5** | "Usable rating?" lives in `JudgementFinalizer`, callable from anywhere | ingest must apply the identical blank / out-of-scale rules as the sync job | finalizer test, plus the job's existing tests unchanged |
| **B6** | Provider capability is data on the registry, not a branch | the submit path must refuse non-batch providers up front | `LlmProviders` test: `batch?` true only for `openai`, false for `typesafe_jev` |

Add one **simulation test** in phase A that walks the batch flow without any batch code:
build an envelope → serialise to a JSONL-shaped line → read it back → `apply_response` a canned
output body → `JudgementFinalizer`. About 20 lines. It is the cheapest possible proof that when
batch arrives it is additive, and it fails loudly if a later change re-couples building to sending.

---

## 4. Consequences

**Positive**

- Adding a provider becomes: one adapter + one registry entry. The `<select>`, the JS presets, the
  auth/path logic and the capability flags all follow from the registry.
- Jev's entire UI surface is a registry entry.
- The preview page and the bulk job finally apply the same usability rules (a visible fix, called
  out in its own step — see A6).
- Batch, if we build it, drops its §4.1 entirely and starts at "schema".
- The 400+ line `llm_service_test.rb` and the existing job tests act as the refactor's guard rail
  and never change.

**Negative**

- More files and one more indirection for anyone tracing a request: `LlmService` → adapter →
  connection. Mitigated by keeping adapters dumb (build a Hash, read a Hash) and putting all the
  policy in `JudgeScale` / `JudgementFinalizer`.
- The registry is a second place to look for "what does this provider do", until the old constants
  are deleted (which happens in the same step that introduces it — see P5 in §5).
- The batch-readiness contract is a constraint on future edits that nothing in the compiler
  enforces; the simulation test is the only thing standing behind it.

**Neutral / accepted**

- Judgements from Jev carry a synthesised explanation rather than model prose. Arguably better
  signal (a distribution and a confidence, not a rationalisation), but it is a UX change.
- Snapping Jev's continuous score discards sub-level precision. The raw value survives in the
  explanation; the alternative — fractional ratings — would be rejected by
  `RunJudgeJudyJob:36` and would confuse every scorer.

---

## 5. Implementation steps

### 5.1 Rules every step obeys

- **P1 — Additive.** New files, new classes. No renames of anything a caller touches; no method
  deleted in the same PR that introduces its replacement's *first* caller.
- **P2 — Proven by tests that do not change.** `test/services/llm_service_test.rb` and the
  `RunJudgeJudyJob` tests stay green **without edits** through all of phase A. Needing to edit them
  is the signal that a step changed behaviour.
- **P3 — New behaviour is data, not a deploy.** A provider is chosen per AI Judge row. Deploying
  Jev changes nothing for existing judges; someone has to pick it.
- **P4 — No schema, no gems, no background jobs in phases A and B.** (`faraday-multipart` arrives
  with batch, if batch ever arrives.)
- **P5 — Each step is revertable alone.** A step either fully replaces an internal helper and
  deletes it, or does not touch it at all — never leaves a half-migrated pair behind for the next
  PR to finish.
- **P6 — One visible behaviour change per PR, never bundled with a refactor** (only A6 and B2
  carry one).

Every step below is a single PR, mergeable and deployable on its own, in this order.

### 5.2 Phase A — the seam (no user-visible change, no new capability)

**A1 · `LlmProviders` registry, rendered by the form** *(landed)*
Add `app/models/llm_provider.rb` + `app/models/llm_providers.rb` carrying today's six providers
verbatim. Render the `<select>` options and the `PROVIDER_PRESETS` JSON from it; delete the
hand-kept lists in the ERB/JS.
*Deployable because* it is a render-source swap; the emitted HTML/JS is asserted identical.
*Rollback:* revert one file pair. *Verify:* `rails test test/models/llm_providers_test.rb`,
`yarn lint:js`, plus a Playwright MCP shot of the AI Judge form (manual scenario 12.1 paths).

**A2 · `JudgeScale`** *(landed)*
Introduce the value object; use it in `LlmService#augment_system_prompt_for_scale` /
`#sanitize_scale_label` and in `RunJudgeJudyJob`'s membership check.
*Deployable because* both call sites are asserted to produce byte-identical strings/decisions.
*Rollback:* revert. *Verify:* `rails test test/models/judge_scale_test.rb test/services/llm_service_test.rb`.

**A3 · `LlmConnection`** *(landed)*
Move the Faraday builder out of `LlmService`; add `529` to `retry_statuses`.
*Deployable because* the only behaviour delta is retrying one more status code that no current
provider returns. *Verify:* existing `llm_service_test.rb` retry tests.

> **Found while extracting it:** faraday-retry only retries idempotent methods by default
> (`delete/get/head/options/put`), so `retry_statuses` had never applied to the POSTs a judge
> makes — the retry config was inert for our calls, and `529` was inert with it.

**A3b · Make the retries real for POSTs** *(landed — the behaviour change A3 deliberately excluded)*
`retry_if` narrows by *exception* rather than by verb: `Faraday::RetriableResponse` is raised only
for `RETRY_STATUSES`, so a POST retries when the provider said "too many" or "overloaded" — which
guarantees no completion was produced and nothing is paid for twice — and does **not** retry on a
timeout or connection failure, where the request may already have been processed.
The base interval moves to `Rails.configuration.llm_retry_interval` (2s; `0` in test, so a stubbed
429 doesn't make the suite sit through a real backoff — it costs 15s otherwise).

**A4 · Adapters for the providers we already have**
`LlmJudgeAdapters::{Base,OpenAi,Anthropic}` implementing D1's two methods; `LlmService` rewired to
resolve via the registry and delegate. Azure variants are the OpenAI/Anthropic adapters with
registry-supplied paths and auth.
*Deployable because* P2: the whole existing service test file passes untouched.
*Verify:* `rails test test/services` + the **B1–B4 contract tests** and the batch-flow simulation
test from §3.

**A5 · `JudgementFinalizer`, wired into the job only**
Extract the blank / out-of-scale rules verbatim (including the annotation wording) and call it
from `RunJudgeJudyJob`.
*Deployable because* the rules and their wording are unchanged; job tests pass unedited.

**A6 · Preview page applies the same rules** *(the one behaviour change in phase A — its own PR)*
Wire `AiJudges::PromptsController#update` through `JudgementFinalizer`, so the preview can no
longer show a rating the real run would reject.
*Deployable because* it only makes the preview stricter, and the preview writes nothing.
*Verify:* manual scenario 12.4 driven through Playwright MCP; update `tracking.yml`.

> After A6 the tree has **no new feature** and one fixed inconsistency. This is a fine place to
> stop indefinitely if priorities change — nothing is half-built.

### 5.3 Phase B — Jev (opt-in, per judge)

**B0 · Placeholder entry — listed, explained, not savable** *(landed)*
A registry entry for Jev with a `notice_html` banner, the fixed endpoint/model shown read-only,
and a link to where a team gets an API key. `LlmProvider#coming_soon?` is derived from that
notice, and `AiJudgesController` refuses to create or update a judge pointed at such a provider,
so a placeholder can never reach a judging run.
*Deployable because* it adds an option that cannot be saved; every existing judge is untouched.
*Why before B1:* teams can see what Jev will need and get a key ready while the adapter is built.
It generalises — any future provider can be listed this way before its adapter exists.

**B1 · The Jev adapter, unreachable**
`LlmJudgeAdapters::Jev` + its tests (scale→criteria, snapping, non-zero-based scales, >10-level
choice fallback, empty scale, confidence gate, state truncation, text-only handling of an image
field, 401/422/529). **Not** added to the registry, so no code path reaches it.
*Deployable because* it is dead code in production until B2. *Rollback:* delete one file.

**B2 · Turn the placeholder into a working provider** *(the behaviour change: it becomes usable)*
Drop `notice_html` (which clears `coming_soon?` and the save guard) and complete the entry — label, `https://api.typesafe.ai`, `jev-latest`, Bearer auth, `images? false`,
`batch? false`, Jev-specific default instructions, help text (scale drives criteria; no image
support; optional confidence gate). The preset installs its default instructions **only** over a
blank or still-default system prompt, never a hand-edited one.
*Deployable because* existing judges keep their provider; nothing changes until someone selects
Jev. *Verify:* create a Jev judge, run the prompt preview against one pair, then a bounded
Judge Judy run; confirm ratings land on the book's scale.

**B3 · Manual-test coverage** — new scenario 12.6 in `docs/manual-testing/12-ai-judges.md`,
`tracking.yml` entry and `paths` updates for 12.1/12.2. No code.

### 5.4 Deferred — batch (not scheduled by this ADR)

`docs/todo/llm_judge_openai_batch.md` stands as written, minus its §4.1 (done by A4) and its §9
PR 1 (done by phase A). When and if it starts, its first step is the migration pair; nothing in
phases A/B needs revisiting.

**Trigger to start it:** a team on a chat-model judge with a book big enough that a real run is
measured in hours, *and* for whom Jev is not an acceptable substitute (measured — a human-judged
sample, not an opinion). Absent that, batch stays deferred.

---

## 6. Revisit triggers

- **Azure batch demand.** Most Quepid batch users would be on `azure_openai`, whose batch API has
  a different URL shape and needs a Global-Batch deployment. If batch starts, decide OpenAI-only
  vs. both **before** C1, since it changes the registry's `batch?` from a boolean to a capability.
- **Jev accuracy outside English.** Jev is English-first; other languages are accepted at reduced
  accuracy. A non-English book that disagrees with human judges is a reason to re-open D4's
  "one adapter, no special cases" assumption (e.g. per-language instructions), not to abandon Jev.
- **Adapters growing provider `case` statements again.** If an adapter starts branching on
  `llm_provider` internally, the registry is under-powered — move the varying thing into the
  registry entry rather than letting the branches come back.
- **A third non-chat provider.** If one arrives and `apply_response` cannot express it, revisit
  D1's two-method interface before adding a third method to every adapter.
