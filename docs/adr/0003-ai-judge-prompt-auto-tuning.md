# ADR 0003 — Auto-tuning AI judge prompts against reference judgements

- **Status:** Proposed
- **Date:** 2026-10-25
- **Affects:** `AiJudge#system_prompt`, calibration samples/runs, `CalibrationRunJob` and the
  calibration UI. The provider adapters are reused without an interface change.
- **Builds on:** [ADR 0001](./0001-llm-judge-provider-architecture.md): the adapter seam and
  `request_envelope` / `apply_response`; [ADR 0002](./0002-judge-calibration.md): calibration and
  manual tuning as implemented in #1827.
- **Delivery assumption:** [PR #1827 — Judge Calibration](https://github.com/o19s/quepid/pull/1827)
  reaches production first. Auto-tuning extends that feature; it does not build a second
  evaluation subsystem. The comparison below inspects PR head `024da32e70e9` (2026-10-25);
  recheck the merged implementation before starting development.

---

## 1. Context

### 1.1 How a judge's prompt is made today

An AI judge's behaviour is almost entirely its `system_prompt`, a free-text string of up to 4000
characters that a person writes by hand in the wizard. `LlmJudgeAdapters::Base#system_prompt_for`
appends a reminder of the book's scale, and `#user_prompt` renders the query plus the
document's fields as YAML. The model answers with `{explanation, judgment}`.

The wizard's `test_prompt` previews a few pairs. With #1827 in production, a person can also
calibrate a judge, edit its prompt, run again on the same sample and explicitly apply the better
settings. That supplies measurement and manual experimentation. The remaining work is automatic
candidate generation and selection, with a separate held-out test for the resulting prompt.

### 1.2 What we already have that makes this measurable

- **Labelled data.** A chosen reference supplies `(query, document) → rating` examples on a
  known scale (`JudgeScale`). The two reference target types are defined in the Goal below.
  Those are the labels the target AI judge is meant to reproduce; other judgements on the book
  are not automatically part of the reference.
- **A pure request/response seam.** ADR 0001's `request_envelope` is deterministic and does no
  I/O, and `apply_response` reads a plain Hash. A harness can evaluate candidate prompts using
  these methods and unsaved judgements, without running the bulk job or writing ratings.
- **A place to put the result.** The output of auto-tuning is still a prompt, and
  `system_prompt` already holds one.
- **Calibration infrastructure.** #1827 supplies trial-answer storage, prompt snapshots, a
  background evaluator and result comparisons. Section 1.5 identifies what can be reused and
  D2 describes the additions needed for auto-tuning.

### 1.3 The technique

[DSPy](https://dspy.ai/learn/optimization/optimizers/) and related techniques treat instructions
and demonstrations as parameters to tune. Given:

1. a **program**, here "rate this query/document pair on this scale",
2. a **training set** of labelled examples,
3. a **metric** that scores one prediction against its label,

the tuner proposes instruction rewrites and picks few-shot demonstrations from the training
set. It evaluates candidates on a validation split and measures the selected candidate on a
separate test split. DSPy itself returns a compiled program: extracting its instructions does
not necessarily preserve the framework's message formatting, demonstrations or output schema.
Quepid requires a plain prompt evaluated through its own judging path.

### 1.4 Tool research and fit (2026-10-25)

**Constraint:** direct DSPy use is excluded for this work. A separate Python service remains an
option. The Ruby projects below are alternatives to assess, not an assumed exception to that
constraint. Findings come from primary documentation and source inspection; no library was
installed and no paid model benchmark was run.

| Option | What exists | Assessment for Quepid |
| --- | --- | --- |
| **DSPy.rb with `dspy-miprov2` or `dspy-gepa`** | An independent Ruby implementation, not an official or API-compatible DSPy port. It supplies instruction/demo search and reflective instruction search. [Project comparison](https://oss.vicente.services/dspy.rb/advanced/python-comparison/), [tuning guide](https://oss.vicente.services/dspy.rb/optimization/prompt-optimization/). | A real Ruby alternative, but its normal execution path owns signatures, rendering and response handling. Copying the resulting instruction alone is insufficient. MIPROv2 also adds Numo numerical dependencies. [Gem dependencies](https://rubygems.org/gems/dspy-miprov2). |
| **Ruby `gepa` core with a Quepid evaluator** | Its `GEPA.optimize` accepts an application adapter and candidate text map. The published `gepa` 1.0.3 still depends on `dspy`; this is not a dependency-free standalone engine. [API source](https://github.com/vicentereig/dspy.rb/blob/b18a402143091a6b435972d460b8c4c8feca0b2d/lib/gepa/api.rb), [published metadata](https://rubygems.org/api/v1/gems/gepa.json). | The closest Ruby library fit: keep Quepid rendering and plug in search. It requires wiring the evaluator, proposer and tracking; the project describes it as a lower-level supporting library. Ruby 4/container compatibility and integration effort remain untested. [Package boundaries](https://oss.vicente.services/dspy.rb/getting-started/packages/#gepa). |
| **Standalone Python GEPA service** | `gepa.optimize` supports a custom adapter; `optimize_anything` supports an evaluator callback. Python DSPy is not required by the core package. [Adapter guide](https://gepa-ai.github.io/gepa/guides/adapters/), [callback API](https://gepa-ai.github.io/gepa/api/optimize_anything/optimize_anything/), [dependency manifest](https://github.com/gepa-ai/gepa/blob/7af5f0c5c79fcc16b2d5248b187d0864683edd4d/pyproject.toml). | The main external-service alternative. Reuses an existing search engine without adopting DSPy's program model. Requires another deployed worker and an authenticated evaluation boundary; keep production judging in Ruby. |
| **RubyLLM / Langchain.rb** | Provider clients and application building blocks; Langchain.rb also documents prompt templates and evaluation. [RubyLLM](https://rubyllm.com/), [Langchain.rb](https://github.com/patterns-ai-core/langchainrb). | The reviewed APIs do not supply this automatic candidate-search loop. Adding either would still leave custom tuning work and duplicate Quepid's existing judging transport. |
| **Small custom Ruby tuner** | Error-driven prompt rewriting through an LLM API is an established technique; ProTeGi combines critiques, rewrites and candidate search. [Paper](https://aclanthology.org/2023.emnlp-main.494/). | Reasonable for one bounded prompt and one evaluator: reuse Quepid's judging code and build a small search loop. This is an engineering recommendation, not evidence that it matches GEPA's quality or call efficiency. |

**Recommendation:** extend calibration's Ruby evaluator with a bounded custom Ruby tuner (D2).
Retain standalone Python GEPA as the main alternative if richer search earns its
deployment cost. Ruby GEPA is worth an integration spike if its DSPy.rb dependency is acceptable;
do not adopt the full framework merely to rewrite one prompt. Compare alternatives with the same
dataset, production evaluator and total model-call budget before claiming one is better.

### 1.5 Overlap with Judge Calibration (#1827)

**#1827 addresses two related problems.** First, it calibrates judges by comparing their decision
models: how each maps a query/document pair to a relevance grade, where those decisions agree,
which way a judge is biased, and how its grades affect query scores and their ordering. That
assessment is useful even when nobody changes a prompt, for example when deciding whether to use
a judge or trust an escalation reference. Second, it proposes **manual tuning**: a person edits
settings, reruns the same sample, compares results and explicitly applies the chosen settings.

**This ADR is the natural next step for that manual-tuning workflow.** Auto-tuning automates
candidate proposal and selection, using calibration to measure the results. Calibration remains
a separate capability; auto-tuning builds on it rather than replacing its purpose. Both share
the calibration records, evaluator and reports below.
This is a source/test inspection of the linked PR head, not a live replay or an independently
verified test run.

| #1827 already provides | Reuse for auto-tuning | Additional contract |
| --- | --- | --- |
| `CalibrationSample` / `CalibrationSamplePair` store pair ids and frozen reference ratings. [Source](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/calibration_sample.rb#L39-L69). | Shared sample storage and existing human-or-AI reference selection. | Reference provenance, disjoint query splits and frozen inputs/scale; consensus is an optional extension. |
| `CalibrationRun` snapshots prompt/options and supports alternate settings without changing the judge. [Source](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/calibration_run.rb#L27-L66). | One run for a candidate on a split's sample; existing `CalibrationAnswer` rows hold trial predictions. | A parent auto-tuning session groups candidates, split runs, budget and provenance. |
| `CalibrationRunJob` uses `LlmService#perform_safe_judgement` and `JudgementFinalizer`, with per-run concurrency, progress and cancellation. [Source](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/jobs/calibration_run_job.rb). | The production-parity evaluator and child-run lifecycle. | Session-wide scheduling, spend limits and cancellation; explicit handling of failed calls. |
| `JudgeAgreement` supplies ordinal alpha, exact/within-one agreement, bias and a confusion matrix; `CalibrationScoreImpact` supplies query-score diagnostics. [Agreement](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/services/judge_agreement.rb), [score impact](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/services/calibration_score_impact.rb). | Common reporting and drill-downs, including rank diagnostics where the sample supports them. | A search score that counts invalid answers, and explicit train/validation/test labels (D3). |
| Same-sample comparisons and an explicit Apply action. [Controller](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/controllers/calibrations_controller.rb#L54-L78). | Extend the Calibration page with Auto-tune and a grouped session report. | Only the final tested candidate is eligible for auto-tuning promotion; detect intervening judge edits. |

The PR's [job tests](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/test/jobs/calibration_run_job_test.rb)
already cover no judgement writes, outbound use of the candidate prompt, skipping answered pairs
on resume, cancellation before start and mostly-failing runs. Keep those contracts and tests;
add auto-tuning coverage around them rather than replacing the evaluation path.

---

## 2. Goal

**Improve and measure an AI judge's agreement with a chosen set of reference judgements for a
book, by auto-tuning its prompt using instruction rewrites and few-shot demonstrations.**

Auto-tuning explicitly supports **two types of reference target**:

1. **Human judgements** — ratings from a selected human judge or an explicitly defined human
   consensus.
2. **Judgements from a more advanced LLM judge** — a selected teacher whose decisions the tuned
   judge should reproduce, for example an expensive LLM used to guide a cheaper production judge.

The type identifies the source of the reference labels, not a different tuning algorithm.
Consensus is an aggregation policy over named contributors, not an implicit third target type.

The **reference** supplies the target ratings; the **target judge** is the AI judge whose prompt
changes. For example, a team can label a representative sample once with an expensive AI judge,
freeze those labels, and tune a cheaper judge to reproduce them on unseen queries. Supplying
reference labels and proposing candidate prompts are separate roles; the same model service can
perform both. The deployed target needs neither role at judging time.

The result measures **agreement with the named reference**. Consistency does not establish
correctness, and price alone does not establish reference quality. An AI-reference run must not
be reported as human agreement. If a separate human benchmark exists, report it separately;
human labels are not a prerequisite for auto-tuning.

Concretely, success means:

- For a book with enough eligible reference judgements, an auto-tuned prompt beats the baseline on
  a **held-out** set of pairs, by the metric in D3, and we report that number rather than
  asserting it.
- The auto-tuned prompt is an ordinary `system_prompt`. Once it is saved, nothing at judging time
  knows it was auto-tuned.
- Anyone can reproduce the measurement from recorded inputs and outputs: which book, which
  split, which model, the score before and the score after. Fresh provider calls may vary;
  a split seed alone does not guarantee identical model answers.

Non-goals: fine-tuning model weights, auto-tuning Jev (it has no system prompt; see D6), and
changing how judging runs (`RunJudgeJudyJob`, escalation, `JudgementFinalizer`).

---

## 3. Decision

### D1 — The output is a prompt, not a runtime dependency

Auto-tuning produces a `system_prompt` (instructions plus inline demonstrations), and the judge
stores it like any other. There is no DSPy, Python process or tuner state on the judging
path.

**Rationale.** It keeps the adapter seam, the batch-readiness contract (ADR 0001 §3) and every
provider exactly as they are. A judge that was auto-tuned can be edited by hand afterwards, copied,
or rolled back by pasting the old text.

*Alternatives rejected:*
- **A DSPy service called at judging time.** It adds a second runtime and a network hop to every
  judgement, for a result that does not change between calls.
- **Porting DSPy to Ruby.** That is a large surface to maintain for a loop that runs rarely and
  offline. Evaluating an existing Ruby implementation is a separate option (section 1.4).

### D2 — Add a bounded Ruby tuner above calibration

The proposed first implementation adds a parent auto-tuning session and a small Ruby coordinator
outside the web request. A session owns the dataset/split manifest, starting judge snapshot,
candidate lineage, budget and selected result. Its evaluations are ordinary `CalibrationRun`s
on split-specific samples, linked to the session and candidate. `CalibrationAnswer` remains the
only trial-prediction store; no parallel evaluation tables or second LLM judging loop are needed.

The **evaluator** is calibration's judging path; the **proposer** asks an LLM for revised
instructions; the **search loop** selects candidates and schedules their runs. Build candidate
snapshots from the session's starting snapshot using `CalibrationRun.with_settings`, rather than
the interactive rerun controller, which starts from the judge's currently saved settings. The
search/proposal part can later be replaced by a library or Python service.

**Why custom is reasonable here.** There is one short prompt to tune, one labelled task and an
existing calibration runner, storage and UI. We do not need a program compiler, Bayesian search
or a general agent framework for the first experiment. The bounded loop is:

1. Freeze the selected reference labels, scale and query split; measure the original prompt
   on validation through calibration. Measurement without auto-tuning already exists in #1827.
2. Use training examples and their errors to propose a small, configured number of instruction
   rewrites. Try a bounded selection of train-only demonstrations, including no demonstrations.
   Frozen reference ratings remain the targets; candidate predictions and model explanations
   cannot replace them.
3. Reject empty or over-budget prompts before provider calls, deduplicate candidates, and
   evaluate them through the same evaluator. Retain the baseline and a small set of candidates
   by validation score. Stop at the configured call/spend budget, round limit or lack of gain.
4. Freeze the winner, then compare it with the baseline on the untouched test split. Return the
   prompt and report for a separate review/apply step before saving. A failed test comparison
   is a recorded result, not permission to tune against those test examples. Future external
   control of this same workflow is defined in [ADR 0004](./0004-relevance-factory.md).

**Production parity.** Keep `CalibrationRunJob`'s `perform_safe_judgement` / `JudgementFinalizer`
path, including the adapters' `request_envelope` / `apply_response`. Preserve the judge's
provider, endpoint, model, options, scale reminder, YAML fields, image policy and response parsing.
Do not persist trial judgements or invoke escalation. Proposal calls have a separate
text-generation contract; they cannot use the judge's rating parser. Extend the existing job's
input boundary only as needed to evaluate frozen examples, with parity tests for both manual
and auto-tuning runs.

**Adaptations after #1827, without changing manual calibration's contracts:**

- **Labels and samples.** Reuse calibration's single human-or-AI reference for the first version,
  with D3's source and population policy. Human consensus need not block that version. An optional
  consensus mode must name its contributing judges/ratings and aggregation rule, without
  inventing a synthetic User or changing existing single-reference samples.
  [Current selection](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/book.rb#L318-L356).
- **Reference acquisition.** Existing ratings from the selected AI judge can be used directly.
  If new expensive-reference labels are needed, generate and freeze them once before candidate
  comparisons, and include their calls in the budget. Reusing a calibration run's answers as
  reference labels would need an explicit source adapter: #1827 currently selects references
  from `judgements`. Do not copy trial answers into production judgements merely to fit that
  selector. Keep test labels inaccessible to the proposer regardless of how they were obtained.
- **Frozen inputs.** Samples freeze ratings and ids, but the job reads live `QueryDocPair`s and
  `JudgeScale.for(run.book)`; score impact also reads live positions. Snapshot query text,
  document fields/image references, position and scale/labels for auto-tuning, and evaluate and
  report from that snapshot. A fixed image URL does not freeze remote image bytes; either version
  those inputs or state that replay limit. Existing deletion cascades must invalidate affected
  sessions rather than silently shrink their splits.
  [Stored fields and cascades](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/db/migrate/20261005150000_create_calibrations.rb).
- **Split isolation.** Draw one eligible dataset, assign whole queries to train/validation/test
  deterministically and persist membership before creating child samples. Calling the existing
  random draw three times does not ensure separation. Samples already used to refine a prompt
  are not untouched test data. Calibration's top-list mode is useful for rank diagnostics, but
  is not required for splitting scattered labelled pairs by query.
- **Scale and cost.** The dialog caps samples at 500 pairs or 50 queries. A provisional floor of
  50 test queries at a 20% split implies about 250 eligible queries overall, exceeding one such
  sample. Group bounded child samples/runs under the session; do not silently raise manual
  limits. Record the `rank_depth`/top-list population and make quality claims about that population.
  [Current bounds](https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/calibration_sample.rb#L16-L27).
- **Session lifecycle.** Per-run concurrency does not bound many candidate runs. Add session-wide
  scheduling, call reservations and cancellation, including proposal calls, retries and reserved
  final-test capacity. Existing resume skips every stored answer, including failed calls; it is
  not a retry policy. Distinguish provider failures from invalid model answers and define bounded
  retry accounting. Reuse stored answers only for identical complete inputs/configuration.
- **Review and apply.** Extend calibration's result/history surfaces with grouped candidates and
  split labels, and expose final-test results after selection is frozen. Reuse its explicit Apply
  flow for the selected, completed candidate. Its current method writes the whole prompt/options
  snapshot: check the saved judge against the session's starting snapshot before applying, so
  intervening edits are not overwritten. The existing `stale?` flag compares the candidate to the
  saved judge and is expected to be true for a tuned prompt; it is not that conflict check.

Custom Ruby still owns proposal quality, candidate selection and stopping logic. All backends
need the adaptations above; adopting GEPA does not supply Quepid's dataset or promotion contract.

**Python alternative.** A standalone GEPA worker can submit candidate text and permitted split
ids through an authenticated API over the same session/calibration runner, then retrieve run
results and training feedback. Ruby keeps provider credentials, rendering, parsing and the final
test; the worker returns a candidate and provenance. The JSON API would be new, but the run
storage and lifecycle would be shared. Existing HTML calibration actions are not that worker
API. Pin the library/API version before implementing it; do not reproduce Ruby's YAML/provider
payloads or create a separate Python evaluation store. This is a client of the shared external
control boundary in [ADR 0004](./0004-relevance-factory.md), not a second orchestration interface.

### D3 — The metric is agreement with the chosen reference, held out by query

- **Labels:** use only the explicitly selected reference's on-scale, rateable ratings; exclude
  `judge_later`, `unrateable` and missing labels. A reference may be human or AI. Preserve the
  existing no-self-calibration guard, and never feed candidate predictions back as reference
  labels. For an explicitly selected consensus, freeze the contributor set and aggregation rule,
  and set aside pairs where contributors disagree by more than one scale step. Do not silently
  pool human and AI ratings or switch references during a session.
- **Population:** reference labels obtained only through escalation describe the selected hard
  cases. They can support an explicitly scoped hard-case evaluation, but a book-wide claim needs
  a held-out sample drawn independently of that escalation selection. Record the source and
  sampling policy rather than treating every expensive-AI label as representative of the book.
- **Per-example metric:** 1 for an exact match, partial credit for a rating one step away on the
  `JudgeScale`, 0 otherwise. An invalid or unrateable model answer scores 0. Average over **all
  eligible pairs in the split**, not just rateable answers. Incomplete or infrastructure-failed
  evaluations cannot win; the retry/failure policy must be fixed before a run.
- **Shared reporting:** reuse `JudgeAgreement`'s ordinal Krippendorff's alpha, exact/within-one
  shares and confusion matrix, alongside the all-pair search score and valid/invalid counts.
  This proposed alignment replaces the earlier quadratic-weighted Cohen's kappa choice; the
  statistics are not interchangeable. Calibration excludes unrateable answers from agreement,
  so label its denominator explicitly and do not use that valid-only figure as the search
  objective. Aggregate predictions across child batches before computing agreement; do not
  average their alphas.
- **Split by query, not by pair**, roughly 60/20/20 train/validation/test, so a query's documents
  never appear on both sides. Few-shot demonstrations come from the train split only.
- **Selection:** rank candidates by the mean per-example validation score, with all-pair exact
  agreement as a tie-breaker. Keep test examples and labels out of proposal generation and
  selection, including when comparing tuner implementations.
- **Rank diagnostics:** reuse `CalibrationScoreImpact` for complete top-list samples, using
  frozen query/position data and reporting omitted queries. Its nDCG shifts and Kendall's tau
  describe query-score effects; they do not replace the reference-agreement objective.

**Rationale.** Shared reports let people compare manual and automatic trials using the same
calibration vocabulary and implementation. Counting invalid answers in the search denominator
prevents apparent improvement merely by abstaining on difficult pairs. Splitting by query stops
a demonstration about a query from leaking into the test set, which would inflate the score.

### D4 — Respect the existing prompt budget

`system_prompt` is limited to 4000 characters, and document fields can be large. The tuner
gets a length budget below that limit, which caps the number of demonstrations and truncates
their fields. Raising the column limit is a separate decision, to make only if measurement shows
the budget is what holds quality back.

### D5 — Every auto-tuned prompt carries its provenance

The parent session records the reference identity/type and label source, dataset/split manifest,
seed, proposer model, tuner/version/settings, metric version, call usage and baseline/selected
run ids. For AI reference labels, retain the actual generating model/prompt/options snapshot
where available; mark unknown historical settings rather than inferring them from the judge's
current configuration. Reuse calibration's prompt/options snapshots and answer rows for the
original prompt, candidates and predictions; extend sample provenance for frozen inputs and
contributing reference labels. Store the final report and link the applied prompt to its session
instead of duplicating trial data in `judge_options` or in the prompt itself. Replay and
retention follow the deletion/invalidation contract in D2. A prompt
claimed as "auto-tuned" must be traceable to the measurement that justified it.

### D6 — Chat-model target judges only

OpenAI, Azure OpenAI, Anthropic and other OpenAI-compatible target providers are in scope. Jev
cannot be the prompt-tuning target: it takes per-question criteria built from the scale, not
free instructions. It can supply reference ratings for another judge. Manual Jev confidence
tuning remains separate; this ADR changes the target's prompt only.

---

## 4. Consequences

**Positive**

- Teams keep one calibration history and set of reports for manual and automatic experiments.
  #1827 already supplies useful measurements even when auto-tuning is never run.
- Auto-tuning adds candidate search and held-out verification to calibration's manual trials.
- An expensive reference can label a dataset once, after which cheaper target judges can be
  tuned and compared against those same labels without recurring reference calls at runtime.
- The judging runtime stays unchanged. A saved prompt still changes judgements, so promotion
  requires the held-out comparison and review in D2.

**Negative**

- It needs a book with enough reference judgements. Small books will overfit, and the tool has to
  refuse or warn below a minimum test-set size rather than report a meaningless gain.
- Auto-tuning costs reference acquisition when needed, proposal calls and evaluation calls,
  including the final baseline comparison.
  The budget must cover all of them, not only a library's metric-call counter.
- A prompt auto-tuned for one book, target model and reference is specific to that combination.
  Changing any of them needs a fresh measurement.
- The target may reproduce systematic reference errors. High reference agreement is useful for
  replacing that reference's behavior, but does not establish relevance correctness on its own.
- Custom search may use more calls or find weaker prompts than GEPA. Reusing the evaluator makes
  that measurable and allows the search implementation to be replaced.
- A Python worker adds deployment, authentication and cancellation boundaries. A Ruby library
  avoids that process boundary but adds dependencies and integration contracts.
- Reuse is not zero work: calibration's live inputs and valid-only agreement need the additive
  contracts in D2/D3; consensus and calibration-answer reference sources need further extensions.

**Neutral / accepted**

- Demonstrations embed real documents from the book in the prompt, and therefore in every request
  the judge sends to its provider; the prompt is no longer generic. Auto-tuning also sends
  training examples, ratings and feedback to the proposal model. Using a different provider for
  proposals introduces another data recipient and must be an explicit run configuration.

---

## 5. Open questions

- Is the first entry point a Ruby task using calibration sessions or an "Auto-tune this judge"
  action on the Calibration page? Both should use the same coordinator and run records.
- Is the existing Ruby GEPA core's DSPy.rb dependency acceptable for a later comparison, and
  does its custom evaluator integrate cleanly on Quepid's Ruby/container versions?
- What is the minimum number of reference-labelled queries before the tool will run? A provisional
  floor is 50 queries in the test split, not calibration's existing minimum of 30 compared pairs
  or 10 queries for its diagnostics. Resolve that floor against available labels and run cost.
- Before implementation, fix the on-scale consensus/tie rule, one-step credit, treatment of
  infrastructure failures, and minimum gain/uncertainty required for promotion. Preserve
  `JudgeAgreement`'s undefined/insufficient-alpha behavior; a missing alpha is not a gain.
- Should the tuner also be allowed to change *what* the judge sees, such as which document
  fields go into `user_prompt`? That would change the seam's rendering and need its own ADR.

## 6. Revisit triggers

- Auto-tuned prompts consistently hit the 4000-character limit and the budget is measured to be
  the bottleneck: revisit D4.
- A provider adds native support for prompt auto-tuning or reusable prompt objects: reconsider
  D1's "plain text only".
- Custom search needs increasingly complex selection logic, or GEPA produces better validation
  results at the same total budget: revisit D2 before building a general-purpose tuning framework.
- Auto-tuned prompts fail to beat the baseline on most books: record that result, and treat it as a
  reason to keep the measurement harness and drop the tuner.

## 7. Relevance Factory alignment

[ADR 0004 — Relevance Factory orchestration](./0004-relevance-factory.md) defines the separate
project for external systems and AI agents to observe and control this workflow. Auto-tuning
must establish the shared commands, durable state, retry/revision semantics and structured
results specified there; the external transports and delegated access ship separately.
