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
| "Is this answer usable?" in one place | `JudgementFinalizer` | becomes the escalation trigger |
| A judge saying it is unsure | `jev_min_confidence` (`LlmJudgeAdapters::Jev`) | today marks unrateable; becomes "ask someone else" |
| One adapter per dialect, resolved from the registry | `LlmJudgeAdapters.for` | a run can build a *second* judge's service mid-loop |
| Judge = a `User`; judgements unique per (user, pair) | `judgements` index | two judges can both judge a pair, and neither can judge it twice |
| Book ↔ judge assignment as a real table with a PK | `books_ai_judges` | can carry the chain's order without a new table |

## 3. Decisions

### D1 — Escalate when the answer is not usable, and say why

`JudgementFinalizer` already decides blank / out-of-scale / below-confidence. It should return the
**reason** alongside the judgement (`:blank`, `:out_of_scale`, `:low_confidence`, `:error`), and the
run escalates on it. The reason is not a new column — it is derived, passed in memory, and ends up
in the escalated judgement's explanation.

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

*Rejected:* overwriting the cheap judge's row with the expensive judge's rating — it attributes an
answer to a model that did not give it, and destroys the evidence of what the escalation cost.
*Rejected:* discarding the cheap judge's row — cheaper on the cap (§4) but it hides how often the
first judge punts, which is the number that tells you whether the arrangement is worth it.

### D3 — The chain is an explicit, ordered list on the book

Promote `books_ai_judges` to a model (`BookAiJudge`) and add two columns:

```ruby
add_column :books_ai_judges, :position, :integer, null: false, default: 0
add_column :books_ai_judges, :escalation_only, :boolean, null: false, default: false
```

`position` is the explicit order the user asked for; `escalation_only` is the sleeping flag. A run
starts with the lowest-positioned judge that is *not* escalation-only, and each unusable answer
hands the pair to the next judge by position.

*Why per book and not per judge:* the same judge is expensive relative to one book's budget and
cheap relative to another's, and "who backs up whom" is a property of how this book is being
judged. A per-judge `escalate_to` pointer (no migration) is the smaller change but pins one chain
to a judge everywhere it is used, and reads as a linked list rather than the explicit order asked
for. Both columns are additive with safe defaults: every existing book keeps exactly today's
behaviour (all judges awake, order irrelevant because nothing escalates).

### D4 — A sleeping judge is unselectable, enforced where it can actually be reached

Three doors, all of which must be shut:
- `BooksController#run_judge_judy` — refuse an `escalation_only` judge with a clear notice;
- Judgement Stats — render sleeping judges as "on call", with the "Prepare to Judge!" button
  replaced by who wakes them;
- `RunJudgeJudyJob` — guard at the top, so a queued job for a judge that has since been put to
  sleep does not run anyway.

`SelectionStrategy` needs no change: it selects *pairs for a judge*, and nobody asks it for pairs
on behalf of a sleeping judge.

### D5 — Escalation happens inside the same run, with a budget

The run judges a pair, finalizes it, and on an unusable result immediately builds the next judge's
service and judges the same pair. Simple, ordered, and the progress broadcast stays accurate.

The cost of "simple" is that the expensive judge's latency lands in the middle of the cheap judge's
loop. That is acceptable precisely because escalation should be rare — and if it is not rare, the
arrangement is not paying off and you want to notice.

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
escalation target assigned to this book, and a sleeping judge must have somebody above it (a judge
nobody can wake is dead configuration, not a judge).

## 4. The consequence nobody will notice until it bites

`SelectionStrategy` caps a pair at **3 judgements**, and an escalated pair now consumes **2 of
them** — the cheap judge's unrateable row and the expensive judge's answer. A book judged by a
chain therefore reaches "fully judged" sooner in terms of rows, with fewer independent opinions per
pair than the cap implies.

For v1 this is accepted and documented, because the alternative — teaching the cap that an
escalation pair counts as one logical judgement — means either a `judgements.superseded_by` column
or counting only rateable rows, and both change what "3 judgements" means for human judging too.
Worth revisiting once someone actually runs a chain over a full book. `moar_judgements_needed?`
and the book overview banners inherit the same arithmetic, so their wording may need a look.

## 5. Code, in the order it would land

Every step is deployable on its own and changes nothing until a chain is configured.

**S1 · `BookAiJudge` + the two columns.** Model, migration, validations (D6), `Book#judging_chain`
returning assignments ordered by position, `Book#awake_judges` / `#sleeping_judges`. No behaviour:
defaults leave every existing book with one flat, awake list.
*Verify:* model tests; existing book/judge tests unedited.

**S2 · `JudgementFinalizer` reports a reason.** `.call` returns a small result object
(`usable?`, `reason`) instead of just the judgement. Callers ignore it for now.
*Verify:* finalizer tests extended; job and preview tests unedited.

**S3 · Sleeping judges cannot be run directly** (D4). The first visible change: a sleeping judge
loses its "Prepare to Judge!" button and the controller refuses it.
*Verify:* controller test; Judgement Stats rendering test; manual 12.7.

**S4 · `JudgementEscalation` service + the run loop.** Given a book, a judgement, its reason and
the chain, decide the next judge (or nobody) and judge the pair with it; `RunJudgeJudyJob` calls it
and counts escalations against the budget. Inert until a book has a sleeping judge.
*Verify:* service unit tests with stubbed adapters (escalates, stops at the end of the chain,
respects budget/cap/duplicate-judgement); job tests for a two-judge chain; a live run on a small
book with Jev → an OpenAI judge.

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
- Both rows land with the right attribution, and the escalated explanation names its origin.

## 7. Open questions

- **Naming.** "Sleeping" is good in prose; the field wants to be `escalation_only`, and the UI
  probably says **on call**. Worth settling before S1 so the vocabulary matches everywhere.
- **Budget default.** 10% of the run is a guess. It should probably be per book, and visible.
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
Jev's. Then exhaust the budget deliberately and confirm the run finishes cleanly.
