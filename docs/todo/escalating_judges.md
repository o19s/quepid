# Escalating judges — a cheap judge that wakes an expensive one

> **Status:** escalation runs. A judge names the judge it wakes (D3); when its run on a book ends,
> the on-call judge judges the pairs it left unrateable as a second pass of its own (D5); both
> judgements are kept and linked (D2); an escalated pair counts once (§4); the book and the
> judgement page show who woke whom and why. Not built: enforcing D4 on the model (S3), and the
> structured reason and confidence and the cost readout (S2, S6). Builds on the provider adapters
> and `JudgementFinalizer` from `docs/adr/0001-llm-judge-provider-architecture.md`.
>
> This one document is both the plan (§§1–4, 6–10) and the risk register (§5): what can go wrong,
> what it would cost to find out, and where the plan changes because of it.
>
> Related: `docs/todo/judge_agreement_and_calibration.md` (sources, and the plan for measuring
> whether judges agree — a prerequisite for trusting a chain).

## 1. The scenario

Jev costs ~$0.042/M input tokens, answers in well under a second, and tells you how sure it is.
GPT-4o costs orders of magnitude more, takes seconds, and tells you nothing about its own
confidence. Judging a 20k-pair book entirely on the expensive judge is the status quo and it is
wasteful, because most pairs are not hard: on the live runs so far, most Jev answers came back at
confidence 0.6–0.9, and only a handful at 0.03–0.13.

So: let the cheap judge do the work, and let it **wake a more expensive colleague** for the pairs
it is not sure about. The expensive judge never judges on its own in that book — it sleeps until
asked.

## 2. What today's code does (checked, not assumed)

### 2.1 Pieces to build on

| Piece | Where | How it serves this |
| --- | --- | --- |
| "Is this answer usable?" for blank and out-of-scale ratings | `JudgementFinalizer` | becomes the escalation trigger |
| A judge saying it is unsure | `jev_min_confidence` (`LlmJudgeAdapters::Jev`) | today the adapter itself marks unrateable, before the finalizer runs; becomes "ask someone else" |
| One adapter per dialect, resolved from the registry | `LlmJudgeAdapters.for` | a run can build a *second* judge's service mid-loop |
| Judge = a `User`; judgements unique per (user, pair) | `judgements` index on `(user_id, query_doc_pair_id)` | two judges can both judge a pair, and neither can judge it twice |
| An AI judge is a row in `users` (STI `AiJudge`) | `AiJudge` | carries the link to the judge it wakes (D3) |
| One run per (book, judge), cancellable | `RunJudgeJudyJob` (`limits_concurrency`, `.cancel`) | the cheap judge's run is already serialized and stoppable |
| The scale belongs to the book | `JudgeScale.for(book)`, `Book#scale_cannot_be_changed_if_judgements_exist` | both judges can be held to the same values |

### 2.2 Facts the design rests on

1. **Unrateable judgements still occupy a slot.** `SelectionStrategy`'s cap counts rows, not
   ratings: `HAVING COUNT(judgements.id) < 3`
   (`SelectionStrategy.random_query_doc_pair_for_multiple_judges`). Nothing filters on `unrateable`.
2. **Scoring ignores them.** `RatingsManager` computes a rating from
   `query_doc_pair.judgements.rateable` only (`RatingsManager#sync_judgements_to_ratings`), so an
   unrateable row never moves a rating.
3. **A pair's rating is combined from whoever rated it, and is not always a mean.**
   `RatingsManager#calculate_rating_from_judgements` averages one or two rateable judgements; at
   three or more it takes the top three and uses their value if they agree, else their minimum.
   So on an escalated pair the rating is the expensive judge's alone, because the cheap judge's
   row is excluded.
4. **`RunJudgeJudyJob` allows one run per (book, judge), not per book.** Its
   `limits_concurrency` key is `run_judge_judy_<book>_<judge>` with `on_conflict: :discard`, so the
   same judge cannot run twice on a book, but two *different* judges can run on one book at once.
5. **Runs can also start without a button.** `QueryDocPair`'s `after_create_commit`
   (`queue_auto_run_ai_judges`) enqueues a run for every `auto_run` judge on the book.
6. **The confidence floor is applied in the Jev adapter, not in `JudgementFinalizer`.** The adapter
   calls `mark_unrateable`, which clears the rating, so the finalizer cannot tell a low-confidence
   answer from a blank one. Errors are caught earlier still, in `LlmService#perform_safe_judgement`.
7. **Many paths write judgements without a run**, and several accept any `user_id`:
   `Api::V1::JudgementsController#create`/`#update`, `JudgementsController#create`, the book merge
   in `BooksController`, `BookImporter`, `JudgementFromRatingJob`.
8. **Scale values are locked once a book has judgements; labels and `scoring_guidelines` are not.**
   `Book#scale_cannot_be_changed_if_judgements_exist` allows changing labels "for the same scale";
   in the UI that happens by picking another scorer with the same values on book edit.

## 3. Decisions

### D1 — Escalate when the answer is not usable, and say why

`JudgementFinalizer` decides blank and out-of-scale; the confidence floor and errors are decided
before it runs (§2.2 fact 6). The finalizer should return the **reason** alongside the judgement
(`:blank`, `:out_of_scale`, `:low_confidence`, `:error`), and the run escalates on it. That needs
the low-confidence and error signals to reach the finalizer: either the adapter records why it
marked the judgement unrateable, or the confidence check moves into the finalizer (which then needs
the confidence value, not just the rating). The reason is not a new column — it is derived, passed
in memory, and ends up in the escalated judgement's explanation.

Which reasons escalate is configurable per chain, defaulting to **all of them**: a cheap judge that
returned nothing usable is exactly the case worth paying for. `:out_of_scale` is arguably the model
being stupid rather than unsure, but the outcome for the book is identical — no rating.

**Built so far:** every unrateable answer escalates (no per-chain choice yet). The reason is not
passed in memory; each path writes it into the explanation — the Jev adapter now notes "[confidence
0.64 is below this judge's minimum confidence of 0.8, so it was marked unrateable]", alongside the
finalizer's existing out-of-scale note and the `BOOM` prefix on errors — and
`Judgement#unrateable_reason` reads it back for the judgement page. The escalated judgement's
explanation opens with "Escalated from Jev, whose answer was unrateable: …", quoting the original;
`unrateable_reason` skips that quote so each judgement reports its own reason. Parsing prose is a
stopgap until S2 stores the reason and the confidence as data.

### D2 — Both judgements are kept, and they say what happened

The cheap judge's row stays (unrateable, with its own numbers), and the woken judge writes its own
row with a rating. The escalated explanation opens with where it came from:

```
Escalated from Jev (confidence 0.13, below this judge's floor of 0.5).
This document addresses the query directly...
```

The link is also structural: the woken judge's row carries `escalated_from_judgement_id` pointing at the
cheap judge's row. The explanation is for people; the column is for queries — "which ratings came
from escalation", "which unrateable rows are still waiting for a second opinion". It is also what
makes D4's enforcement, §4's cap fix and D5's second pass possible.

*Rejected:* overwriting the cheap judge's row with the expensive judge's rating — it attributes an
answer to a model that did not give it, and destroys the evidence of what the escalation cost.
*Rejected:* discarding the cheap judge's row — cheaper on the cap (§4) but it hides how often the
first judge punts, which is the number that tells you whether the arrangement is worth it.
*Rejected:* storing escalated judgements in a separate table. Each judge's judgements are already
separable by `user_id`; the mixing happens when ratings are combined per pair (§5.1), not in
storage. A separate table either feeds ratings (and the mixture is back) or does not (and the
hard pairs have no rating), while every consumer of `judgements` would have to learn about it.

### D3 — The judge names the judge it wakes

Each AI judge has an optional reference to the judge it wakes when it is unsure, and the judgement
carries the escalation link (D2, D4):

```ruby
add_reference :users, :escalates_to, type: :integer, foreign_key: { to_table: :users, on_delete: :nullify }
add_reference :judgements, :escalated_from_judgement, foreign_key: { to_table: :judgements }, null: true
```

A judge that another judge points at is **on call** (sleeping): `AiJudge#on_call?`, derived from
`AiJudge#escalated_from`, so there is no separate flag to keep in step. A chain is followed link by link,
so `A → B → C` works; the last judge in it has nobody to wake.

*Why per judge:* the cheap judge's punting is a property of the judge (its model and its confidence
floor), so who backs it up belongs with it, and it is set once rather than on every book. The cost:
a judge that is on call is on call everywhere it is assigned. To use the same model awake in one
book and on call in another, make two judges (Clone is one click).

*Rejected:* an order and an on-call flag per book–judge assignment (`books_ai_judges.position`,
`escalation_only`). More flexible, but the link that matters — "Jev wakes GPT-4o" — becomes an
indirect consequence of ordering, set again on every book.

**Built.** `users.escalates_to_id`; `AiJudge#escalates_to`, `#escalated_from` and `#on_call?`; the
loop check on save (D6); a **When unsure, wake** select on the AI judge's edit page, offering only
judges the current user can see; the on-call notice on the woken judge's page; and an Escalation
column on the AI Judges list.

### D4 — A sleeping judge never judges except through escalation, enforced on `Judgement`

Guarding the places that start a *run* is not enough, because many paths write a judgement
without a run (§2.2 fact 7). Any new path would be one more door to remember. So the rule lives on
the model, where every path goes through it:

> A judgement whose user is on call must have `escalated_from_judgement` set, and that judgement must be on
> the same pair, by a different user, and unrateable.

Only the escalation code sets `escalated_from_judgement`, so every other path is refused by the same
validation, including paths that do not exist yet.

Scope of the rule:
- **On create, and when `user_id` changes** — not on every save. Putting a judge to sleep must not
  make its existing direct judgements in that book invalid; those stay as they are, and editing
  their rating still works.
- **Persistence only.** The prompt preview (`AiJudges::WizardController`) builds a judgement it
  never saves, so tuning a sleeping judge's prompt keeps working.
- **Book merge and import carry the pair.** The merge copies only rateable judgements, so it would
  bring the escalated row without the unrateable row it points at, and the validation would refuse
  it. Copy the two together and re-point `escalated_from_judgement` at the copy; the importer does the same
  from the exported link.

The run-level guards stay, but as UX rather than enforcement — they turn a validation error into a
clear message:
- `BooksController#run_judge_judy` — refuse an on-call judge with a notice;
- Judgement Stats — render sleeping judges as "on call", with the "Prepare to Judge!" button
  replaced by who wakes them;
- `QueryDocPair#queue_auto_run_ai_judges` — skip sleeping judges (D6 already forbids the
  combination);
- `RunJudgeJudyJob` — stop at the top, so a job queued before the judge was put to sleep ends
  cleanly instead of failing its first save.

`SelectionStrategy` needs no change for this: it selects *pairs for a judge*, and nobody asks it
for pairs on behalf of a sleeping judge.

**Built: the UX guards only.** `BooksController#run_judge_judy` refuses an on-call judge with a
message naming who wakes it, and Judge Activity and Judgement Stats show **On call** in place of
its run buttons. Not built: the `Judgement` validation, the merge/import changes, the
`auto_run` skip and the stop at the top of the job — so the API, a book import or an `auto_run`
assignment can still make an on-call judge judge directly. Merge today copies an escalated rating
as a plain judgement (it copies rateable judgements only, without the link), which is harmless
until the validation exists.

### D5 — Where escalation runs: a second pass, started automatically (settled)

Two designs. Both use D1's reason, D2's rows and link, D4's rule, and the same scale rule (below).

**Inline.** The cheap judge's run judges a pair, finalizes it, and on an unusable result
immediately builds the next judge's service and judges the same pair. Simple, ordered, automatic.

**Two-pass.** Run the cheap judge over the book as today. Then a second run, for the expensive
judge, selects *only the pairs where judge X's judgement is unrateable and nothing has been
escalated from it yet* (`escalated_from_judgement_id` makes that a plain query), and judges them.

| | inline | two-pass |
| --- | --- | --- |
| Cost preview | none | the count of unrateable pairs *is* the preview, before you pay |
| Resumability (§5.5) | none | re-run the second pass any time |
| Failure blast radius | one run, mixed judges | passes fail independently |
| Progress reporting | interleaved, two judges in one counter | one judge per run, as today |
| Latency | expensive calls stall the cheap loop | none |
| Cancellation | one cancel must stop both judges mid-pair | each pass is its own job, cancelled as today |
| Concurrency | escalated calls run under the *cheap* judge's lock (§2.2 fact 4) | each judge under its own lock, as today |
| New machinery | escalation service + budget + depth guard inside the job | one selection predicate + the existing job |
| Fits the deferred batch work | poorly (conditional requests can't be pre-built) | naturally (the second pass is just another batch) |
| Scale the two judges see | identical, same run (below) | labels may have changed between passes (below) |
| Automatic | yes | yes, as built: the end of the first pass queues it |

**Decided: two-pass, started automatically.** It keeps two-pass's resumability, isolation, own
progress and own lock, without needing someone to press a second button. As built: when any
`RunJudgeJudyJob` ends without being cancelled, it queues `RunJudgeJudyJob(book, on_call, nil,
escalating_from_judge: judge)` if that judge wakes somebody and has unrateable judgements in the book that
nothing has been escalated from (`Judgement.awaiting_escalation`). That run takes those judgements
in order instead of asking `SelectionStrategy`, writes each answer with `escalated_from_judgement` set, and
ends the same way — so `A → B → C` follows by itself. There is no budget: the second pass is
bounded by the number of unrateable answers, which is the cost preview two-pass promised, just not
shown before it is spent (§5.4).

The on-call judge's run uses its own `(book, judge)` lock, which discards the enqueue if that judge
is already running on the book. Nothing is lost — the skipped judgements are still waiting, and the
next run of the waking judge that ends there picks them up — but nothing retries on its own either.
A failed escalation (the on-call judge's own answer unrateable) counts as escalated and is not
retried; resetting the on-call judge's unrateable judgements on Judgement Stats deletes them, which
makes those pairs wait again.

**The scale rule, both designs.** The woken judge is held to the book's scale, and
`JudgementFinalizer` checks its answer against that scale, so the expensive judge cannot introduce
an out-of-scale rating. Inline, it gets **the run's `JudgeScale` object**, passed down, not rebuilt:
values are locked once the book has judgements (§2.2 fact 8), and passing the object also pins the
labels and `scoring_guidelines` for the whole run. Two-pass gives that up — the second pass may run
days later, and if someone renames "Relevant" to "Somewhat relevant" in between, the expensive
judge answers a slightly different question on the same numbers. Either record the labels the
first pass used and check them before the second pass, or accept it and say so in the second
pass's completion message. (Label drift affects any book judged over time, not only escalation;
nothing records which wording a judgement was made under.)

**If inline**, the guards required before it is safe to run on a big book:
- `escalation_budget` per run (default ~10% of `number_of_pairs`, minimum 5), after which
  escalation stops and unusable answers simply stay unrateable, with one summary line in the
  completion broadcast;
- a depth limit equal to the chain length, so a chain cannot loop;
- skip a judge that already has a judgement for this pair — the unique index would raise, and the
  code must skip, not rescue;
- stop escalating when the pair has hit the judgement cap (§4);
- re-check cancellation before calling the next judge: the loop polls for its SolidQueue row once
  per pair, and an escalation must not add a second, uncancellable wait.

Inline also leaves the expensive judge's own lock unused: a manual run of the expensive judge on
the same book is not blocked by escalations into it. The duplicate-judgement skip keeps that safe,
but nothing serializes the two.

*Also considered:* an `EscalateJudgementJob` per pair. Better throughput and isolation than inline,
but it scatters a run's progress across jobs and makes "the run is done" a harder question. Worth
revisiting only if escalation becomes common.

### D6 — Cycles and nonsense are refused when configured, not at 3am

On save of a judge (built): it cannot wake itself, and its new target's chain must not lead back to
it — a loop would leave every judge in it on call, so nobody in it would ever judge. Deleting a
woken judge clears the link (`on_delete: :nullify`).

A link says nothing about books, and none is needed: the on-call judge does **not** have to be
assigned to a book to be woken there. The link on the judge is the whole configuration, and the
book shows it instead — `Book#on_call_ai_judges` follows the links out from the book's assigned
judges, and those judges appear in Judge Activity, Judgement Stats and the book's settings with an
**On call** badge, next to "wakes … when unsure" on the judge that wakes them. The judgements land
in the book like any judge's (a judgement belongs to a pair, not to an assignment), and an
unassigned on-call judge's run can be cancelled from the book like an assigned one's. The cost: a
book cannot opt out of a link except by changing the judge, which changes it everywhere. A per-book
switch on the waking judge's assignment would add that if needed.

Still open: an on-call judge that is `auto_run` on a book should be refused or warned about on the
book's settings.

An awake judge that is `auto_run` *and* heads a chain escalates automatically every time pairs are
populated (§2.2 fact 5) — no button press. That is allowed, but the book's settings should say so
next to the checkbox.

## 4. The judgement cap: an escalated pair counts once

`SelectionStrategy` caps a pair at **3 judgements** and counts rows (§2.2 fact 1). An escalated
pair consumes **two** rows — the cheap judge's unrateable one and the expensive judge's answer —
and produces **one** rating. Left alone, a chain-judged book reaches "every pair has three
judgements" — what `moar_judgements_needed?` and the book banners announce — with fewer independent
opinions than a flat book of the same size, and the shortfall lands on the hard pairs, which
deserve more opinions, not fewer.

Options considered:
- accept and document — cheap, but the banners lie a little;
- stop counting unrateable rows toward the cap — rejected: it changes human judging too, and a
  book full of human "unrateable" rows would suddenly ask for more judgements;
- **count logical judgements: don't count a row that another judgement was escalated from.**

**Picked: the third, and built.** Every escalated row points at exactly one row on the same pair, so
`SelectionStrategy::JUDGEMENT_COUNT` is `COUNT(judgements.id) - COUNT(judgements.escalated_from_judgement_id)`
— no subquery.
Human judgements never have an escalation child, so "3 judgements" means exactly what it does
today for human judging; only escalated pairs change, and they count once. Do it in S4, alongside
the escalation itself, so no book is ever judged by a chain under the old arithmetic.
`moar_judgements_needed?` and the banners go through the same counts and need no wording change.

## 5. Risks

### 5.1 The mix of judges becomes correlated with difficulty

Mixed judging is not new. Books already combine several judges per pair — human and AI —
`SelectionStrategy` hands each judge pairs at random up to the cap, so which judges rated a pair
already varies, and `RatingsManager#calculate_rating_from_judgements` combines whoever did (mean,
or the top three's agreed value or minimum). Nothing in the UI or export marks that mixture today
either.

What escalation changes is only *why* a pair got the judge it got: today it is random, with a chain
it is difficulty — easy pairs are rated by the cheap judge, hard ones by the expensive one. That
matters only if the two judges grade differently (§5.2): if the expensive judge is systematically
stricter, the hard pairs drift down together instead of the offset being spread at random. One
narrower consequence: agreement between the cheap judge and a human, measured on the book, covers
the easy pairs only, because the hard ones were handed away.

So this is a calibration question, not a new class of risk, and the answer is §5.2's measurement.
`escalated_from_judgement_id` keeps "which ratings came from escalation" a query, for whenever provenance is
surfaced (S6).

### 5.2 Calibration — same scale, different judges

Knowing *who* rated each pair does not say whether the two judges *mean the same thing* by a
grade. Sharing the book's scale (D5) guarantees the same values and
labels; it does not stop one judge being systematically stricter about "Relevant", or avoiding the
middle grades. Sources and numbers are in `docs/todo/judge_agreement_and_calibration.md` §2; in short:

- **Label-level disagreement is large and its direction is not predictable.** GPT-4o reaches
  κ ≈ 0.31–0.37 against TREC assessors on a 4-grade scale, worst on the middle grades. Bing's GPT-4
  prompt was *stricter* than its assessors; other LLM judges are *more lenient* than humans; and a
  paraphrase of the same prompt moved κ between 0.50 and 0.72. "The expensive judge is stricter"
  cannot be assumed — it has to be measured, per judge and per prompt.
- **Rankings survive disagreement better than scores.** Swapping one judge's set for another's
  keeps the ranking of search configurations largely stable but moves absolute scores. Comparing
  two configurations on a chain-judged book is safer than reading a case's score trend over time.
- **Nobody has studied a difficulty-routed mixture.** Every robustness result swaps whole judgement
  sets or whole topics. A set where the judge was chosen per pair by difficulty is untested — which
  is why measurement is a prerequisite, not a nice-to-have.

Quepid has **no inter-judge agreement measure today**: Judgement Stats shows per-judge counts, and
nothing compares judges on the pairs they share. Measuring that is planned as its own feature in
`docs/todo/judge_agreement_and_calibration.md` (Part II). What a chain needs from it before it is trusted on a real
book:

1. **An agreement figure per pair of judges** — Krippendorff's α (ordinal) — plus a confusion
   matrix that shows the *direction* of any offset (stricter, more lenient, avoids grade 2).
2. **Overlap on random pairs, not escalated ones.** Escalated pairs are hard by construction, and
   carry the cheap judge's *unrateable* row, so they give no overlap at all. The expensive judge
   must also rate a small random sample of the pairs the cheap judge answered confidently (the
   calibration sample in `judge_agreement_and_calibration.md` D6).
3. **Humans as the reference where they exist.** Each AI judge's α and confusion matrix against a
   book's human judgements says whether to trust it at all, and which one to put first. The same
   gold set can tune each judge's prompt first
   (`docs/todo/optimizing_llm_as_judge_query_based_on_golden_dataset.md`).
4. **A threshold chosen from that data.** The confidence floor that triggers escalation should be
   the point where accepting the cheap judge still meets an agreement target — which needs Jev's
   confidence persisted (§5.3), and checked: an LLM's stated confidence is not calibrated until it
   has been compared with labels.

Not in v1: remapping one judge's grades onto the other's through the confusion matrix. It is
possible (Dawid–Skene does exactly that) but opaque, and needs more overlap than a first chain will
have. Show the offset; decide on correction once it has been seen on real books.

A related trap: if a case's search configuration uses the same model family as a judge (a GPT-4o
reranker judged by GPT-4o), the judge is likely to favour it. That is true without escalation, but
escalation makes it likelier the expensive judge is a big general-purpose model — worth a warning
where a judge is assigned.

### 5.3 We route on a number we throw away

The whole feature turns on Jev's `confidence`, and today that number exists only inside the
explanation string (`"... confidence 0.35. Distribution: ..."`). So:

- you cannot ask "how many pairs would escalate at 0.4?" before turning it on;
- you cannot plot confidence against agreement with a human to choose the threshold (§5.2);
- you cannot audit afterwards which pairs escalated and why, except by parsing prose.

A number that is load-bearing for routing and spend should be a column (or a small structured blob
on the judgement), not free text. This is the schema decision to make *before* S4.

The same applies to token usage: providers return it, and `LlmJudgeAdapters` discards it.
Escalation makes "what did this run cost" a question people will actually ask.

### 5.4 Cost control is a guess, and the loudest button is the dangerous one

`judge_all` ("Unleash the Kraken!!") runs the whole book. With a chain behind it, the expensive
judge's exposure is bounded only by how often the cheap judge is unsure — a number nobody can see
in advance (§5.3). The budget (D5) helps, but:

- its default (10% of the run) is invented; the right number is per book and per wallet;
- there is no preview: no "this would have escalated 412 pairs" dry run (two-pass gets this free);
- there is no spend readout afterwards, only a count of escalations;
- a chain whose cheap judge is `auto_run` spends on every population, with nobody pressing anything;
- inline, the expensive judge can be running on its own over the same book while also being woken
  by escalation, and nothing serializes the two.

### 5.5 Inline: a pair that fails escalation is stuck forever

`SelectionStrategy` excludes pairs the judge has already judged. So if the expensive judge is down,
rate-limited, or the budget ran out, the pair keeps its unrateable row and **no later run retries
it** — the cheap judge won't pick it again, and the expensive judge is only reachable through the
cheap judge's escalation. Inline has no resumability. Two-pass does: re-running the second pass
retries exactly the pairs still waiting (D5).

### 5.6 Escalation is nondeterministic, so the book changes shape between runs

Jev's confidence varies between identical calls (the same kind of pair has come back at 0.02 and
at 0.67). Which pairs escalate is a coin toss near the threshold, and re-judging a book produces a
different mixture (§5.1). Fine for throughput; bad for anything that assumes a book is a stable
artefact — comparisons over time, regression tests on scores, "why did this case's score move?".

### 5.7 Configuration can rot underneath a chain

A chain names judges; judges get removed from teams, lose their key, get deleted, or get unassigned
from the book. A chain whose next rung has no API key fails every escalation and burns the budget
doing it. Save-time validation (D6) does not catch drift afterwards, so the run must degrade
honestly: skip the missing rung, say so once in the completion broadcast, and not mark pairs
unrateable in a way that hides it.

### 5.8 It will look like the cheap judge is bad at its job

Judgement Stats shows per-judge counts. After a chain run, Jev's row reads "6 unrateable" and the
expensive judge's "6 rated" — which reads as *Jev is unreliable* rather than *Jev knows when to
ask*. Likewise a judge with no "Prepare to Judge!" button looks broken unless the page says who
wakes it. A labels problem, but it is the first impression everyone will form (S6).

### 5.9 Testing it honestly is awkward

The interesting behaviour only appears when the cheap judge is unsure, which a live model will not
do on demand. Two levers make manual scenarios deterministic (§9): set `jev_min_confidence` to
**1.0** so everything escalates, and to **0** (or blank) so nothing does. Automated tests stub
adapters — which means the thing we are least sure about, how often real confidence falls below a
real threshold on a real corpus, is exactly what the suite cannot tell us (§10).

### 5.10 Smaller things

- **Implicit judgements.** `Book#support_implicit_judgements` decides whether the computed rating
  is rounded (`RatingsManager#sync_judgements_to_ratings`). With one rater per escalated pair,
  rounding is unchanged — but it is worth a test, because "average of one" is the case people
  forget.
- **Same scale, different presentation.** Jev receives the scale as structured criteria and can
  only answer on it; chat models get it described in the prompt and are checked afterwards. A
  judge's own free-text prompt can also contradict the scale ("rate 0–3" on a 0–1 book); the
  finalizer only catches that when an answer is actually out of range.

## 6. Code, in the order it would land

Every step is deployable on its own and changes nothing until a chain is configured. Built in the
order S1, S5, S4, then part of S3 and S6; S2 was skipped in favour of notes in the explanation (D1).

**S1 · The columns.** *Done:* `users.escalates_to_id` with the `AiJudge` associations, `#on_call?`
and the loop check (D3, D6); `judgements.escalated_from_judgement_id` (unique, `on_delete: :nullify`) with
`Judgement#escalated_from_judgement` / `#escalation`.

**S2 · `JudgementFinalizer` reports a reason; confidence is persisted.** `.call` returns a small
result object (`usable?`, `reason`) instead of just the judgement, with the Jev adapter's
confidence floor and `perform_safe_judgement`'s errors feeding it (D1). Jev's confidence (and token
usage, where providers return it) is stored structurally, not only in the explanation (§5.3).
Callers ignore the result for now.
*Verify:* finalizer tests extended; adapter tests for the stored confidence; job and preview tests
unedited.

**S3 · Sleeping judges cannot judge directly** (D4). *Done:* the controller refuses an on-call judge;
Judge Activity and Judgement Stats show it as on call with no run buttons. *Still to do:* the
`Judgement` validation, the merge and import changes that carry an escalated pair together, the
`auto_run` skip, and the stop at the top of the job.
*Verify:* model tests for the validation; API, merge and import tests; manual 12.7.

**S4 · Escalation itself** (D5). *Done*, as the second pass described in D5 rather than a separate
service: `Judgement.awaiting_escalation`, the `escalating_from_judge:` mode of `RunJudgeJudyJob`, and the
logical judgement count in `SelectionStrategy` (§4). Tested with stubbed providers (escalates, links
back, follows a chain, skips a pair the on-call judge already judged, escalates each answer once)
and live on a small book with Jev → an OpenAI judge.

**S5 · Configure the chain in the UI.** *Done:* **When unsure, wake** on the AI judge's edit page,
the on-call notice, the Escalation column on the AI Judges list, "wakes … when unsure" and **On
call** on the book's settings, Judge Activity and Judgement Stats, and on the judgement page a
notice saying why an AI answer was unrateable and where the pair went, linked both ways. *Still to
do:* the `auto_run` note from D6.

**S6 · Tell the operator what it cost and what it means.** *Not started.* Completion broadcast and Judgement
Stats: how many pairs escalated, to whom, how many stayed unrateable because the budget ran out or
a rung was missing (§5.7), and the cost where usage is known. Label the cheap judge's unrateable
count as "handed on" where it was escalated (§5.8). Show where ratings came from escalation (§5.1).

## 7. Tests worth writing beyond the obvious

- A chain where the *second* judge is also unsure: escalates once more if the chain allows, and the
  last word is whatever the final judge said (or unrateable).
- A pair the expensive judge has already judged (from an earlier run): skipped, not raised.
- Budget exhaustion mid-run: the rest of the run completes, unusable answers stay unrateable.
- A sleeping judge queued before it was put to sleep: the job refuses.
- Both rows land with the right attribution, the escalated row's `escalated_from_judgement` points at the
  cheap judge's row, and the escalated explanation names its origin.
- Every non-escalation path refuses a sleeping judge's judgement: the API `create` with its
  `user_id`, an API `update` that moves a judgement onto it, `JudgementsController#create`, and a
  book import row without the link.
- Putting a judge to sleep leaves its existing direct judgements valid and editable.
- A chain whose next judge is not assigned to the book: skipped and reported, not an error.
- Merging a book with an escalated pair copies both rows and re-points the link; merging into a
  book where that judge is awake still works.
- The prompt preview for a sleeping judge still returns a rating.
- Inline: the escalated judge is called with the run's `JudgeScale` instance (the same object the
  cheap judge got). Either design: an out-of-scale answer from it is marked unrateable like any
  other.
- Two-pass: the second pass selects only unrateable judgements of the first judge with nothing
  escalated from them, and re-running it after a partial failure picks up exactly the rest.
- A chain whose next rung has lost its key: skipped and reported, not a budget burned (§5.7).
- An escalated pair under implicit judgements: the "average of one" is rounded correctly (§5.10).

## 8. Open questions

- **Inline or two-pass (D5).** Settled: two-pass, started automatically.
- **Does the on-call judge have to be assigned to the book?** Settled: no — the link is enough, and
  the book shows it (D6).
- **A dropped second pass.** If the on-call judge is already running on the book when the waking
  judge's run ends, that pass is discarded and waits for the next run to end there (D5). A
  recurring sweep, or queueing behind the running job instead of discarding, would close it.
- **"Marked Unrateable" on Judgement Stats** still counts the cheap judge's handed-on answers as
  failures (§5.8).
- **Naming.** Settled: "sleeping" in prose, **on call** in the UI, `escalates_to` / `on_call?` in
  code.
- **Budget.** None is built: the second pass is bounded by the unrateable count. If a budget is
  wanted, it belongs on that pass, and should be per book and visible.
- **Calibration as a gate.** Should a chain be configurable at all before
  the agreement work (`judge_agreement_and_calibration.md` Part II) exists and the two judges have been measured (§5.2)? Or is that a
  warning rather than a gate?
- **Does a human count as a rung?** "No model could rate this" is useful signal, and `judge_later`
  already means "a human should look". Ending the chain there instead of at `unrateable` turns a
  dead end into a work queue.
- **Disagreement as a second trigger.** Two cheap judges that disagree is at least as strong a
  signal as one cheap judge that is unsure. Same machinery, different predicate; out of scope here,
  but D1's reason enum is where it would slot in.
- **Batch (deferred, ADR 0001 D6).** Escalation is conditional, so it cannot be baked into a
  pre-built JSONL file; with two-pass, the second pass is simply another, smaller batch.

## 9. Manual testing

Scenario **12.7 "Escalate from one AI judge to an on-call judge"** in
`docs/manual-testing/12-ai-judges.md` covers configuring the link, how the book shows it, a run
that escalates (Jev's **Minimum confidence** makes it deterministic: **1.0** escalates every pair,
blank escalates none), the judgement page's notices, and refusing to start an on-call judge.

## 10. What to know before building any of it

1. On a real book, what fraction of pairs fall below a candidate threshold? (One cheap-judge run
   plus §5.3's persisted confidence answers this, and it decides whether the feature is worth
   anything at all.)
2. Do the escalated pairs actually get *better* ratings from the expensive judge — measured against
   a human sample — or merely different ones? (§5.2)
3. What does a run cost today, and what would the chain cost? (Needs the usage numbers currently
   discarded.)

If (1) says 2% of pairs escalate, this feature saves almost nothing on a cheap-judge-only workflow
and mostly buys insurance. If it says 40%, the economics are excellent but §5.2 and §4 become
serious and two-pass becomes close to mandatory.
