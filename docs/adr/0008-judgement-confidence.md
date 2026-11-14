# ADR 0008 — Judgement confidence: storing how sure a judge was, for any judge

- **Status:** Proposed
- **Date:** 2026-11-14
- **Affects (when built):** `judgements` table (a migration), `app/models/judgement.rb`,
  `app/services/llm_judge_adapters/` (`base.rb`, `jev.rb`; `anthropic.rb` and `open_ai.rb` through
  the base), `app/services/llm_service.rb` (error rescues), `app/services/book_combiner.rb`,
  `app/services/book_importer.rb`, `app/controllers/api/v1/judgements_controller.rb`,
  `app/views/api/v1/judgements/_judgement.json.jbuilder`,
  `app/views/api/v1/export/books/_judgements.json.jbuilder`
- **Builds on:** [ADR 0001](./0001-llm-judge-provider-architecture.md) (the adapter seam, Jev),
  `docs/todo/escalating_judges.md` S2 and §5.3. This ADR is the confidence part of S2. S2's other
  parts, the finalizer's reason and token usage, stay there.
- **Consumers:** ADR 0007, configurable judgement merging
  ([frutik/quepid#15](https://github.com/frutik/quepid/pull/15)), which weights by confidence; the
  escalation threshold (`escalating_judges.md` §5.2–5.3); judge calibration
  (`docs/todo/judge_agreement_and_calibration.md`)

---

## 1. Context

Some judges say how sure they are:

- **Jev** returns a `confidence` with every answer, from 0 to 1: how concentrated its probability
  distribution is.
- **A custom trained model**, such as a fine-tuned classifier or a cross-encoder served behind its
  own endpoint, typically returns a class probability for the grade it picked.
- **A team's offline model** can post judgements through `api/v1/judgements`, which accepts a
  `user_id`, or import them into a book. Either way it may know its confidence.

Quepid throws the number away. `LlmJudgeAdapters::Jev#apply_response` reads `confidence`, uses it
for the `jev_min_confidence` floor, and writes it into the explanation text
(`"Jev rated 1 ("Relevant") -- raw score 0.57 of 0-1, confidence 0.35. Distribution: ..."`).
Nothing else can read it. `escalating_judges.md` §5.3 lists what that costs:

- the escalation threshold cannot be chosen from data ("how many pairs would escalate at 0.4?");
- confidence cannot be plotted against agreement with people, so it cannot be checked whether it
  means anything;
- why a pair escalated can only be audited by parsing prose.

ADR 0007 adds another consumer: merging that weights each judgement by its confidence, with judges
that report none weighted 1. That only works if "reported none" and "reported 1.0" can be told
apart.

## 2. Decision

**Store a nullable `confidence` on every judgement. It describes the answer that produced the
row's current rating, and any source of judgements may fill it.**

### 2.1 The field

- `judgements.confidence`: a nullable float in [0, 1]. The model validates the range, with
  `allow_nil`. A database check constraint backs it up where MySQL supports one.
- **NULL means the judge reported no confidence.** NULL never means 0, and it is never stored as 1.
  People, chat-LLM judges and imports without the field leave it NULL. Treating NULL as weight 1 is
  a reader's decision (ADR 0007), not a stored fact, so calibration can still tell a person from a
  model that answered 1.0.
- The meaning is whatever the source reports: concentration for Jev, a class probability for a
  classifier. Different sources are not on one scale (§4).
- No source column. The judge (`user_id`) and its connection already say what produced the row.

### 2.2 One rule for every write path: a confidence travels with its rating

A confidence is only true of the answer it came with. Every path that writes a rating either sets
the confidence or clears it. Each write path in the code today, and what it does:

| Path | Writes | Confidence |
|---|---|---|
| Adapters' `apply_response` (`base`, `anthropic`, `open_ai`, `jev`) | AI judge's rating | **always assigned**: the reported value, or nil. `Base` assigns nil, and an adapter that has a value overrides it. A judge whose connection moves from Jev to a chat model must not keep the old Jev value on a re-run that happens to give the same rating. |
| `LlmService#perform_safe_judgement` rescues | unrateable, with a `BOOM` explanation | cleared |
| `RunJudgeJudyJob`, `AiJudges::WizardController` (preview) | through the adapter | as the adapter set it |
| `JudgementFromRatingJob` (rating made in a case) | the current user's judgement | nil (cleared by the model rule below) |
| `JudgementsController`, `BulkJudgeController` (judging UI) | the current user's judgement | nil (cleared by the model rule below) |
| `api/v1/judgements` create and update | any user's judgement | accepted as a parameter. Changing `rating` without sending `confidence` clears it. |
| `BookImporter` | any user's judgement | `:confidence` joins `ASSIGNABLE_JUDGEMENT_KEYS` |
| `BookCombiner#merge_judgement` | copies, or averages two ratings of one judge | copied when the rating is copied. Cleared when two ratings are averaged, because the average is nobody's answer. |

Behind the table sits one rule on the model, so a path added later cannot leak a stale value: **when
a save changes `rating` to a non-nil value and does not assign `confidence`, the confidence is
cleared.** The adapters do not rely on it, because a re-run can return the same rating with a new
confidence, or with none.

### 2.3 Unrateable judgements keep their confidence

`mark_unrateable` clears the rating, and the model rule above only fires on a **non-nil** rating,
so a judgement that was made unrateable keeps the confidence it was rejected for. That is the data
the escalation threshold is chosen from (`escalating_judges.md` §5.2): the confidences *below* the
floor matter most. The explanation text keeps its current wording, which
`Judgement#unrateable_reason` still parses. Moving that method onto the column is a later cleanup.

### 2.4 Parsing is strict at the trust boundary

- **From a model's response:** read through the adapter's existing `numeric_value`, never `to_f`.
  A missing or non-numeric confidence becomes nil, not 0.0. A 0.0 would weigh a judgement out of
  ADR 0007's merge. A value outside [0, 1] is stored as nil, with a note in the explanation. **The
  rating is kept**, because a valid rating should not fail over a bad side value. Today's
  `below_confidence_floor?` uses `to_f`, which turns a missing confidence into 0 and so below any
  floor. It moves to the same parse.
- **From an import or the API:** a value outside [0, 1] or a non-numeric one makes the judgement
  invalid, the same way an invalid rating does today. `BookImporter` validates candidates with
  `judgement.valid?`. The caller sent the number on purpose, so a bad one is the caller's error to
  fix, not something to drop silently.

### 2.5 Round trip

`confidence` is added to the judgement JSON (`api/v1/judgements/_judgement.json.jbuilder`) and to
the book export (`api/v1/export/books/_judgements.json.jbuilder`). With `BookImporter` accepting it,
exporting a book and importing it again keeps every confidence.

### 2.6 Backfill

Existing Jev judgements carry their confidence in the explanation. A one-off backfill reads it.

- **Match on the text, not on the judge's current provider.** A judge can change connection, so
  older rows may be Jev's while the judge no longer is.
- **The text must start with** `Jev rated` and contain `confidence <number>.` For an escalated
  judgement (`escalated_from_judgement_id` set), read only what follows the escalation note
  (`RunJudgeJudyJob#escalation_note`, separated by a blank line), as
  `Judgement#unrateable_reason` already does. The note quotes the *source* judgement, whose
  confidence is not this row's.
- `confidence unknown` (what `formatted(nil)` prints) and anything that does not parse stay NULL.

## 3. Alternatives considered

- **Store 1 for judges that report nothing.** This is simpler for readers, but it makes "a person
  said 3" and "a model said 3 and was certain" the same row. Calibration and ADR 0007's script
  contract both need the difference.
- **A JSON blob (`judge_metadata`) instead of a column.** It would hold confidence, distribution,
  tokens and reason in one place. But confidence is filtered on (escalation threshold),
  aggregated on (calibration) and read on every merge, so it gets a typed, validated column. A blob
  can come later for things nothing queries.
- **Keep parsing the explanation.** This is the stopgap S2 already called a stopgap. Explanations
  are for people, they are edited, and escalation already prefixes them.
- **Store Jev's probability distribution now.** ADR 0007 lists pooling distributions as future
  work. Deferred, because nothing reads it yet, and storing it needs its own rule: Jev keys
  `probabilities` by level index for `score` answers and by value for `choice` answers. The rule is
  to convert to scale values and validate that they sum to 1. That belongs with the feature that
  reads it. The explanation keeps the distribution in the meantime.

## 4. Consequences

- Escalation thresholds, calibration plots and ADR 0007's weighting all read one column instead of
  prose.
- A custom trained model gets a confidence path with no change to merging or storage: its adapter
  assigns the value. Teams with offline models pass `confidence` through the API or an import.
- **Confidences from different sources are not comparable.** A stored 0.7 from Jev and 0.7 from a
  classifier mean different things, and classifier probabilities are often overconfident unless the
  model was calibrated. The column records what was reported. Making sources comparable is the
  calibration work.
- **Jev's confidence is noisy.** It varies between identical calls (`escalating_judges.md` §5.6).
  Storing it makes that visible, which is useful, but it does not make the value stable.
- The model rule (§2.2) means an API client that updates a rating must resend the confidence if it
  is still true. That is intended and is documented in the API.
- **Not here:** making a confidence change trigger the case-rating resync. Its only reader for
  ratings is ADR 0007's weighted merge, so 0007 adds `confidence` to `Judgement#sync_case_ratings`'s
  watched columns. Doing it here would resync cases on every Jev re-run for no reader.
- **Not here:** a confidence floor shared by all judges (`jev_min_confidence` stays Jev's), token
  usage, and the finalizer's reason enum. These stay with `escalating_judges.md`.
