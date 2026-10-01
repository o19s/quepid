# Escalating judges — a cheap judge that wakes an expensive one

> **Status:** plan only, nothing implemented. Builds directly on the provider adapters and
> `JudgementFinalizer` from `docs/adr/0001-llm-judge-provider-architecture.md`.
>
> **Read `docs/todo/judgements-escalation.md` alongside this.** It is the risk register, and it
> argues against this plan's D5 (inline escalation) in favour of a two-pass version. Settle that
> before S4.

## 1. The scenario

Jev costs ~$0.042/M input tokens, answers in well under a second, and tells you how sure it is.
GPT-4o costs orders of magnitude more, takes seconds, and tells you nothing about its own
confidence. Judging a 20k-pair book entirely on the expensive judge is the status quo and it is
wasteful, because most pairs are not hard: on the live runs so far, most Jev answers came back at
confidence 0.6–0.9, and only a handful at 0.03–0.13.

So: let the cheap judge do the work, and let it **wake a more expensive colleague** for the pairs
it is not sure about. The expensive judge never runs on its own — it sleeps until asked.

## 2. What already exists

| Piece | Where | How it serves this |
| --- | --- | --- |
| "Is this answer usable?" for blank and out-of-scale ratings | `JudgementFinalizer` | becomes the escalation trigger |
| A judge saying it is unsure | `jev_min_confidence` (`LlmJudgeAdapters::Jev`) | today the adapter itself marks unrateable, before the finalizer runs; becomes "ask someone else" |
| One adapter per dialect, resolved from the registry | `LlmJudgeAdapters.for` | a run can build a *second* judge's service mid-loop |
| Judge = a `User`; judgements unique per (user, pair) | `judgements` index | two judges can both judge a pair, and neither can judge it twice |
| Book ↔ judge assignment as a model with a PK | `BooksAiJudge` (`books_ai_judges`, already carries `auto_run`) | can carry the chain's order without a new table |
| One run per (book, judge), cancellable | `RunJudgeJudyJob` (`limits_concurrency`, `.cancel`) | the cheap judge's run is already serialized and stoppable |

## 3. Decisions

### D1 — Escalate when the answer is not usable, and say why

`JudgementFinalizer` decides blank and out-of-scale. The confidence floor does **not** live there:
`LlmJudgeAdapters::Jev` applies `jev_min_confidence` itself and calls `mark_unrateable`, which
clears the rating — so by the time the finalizer runs, a low-confidence answer is indistinguishable
from a blank one. Errors are handled before either, in `LlmService#perform_safe_judgement`.

The finalizer should return the **reason** alongside the judgement (`:blank`, `:out_of_scale`,
`:low_confidence`, `:error`), and the run escalates on it. That needs the low-confidence and error
signals to reach the finalizer: either the adapter records why it marked the judgement unrateable,
or the confidence check moves into the finalizer (which then needs the confidence value, not just
the rating). The reason is not a new column — it is derived, passed in memory, and ends up in the
escalated judgement's explanation.

Which reasons escalate is configurable per chain, defaulting to **all of them**: a cheap judge that
returned nothing usable is exactly the case worth paying for. `:out_of_scale` is arguably the model
being stupid rather than unsure, but the outcome for the book is identical — no rating.

### D2 — Both judgements are kept, and they say what happened

The cheap judge's row stays (unrateable, with its own numbers), and the woken judge writes its own
row with a rating. The escalated explanation opens with where it came from:

```
Escalated from Jev (confidence 0.13, below this judge's floor of 0.5).
This document addresses the query directly...
```

The link is also structural: the woken judge's row carries `escalated_from_id` pointing at the
cheap judge's row (D4). The explanation is for people; the column is for queries — "which ratings
came from escalation", "which unrateable rows are still waiting for a second opinion".

*Rejected:* overwriting the cheap judge's row with the expensive judge's rating — it attributes an
answer to a model that did not give it, and destroys the evidence of what the escalation cost.
*Rejected:* discarding the cheap judge's row — cheaper on the cap (§4) but it hides how often the
first judge punts, which is the number that tells you whether the arrangement is worth it.

### D3 — The chain is an explicit, ordered list on the book

`books_ai_judges` is already a model (`BooksAiJudge`, which also carries `auto_run`). Add two
columns there, and the escalation link on `judgements` (D2, D4):

```ruby
add_column :books_ai_judges, :position, :integer, null: false, default: 0
add_column :books_ai_judges, :escalation_only, :boolean, null: false, default: false
add_reference :judgements, :escalated_from, foreign_key: { to_table: :judgements }, null: true
```

`position` is the explicit order the user asked for; `escalation_only` is the sleeping flag. A run
starts with the lowest-positioned judge that is *not* escalation-only, and each unusable answer
hands the pair to the next judge by position.

*Why per book and not per judge:* the same judge is expensive relative to one book's budget and
cheap relative to another's, and "who backs up whom" is a property of how this book is being
judged. A per-judge `escalate_to` pointer (no migration) is the smaller change but pins one chain
to a judge everywhere it is used, and reads as a linked list rather than the explicit order asked
for. All three columns are additive with safe defaults: every existing book keeps exactly today's
behaviour (all judges awake, order irrelevant because nothing escalates).

Sleeping is therefore a property of the **assignment**, not of the judge: the same judge can be on
call in one book and awake in another, and judges directly there.

### D4 — A sleeping judge never judges except through escalation, enforced on `Judgement`

Guarding the places that start a *run* is not enough, because many paths write a judgement
without a run, and several accept any `user_id`: `Api::V1::JudgementsController#create`/`#update`,
`JudgementsController#create`, the book merge in `BooksController`, `BookImporter`, and
`JudgementFromRatingJob`. Any new path would be one more door to remember.

So the rule lives on the model, where every path goes through it:

> A judgement whose user is `escalation_only` on the pair's book must have `escalated_from` set,
> and that judgement must be on the same pair, by a different user, and unrateable.

Only the escalation service sets `escalated_from`, so every other path is refused by the same
validation, including paths that do not exist yet.

Scope of the rule:
- **On create, and when `user_id` changes** — not on every save. Putting a judge to sleep must not
  make its existing direct judgements in that book invalid; those stay as they are, and editing
  their rating still works.
- **Per book.** The check reads the assignment for the pair's book; the same judge awake in another
  book is unaffected (D3).
- **Persistence only.** The prompt preview (`AiJudges::WizardController`) builds a judgement it
  never saves, so tuning a sleeping judge's prompt keeps working.
- **Book merge and import carry the pair.** The merge copies only rateable judgements, so it would
  bring the escalated row without the unrateable row it points at, and the validation would refuse
  it. Copy the two together and re-point `escalated_from` at the copy; the importer does the same
  from the exported link.

The run-level guards stay, but as UX rather than enforcement — they turn a validation error into a
clear message:
- `BooksController#run_judge_judy` — refuse an `escalation_only` judge with a notice;
- Judgement Stats — render sleeping judges as "on call", with the "Prepare to Judge!" button
  replaced by who wakes them;
- `QueryDocPair#queue_auto_run_ai_judges` — skip sleeping judges (D6 already forbids the
  combination);
- `RunJudgeJudyJob` — stop at the top, so a job queued before the judge was put to sleep ends
  cleanly instead of failing its first save.

`SelectionStrategy` needs no change: it selects *pairs for a judge*, and nobody asks it for pairs
on behalf of a sleeping judge.

### D5 — Escalation happens inside the same run, with a budget

The run judges a pair, finalizes it, and on an unusable result immediately builds the next judge's
service and judges the same pair. Simple, ordered, and the progress broadcast stays accurate.

The woken judge is held to **the run's scale** — the same `JudgeScale` object the cheap judge got,
passed down, not rebuilt. The scale belongs to the book (`JudgeScale.for(book)`), and
`Book#scale_cannot_be_changed_if_judgements_exist` locks its values once any judgement exists, so
both judges rate on the same values. Passing the object rather than rebuilding it also pins the
labels and `scoring_guidelines`, which stay editable, for the whole run. `JudgementFinalizer` then
checks the escalated judgement against that same scale, so the expensive judge cannot introduce an
out-of-scale rating either.

The cost of "simple" is that the expensive judge's latency lands in the middle of the cheap judge's
loop. That is acceptable precisely because escalation should be rare — and if it is not rare, the
arrangement is not paying off and you want to notice.

Two consequences of running inside the cheap judge's job:
- `RunJudgeJudyJob`'s concurrency key is per (book, judge), so escalated calls run under the
  *cheap* judge's key. A manual run of the expensive judge on the same book is not blocked by it.
  The duplicate-judgement skip below keeps that safe, but nothing serializes the two.
- The loop's cancellation check (`.cancel` destroys the job's SolidQueue row; the loop polls for it)
  runs once per pair. An escalation must not add a second, uncancellable wait — check again before
  calling the next judge.

Guards, all required before this is safe to run on a big book:
- `escalation_budget` per run (default ~10% of `number_of_pairs`, minimum 5), after which
  escalation stops and unusable answers simply stay unrateable, with one summary line in the
  completion broadcast;
- a depth limit equal to the chain length, so a chain cannot loop;
- skip a judge that already has a judgement for this pair (the unique index would raise);
- stop escalating when the pair has hit the 3-judgement cap (§4).

*Alternative, deliberately not first:* enqueue an `EscalateJudgementJob` per pair. Better
throughput and isolation, but it scatters a run's progress across jobs and makes "the run is done"
a harder question than it is today. Worth revisiting if escalation ever becomes common.

### D6 — Cycles and nonsense are refused when configured, not at 3am

Validation on the book's judge list: positions unique, at least one non-sleeping judge, every
escalation target assigned to this book, a sleeping judge must have somebody above it (a judge
nobody can wake is dead configuration, not a judge), and a sleeping judge cannot be `auto_run`.

An awake judge that is `auto_run` *and* heads a chain escalates automatically every time pairs are
populated — no button press. That is allowed, but the book's settings should say so next to the
checkbox.

## 4. The consequence nobody will notice until it bites

`SelectionStrategy` caps a pair at **3 judgements**, and an escalated pair now consumes **2 of
them** — the cheap judge's unrateable row and the expensive judge's answer. A book judged by a
chain therefore reaches "fully judged" sooner in terms of rows, with fewer independent opinions per
pair than the cap implies.

`escalated_from_id` (D4) makes the fix cheap: the cap can count **logical** judgements by not
counting a row that another judgement was escalated from. Human judgements never have an
escalation child, so "3 judgements" means exactly what it does today for human judging; only
escalated pairs change, and they count once. Counting only rateable rows was the other option, and
it is rejected because it does change human judging — a book full of human "unrateable" rows
would suddenly ask for more.

Do it in S4, alongside the escalation itself, so no book is ever judged by a chain under the old
arithmetic. `moar_judgements_needed?` and the book overview banners go through the same counts and
need no wording change once they do.

## 5. Code, in the order it would land

Every step is deployable on its own and changes nothing until a chain is configured.

**S1 · The columns.** `position` and `escalation_only` on `BooksAiJudge`, `escalated_from_id` on
`judgements` (with `belongs_to :escalated_from, optional: true` and the reverse `has_one`).
Validations (D6), `Book#judging_chain` returning assignments ordered by position,
`Book#awake_judges` / `#sleeping_judges`. No behaviour: defaults leave every existing book with one
flat, awake list.
*Verify:* model tests; existing book/judge tests unedited.

**S2 · `JudgementFinalizer` reports a reason.** `.call` returns a small result object
(`usable?`, `reason`) instead of just the judgement, with the Jev adapter's confidence floor and
`perform_safe_judgement`'s errors feeding it (D1). Callers ignore it for now.
*Verify:* finalizer tests extended; job and preview tests unedited.

**S3 · Sleeping judges cannot judge directly** (D4). The `Judgement` validation, the merge and
import changes that carry an escalated pair together, and the run-level guards. The first visible
change: a sleeping judge loses its "Prepare to Judge!" button and the controller refuses it.
*Verify:* model tests for the validation; API, merge and import tests; controller test; Judgement
Stats rendering test; manual 12.7.

**S4 · `JudgementEscalation` service + the run loop.** Given a book, a judgement, its reason and
the chain, decide the next judge (or nobody) and judge the pair with it, setting `escalated_from`;
`RunJudgeJudyJob` calls it and counts escalations against the budget. `SelectionStrategy` counts
logical judgements (§4). Inert until a book has a sleeping judge.
*Verify:* service unit tests with stubbed adapters (escalates, stops at the end of the chain,
respects budget/cap/duplicate-judgement); selection-strategy tests showing an escalated pair counts
once; job tests for a two-judge chain; a live run on a small book with Jev → an OpenAI judge.

**S5 · Configure the chain in the UI.** On the book's settings: drag/select order over the
assigned judges, and an "on call — only judges when escalated to" checkbox per judge, with the
chain shown as `Jev → GPT-4o` on the book overview and Judgement Stats.
*Verify:* manual 12.7 end to end.

**S6 · Tell the operator what it cost.** Completion broadcast and Judgement Stats: how many pairs
escalated, to whom, and how many stayed unrateable because the budget ran out. This is the number
that says whether the chain is worth keeping.

## 6. Tests worth writing beyond the obvious

- A chain where the *second* judge is also unsure: escalates once more if the chain allows, and the
  last word is whatever the final judge said (or unrateable).
- A pair that the expensive judge has already judged (from an earlier run): skipped, not raised.
- Budget exhaustion mid-run: the rest of the run still completes, unusable answers stay unrateable.
- A sleeping judge queued before it was put to sleep: the job refuses.
- Both rows land with the right attribution, the escalated row's `escalated_from` points at the
  cheap judge's row, and the escalated explanation names its origin.
- Every non-escalation path refuses a sleeping judge's judgement: the API `create` with its
  `user_id`, an API `update` that moves a judgement onto it, `JudgementsController#create`, and a
  book import row without the link.
- Putting a judge to sleep leaves its existing direct judgements valid and editable.
- The same judge, awake on a second book, judges that book directly.
- Merging a book with an escalated pair copies both rows and re-points the link; merging into a
  book where that judge is awake still works.
- The prompt preview for a sleeping judge still returns a rating.
- The escalated judge is called with the run's `JudgeScale` instance (the same object the cheap
  judge got), and an out-of-scale answer from it is marked unrateable like any other.

## 7. Open questions

- **Naming.** "Sleeping" is good in prose; the field wants to be `escalation_only`, and the UI
  probably says **on call**. Worth settling before S1 so the vocabulary matches everywhere.
- **Budget default.** 10% of the run is a guess. It should probably be per book, and visible.
- **Calibration between the judges.** Sharing a scale does not mean reading it the same way. A
  chain should not be trusted on a real book until the two judges' agreement and offset have been
  measured on overlapping random pairs (and against humans where the book has them) — see
  `docs/todo/judgements-escalation.md` §1.1 and `docs/todo/judge_calibration_research.md`. Whether
  that measurement is a step of this plan or its own feature is still open.
- **Does a human count as a rung?** "Nobody could judge this" is useful information — the chain
  could end by flagging the pair for a person (`judge_later`) rather than unrateable.
- **Disagreement as a second trigger.** Two cheap judges that disagree is at least as good a signal
  as one cheap judge that is unsure. Same machinery, different predicate; out of scope here, but
  the reason enum in D1 is the place it would slot in.
- **Batch (deferred, ADR 0001 D6).** Escalation is conditional, so it cannot be baked into a
  pre-built JSONL file: with batch, escalations would be collected at ingest and submitted as a
  second, smaller batch. Another reason the batch project stays deferred.

## 8. Manual testing

New scenario **12.7 "A judge that only wakes on escalation"**: configure Jev → an OpenAI judge with
the OpenAI judge on call; confirm it has no "Prepare to Judge!" button; run Jev over a handful of
pairs; confirm the pairs Jev was unsure about carry two judgements — Jev's unrateable one and the
OpenAI judge's rating, whose explanation names the escalation — and that confident pairs carry only
Jev's. Then exhaust the budget deliberately and confirm the run finishes cleanly. Finally, assign
the same OpenAI judge to a second book without putting it on call, and confirm it has a "Prepare
to Judge!" button there and judges directly.
