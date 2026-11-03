# ADR 0002 — Judge calibration and manual tuning against a reference

- **Status:** Proposed — implemented in open [PR #1827][pr], not yet merged at inspection.
- **Date:** 2026-10-25
- **Implementation inspected:** `024da32e70e9b857ad86072fadf64ea82e960810`.
- **Sources:** the PR's [agreement research][research] and [calibration plan][plan]. Where those
  documents describe future work, this record follows the implementation at the inspected head.
- **Affects:** book calibration UI, calibration samples/runs/answers, `CalibrationRunJob`,
  `JudgeAgreement` and `CalibrationScoreImpact`.
- **Related:** [ADR 0001](./0001-llm-judge-provider-architecture.md) supplies the judging path;
  [ADR 0003](./0003-ai-judge-prompt-auto-tuning.md) extends manual tuning with auto-tuning;
  [ADR 0004](./0004-relevance-factory.md) covers external orchestration.

## 1. Context

A shared relevance scale does not ensure that judges apply the same decision model: they can
map the same query/document pair to different grades, use some grades differently, or lean
consistently higher or lower. Counting judgements does not reveal those differences. The
[research document][research] motivates measuring agreement, its direction and its consequences
for search evaluation before trusting a judge or a mixture of judges.

Calibration therefore answers: **if this AI judge rated the pairs that reference rated, how
often would they agree, where would they differ, and how would the query scores change?**
It supports deciding whether to use a judge even without changing its settings. Manual tuning
adds the next step: edit settings, rerun the same sample, compare, and explicitly apply them.

This is **inter-judge calibration**, assessing how judges make relevance decisions. It does not
fit a statistical model of their decisions, remap grades or establish that a reported confidence
is a calibrated probability. Agreement with a chosen reference is not proof of correctness.

## 2. Decisions implemented in #1827

### D1 — Keep calibration trials separate from production judgements

Use four tables: `calibration_samples` identifies the book, reference and sampling unit;
`calibration_sample_pairs` stores pair ids and reference ratings at the draw; `calibration_runs`
records each trial and its prompt/options snapshot; `calibration_answers` stores its responses.
Several runs can reuse one sample. [Schema][schema]

Ordinary judgements allow one row per judge/pair, feed rating aggregation and are subject to the
judging queue's three-judgement cap. Reusing them would prevent repeated trials, change case
scores before evaluation, or exclude the human-rated pairs most useful as references. The
research plan's earlier proposal to write ordinary judgements is replaced by this separation.
Calibration answers do not change ratings, case scores, the judging queue or Judge Activity.

### D2 — Compare one AI judge with one reference on a deliberate sample

The reference is one identified human or AI judge with eligible judgements on the book. An
advanced, expensive LLM can be the reference, but the implementation does not require or certify
that it is stronger. Human consensus is not implemented. The target is any AI judge visible to
the user, whether assigned to this book or not; self-calibration is rejected. Book access and
judge visibility use the existing application permissions. [Controller][controller]

Only the reference's rateable, on-scale judgements within the book's `rank_depth` are eligible.
Anonymous, unrateable, judge-later and off-scale judgements cannot supply reference labels.
There are two sampling modes:

- **Pairs:** draw uniformly from eligible pairs, without production selection's position weighting
  or preference for pairs with few judgements. New samples accept 30–500 pairs, bounded by
  availability; the default is 50.
- **Queries:** draw uniformly from queries whose entire available top list the reference rated.
  Take up to ten positioned pairs per query, ordered by lowest position within `rank_depth`.
  New samples accept 10–50 queries, bounded by availability; the default is 20. This mode is
  preferred by the dialog when the reference has enough complete lists.

Freeze pair membership and reference ratings for comparisons across runs, and report when the
reference's current ratings differ. A target's existing judgement and the three-judgement cap
do not prevent sampling. Uniform sampling describes the **eligible reference-rated population**;
it does not make incomplete or escalation-selected reference coverage representative of the
whole book. Query sampling also clusters observations by query. [Sample][sample]

### D3 — Evaluate through the production judging path, without saving judgements

`CalibrationRunJob` builds an unsaved judgement for each unanswered pair and calls
`LlmService#perform_safe_judgement` and `JudgementFinalizer`. It uses an in-memory copy of the
judge with the run's saved prompt/options, then persists only a calibration answer. This keeps
request rendering and answer interpretation aligned with real judging. [Job][job], [run][run]

Runs have queued, running, done, cancelled and failed states. SolidQueue limits concurrency to
one job per run. Cancellation is checked between pairs; an in-flight provider call may finish.
Resume processes only pairs without an answer, retaining already recorded errors and unrateable
answers. A run with provider-error answers on more than half the sample ends as failed; ordinary
unrateable answers are not themselves provider failures. Turbo Streams update progress and
results. These browser updates are not an external orchestration API.

### D4 — Show both grade agreement and query-score impact

`JudgeAgreement` compares the reference and target on valid paired grades. Its headline is
**ordinal Krippendorff's α**: chance-corrected agreement with a distance sensitive to grade
ordering. The research chose it over a κ-only design partly to accommodate wider agreement
analysis later; the implemented service accepts **two judges' paired ratings**, not a book-wide
multi-judge matrix. [Agreement service][agreement]

Report exact agreement, within one scale step, mean signed numeric grade difference
(target minus reference), a confusion matrix with pair/explanation drill-down, and both grade
distributions. Show α only with at least 30 compared pairs and nonzero expected disagreement.
Unrateable answers are counted separately; off-scale values are skipped and counted rather than
rounded. Percentages describe valid compared pairs, so coverage must be read alongside them.

For query samples, `CalibrationScoreImpact` computes **nDCG@10 with linear gain** twice in the
stored result order, using each judge's grades. Report score differences and **Kendall's τ-b
across the per-query scores**, with no τ below ten complete queries or when undefined. Queries
with missing or unrateable target answers are excluded and counted. This measures whether the
judges order queries similarly by score; it does not compare the ranking of search systems or
rerank documents. It is a diagnostic using a fixed metric, not the book's selected scorer.
[Score-impact service][impact]

### D5 — Make manual tuning a sequence of trials with explicit Apply

The book's Judge Calibration tab and Judge Activity shortcut lead to the same workflow.
**Tune and run again** creates a new run on the same sample, with prompt/instructions and, for
TypeSafe Jev, minimum-confidence overrides. Trying settings leaves the saved judge unchanged.
The result page compares that judge's runs on the sample with their settings and figures.

**Apply these settings** explicitly writes the selected run's prompt and full options snapshot
to the judge. It does not copy trial answers into production judgements. A settings-difference
notice compares the saved judge with the run snapshot; it can mean either a later edit or an
intentional tuning trial. The person selects the settings to apply: #1827 does not search for
candidates or automatically decide that a run is better. [Run][run], [controller][controller]

## 3. Consequences and current limits

The separate sample/run/answer model enables comparison without affecting production ratings,
at the cost of additional storage and provider calls. Repeated runs can isolate a settings
change when other inputs remain stable, but the implemented record has these limits:

- **Partial snapshots.** Reference grades and target prompt/options are saved; document fields,
  query text, positions, scale labels and provider behaviour are not fully frozen. Deletion
  cascades remove dependent records. These are useful trial records, not immutable replay archives.
- **Manual experimentation, not a held-out evaluation protocol.** Repeatedly tuning on the same
  sample can overfit it. There are no train/validation/test splits or automatic acceptance gates.
- **Apply is not conflict-aware promotion.** It writes the snapshot without an expected judge
  revision or a server-side requirement for a successful completed run. The settings-difference
  notice is not protection against overwriting intervening edits.
- **Costs and failures remain visible limitations.** The dialog states the expected pair-call
  count, but there is no session-wide spend/token budget. Resume does not retry recorded failed
  answers. Agreement on the valid subset must not be read as success on every sampled pair.

## 4. Scope beyond this implementation

The source documents also propose book-wide agreement over existing overlap, Judgement Stats
cards, human calibration, consensus references, confidence bands, learned confidence thresholds,
grade correction and alternative rating aggregation. Those are not implemented by #1827.
The answer schema includes a nullable `confidence` field, but the job does not populate it and
there is no confidence analysis. Manually changing Jev's minimum confidence is a different
capability from calibrating that confidence as a probability. The proposed judge-edit shortcut
and filterable calibration list are also not part of the inspected implementation.

Calibration is useful to assess judges before using escalation, but #1827 can ship independently
of escalation and does not automatically gate or configure it.

[ADR 0003](./0003-ai-judge-prompt-auto-tuning.md) is the natural next step after this manual-tuning
workflow: reuse calibration storage and evaluation while adding candidate search, fixed inputs,
held-out evaluation, budgets and guarded Apply. Calibration remains useful independently for
assessing decision models. [ADR 0004](./0004-relevance-factory.md) adds external control and
observability as a separate project, beginning with merging the MCP server in #1847.

This ADR is based on source and test inspection, including tests for judgement isolation,
snapshot execution, sampling, agreement and score calculations, cancel/resume and Apply.
Those tests were read, not rerun for this documentation change. Recheck the merged code before
building the follow-on projects.

[pr]: https://github.com/o19s/quepid/pull/1827
[research]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/docs/todo/judge_agreement_and_calibration.md
[plan]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/docs/todo/judge_calibration.md
[schema]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/db/migrate/20261005150000_create_calibrations.rb
[controller]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/controllers/calibrations_controller.rb
[sample]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/calibration_sample.rb
[job]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/jobs/calibration_run_job.rb
[run]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/models/calibration_run.rb
[agreement]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/services/judge_agreement.rb
[impact]: https://github.com/o19s/quepid/blob/024da32e70e9b857ad86072fadf64ea82e960810/app/services/calibration_score_impact.rb
