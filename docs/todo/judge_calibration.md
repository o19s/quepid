# Calibrating a judge — starting it, choosing the pairs, reading the result

> **Status:** K1–K4 built: the Calibration tab, the New calibration dialog and Judge Activity
> shortcut, frozen samples, `CalibrationRunJob`, `JudgeAgreement`, and the results page. Not built:
> the by-confidence table (K5) and the Judgement Stats card (K6). Calibration answers have no
> `confidence` value yet, so the minimum confidence a judge ran with is shown, not broken down. This turns the calibration sample in
> `docs/todo/judge_agreement_and_calibration.md` (D6) into something a person can run from the UI.
> That doc is the *why* and *what to measure* (Part I research; D1–D5 the metric, D7 what to do with
> it). This one is the *how*: where calibration starts, which pairs it uses, where the answers are
> stored, and how the result is shown. It changes one D6 decision (calibration answers are stored
> apart from judgements, see C3).

## 1. What calibration is, in one paragraph

A calibration answers **"if judge B rated the pairs judge A rated, how often would they agree, and
where would they differ?"** Quepid picks a random sample of pairs A has already rated, runs AI
judge B on exactly those pairs, and compares B's answers with A's: an agreement figure, a confusion
matrix, and the disagreeing pairs to read. A is the **reference**; B is the **judge being
calibrated**. The same tool covers every case the research doc names:

| Question | Judge being calibrated (B) | Reference (A) |
|---|---|---|
| Is this AI judge any good on this book? | the AI judge | a human (gold) |
| Can the cheap judge's confident answers be trusted? (escalation) | the expensive, on-call judge | the cheap judge |
| Did my prompt edit help? | the same AI judge, after the edit | the same reference, **same pairs** |
| Should I assign this judge at all? | a team AI judge not yet on the book | a human |

## 2. What today's code gives us, and where it gets in the way

| Piece | Where | Effect on calibration |
|---|---|---|
| A judging run over pairs, cancellable, with live progress | `RunJudgeJudyJob` (`limits_concurrency`, `.cancel`, Turbo broadcasts) | the loop and the progress UI to reuse; its pair source (`SelectionStrategy`) is the wrong one |
| One LLM call that returns a finalized, unsaved judgement | `LlmService#perform_safe_judgement` + `JudgementFinalizer` | calibration calls exactly this, so a calibrated judge sees what it would see in a real run |
| Pair selection | `SelectionStrategy.random_query_doc_pair_for_multiple_judges` | **position-weighted** and **fewest-judgements-first**, which steers judges *away* from each other. Unusable for a sample |
| One judgement per (judge, pair) | unique index `(user_id, query_doc_pair_id)` | a judge can't rate the same pair twice, so **"run again after a prompt edit, on the same pairs" is impossible with ordinary judgements** |
| Three-judgement cap | `SelectionStrategy::JUDGEMENT_COUNT < 3` | pairs humans have already finished are at the cap, and they're the gold set |
| On-call judges refuse manual runs | `BooksController#run_judge_judy` | an on-call judge is exactly the one escalation needs to calibrate (§1, row 2) |
| Jev's confidence | only in the explanation text (`LlmJudgeAdapters::Jev`) | choosing the escalation floor needs it as a number (`escalating_judges.md` §5.3) |
| Charts | `vega` gem, `judge_sparkline_controller.js` | available for the distribution and confidence charts |

## 3. Decisions

### C1 — Where calibration starts

**A "Calibration" page per book**, as a top-level book tab, **Judge Calibration** (marked beta), beside Overview and Judge Overview
(`books/_tabs.html.erb`), at `books/:book_id/calibrations`. It lists the book's calibrations and
has the **New calibration** button. Two shortcuts open the same dialog pre-filled:

- **Judge Activity** (book overview): a small calibrate icon on each AI judge's row, beside ▶ and
  Refine (`_judge_status_cell.html.erb`). Shown on **on-call judges too**: calibration is the one
  way an on-call judge rates pairs nobody escalated to it.
- **AI Judge edit page**, after saving a prompt change: "Calibrate on *{book}*" for each book the
  judge has been calibrated on before, which re-runs on the same pairs (C5).

The **New calibration** dialog (a modal, like `_unleash_modal.html.erb`):

```
┌ New calibration ─────────────────────────────────────────────┐
│ Judge to calibrate   [ openai (gpt-4o)             ▾ ]         │
│ Compare against      [ Osc Team Member (human)     ▾ ]         │
│                      178 pairs rated by Osc Team Member        │
│ Sample size          [ 50 ]   (30–178)                         │
│ Pairs                (•) New random sample                     │
│                      ( ) Same pairs as: calibration #12 (50)   │
│                                                                │
│ This makes 50 calls to openai (gpt-4o).        [ Start ]       │
└────────────────────────────────────────────────────────────────┘
```

- **Judge to calibrate:** any AI judge the user can see (the same list as the AI Judge page's
  "When unsure, wake"), assigned to the book or not.
- **Compare against:** any judge with rateable judgements on this book, human or AI, with its
  count of eligible pairs (C2). AI and human judges are marked.
- **Sample size:** default 50, minimum 30 (below that the result would show no figure anyway,
  research doc D4), maximum the eligible count, hard cap 500. The dialog states the number of LLM
  calls; it can't state a price, since token usage isn't recorded (`escalating_judges.md` §5.3).
- **Pairs:** a new sample, or the sample of an earlier calibration with the same reference (C5).

*Rejected:* a calibrate button on Judgement Stats only. Judgement Stats is about what has been
judged; calibration needs its own list, its own results page and history, and would crowd it out.

### C2 — Which pairs: a frozen, uniform random sample of the reference's rated pairs

**Eligible pairs** are pairs in the book, within `rank_depth`, where the reference has a judgement
that is rateable (not `unrateable`, not `judge_later`) and on the book's scale. The judge being
calibrated may or may not have rated them already; that doesn't matter, because its calibration
answers are stored separately (C3). The three-judgement cap does not apply, for the same reason.

**The sample is drawn uniformly at random**, without position weighting, once, and **frozen**: the
pair ids and the reference's rating on each are stored. Uniform, because α and the agreement
percentages should describe the book's pairs as they are; position weighting or "fewest
judgements first" would describe some other set. Frozen, so that:

- re-running after a prompt edit compares on the same pairs (C5);
- a reference judge changing a rating later doesn't silently change an old result. The page notes
  when a reference rating has changed since the sample was drawn.

The page shows the sample's **reference grade mix** ("0: 31, 1: 19"). On a book where 90% of the
reference ratings are 0, a 50-pair sample has few of the middle grades, which is where judges
disagree most (research §2.1). The figure is still right for the book, but the confusion matrix is
thin there, and the page says so when a grade has fewer than 5 pairs.

**Sampling by queries** (the dialog's default when the reference allows it): draw N queries
uniformly at random from those whose whole top list the reference rated, and take every pair of
each. A query's top list is its pairs within `rank_depth` that have a position, lowest position first,
at most 10 (positions may start at 0 or 1, so it is the lowest ten, not positions 1–10). A query sample
is still a set of pairs, so it shows pair agreement as well, and adds **ranks agreement** (C6). It
needs at least 10 queries, and 20 or more says something useful; references that rated scattered pairs
rather than whole lists can only be sampled by pairs. The pairs are clustered by query, so an α from
20 queries rests on fewer independent observations than one from 200 random pairs.

*Not v1:* a "balanced across grades" sample. It diagnoses the middle grades better, but its α
doesn't describe the book. It can come later as an option, labelled that way.

*Not v1:* "all humans" as one reference (majority or median grade where several rated a pair). v1
compares against one judge at a time, as the research doc does (§9, human consensus).

### C3 — Calibration answers are stored apart from judgements

A calibration's answers go into their own table, **not** into `judgements`. This changes research
doc D6, which made them ordinary judgements. The reasons:

1. **Re-running on the same pairs is the point**, and `judgements` allows one row per (judge, pair).
2. **A calibration is a trial.** Its answers are from a judge that hasn't been trusted yet. As
   judgements they would flow into `RatingsManager` and move case scores before anyone has read
   the result.
3. **The gold set is at the cap.** Pairs humans finished have three judgements; as ordinary
   judgements, calibration couldn't use them.

So calibration never changes a rating, a case score, the judging queue or Judge Activity. That is
also what makes it safe to run against a judge that isn't assigned to the book.

*Possible later:* a **Keep these ratings** action that copies a calibration's answers into
judgements, for the pairs this judge hasn't judged and that are under the cap (open question, §7).

### C4 — The data

Three tables (names to settle when built):

- **`calibration_samples`**: `book_id`, `reference_id` (a `users` row), `created_by_id`,
  `created_at`. Its pairs are in **`calibration_sample_pairs`**: `calibration_sample_id`,
  `query_doc_pair_id`, `reference_rating` (the snapshot from C2).
- **`calibration_runs`**: `calibration_sample_id`, `judge_id`, `status` (queued, running, done,
  cancelled, failed), `judge_options` (a JSON snapshot of the judge's provider, model, prompt and
  minimum confidence when the run started), `started_at`, `finished_at`, `created_by_id`.
- **`calibration_answers`**: `calibration_run_id`, `query_doc_pair_id`, `rating`, `unrateable`,
  `explanation`, `confidence` (nullable; set by judges that report it).

The `judge_options` snapshot answers the research doc's open question "which prompt was a
calibration measured under" (§9, *Over time*), and is what marks a calibration **stale** (C6).

`confidence` needs `LlmJudgeAdapters::Jev` to hand its confidence back as a number rather than only
writing it into the explanation. That is the same change `escalating_judges.md` §5.3 asks for on
judgements; doing it for calibration first is the smaller step.

### C5 — Running it

A **`CalibrationRunJob`** (book, run) loops over the sample's pairs that have no answer yet. For each:
build an unsaved `Judgement` for the judge, `LlmService#perform_safe_judgement` it with
`JudgeScale.for(book)`, `JudgementFinalizer.call` it, and copy rating, unrateable, explanation and
confidence into a `calibration_answers` row. The judgement itself is never saved.

- **Concurrency:** one in-flight run per calibration run (key on the run id), so two calibrations
  of the same judge on different samples can run side by side, and neither blocks a normal
  judging run.
- **Cancel and resume:** cancelling stops after the current pair (the `RunJudgeJudyJob` pattern of
  checking its own SolidQueue row). **Resume** starts the job again; it skips answered pairs.
- **Progress:** Turbo broadcasts to the calibration's page ("23 / 50"), and its row on the list.
- **On-call judges** can be calibrated. `run_judge_judy`'s refusal stays; calibration has its own
  route and controller.
- **Failures:** an LLM error on a pair is recorded as an unrateable answer, as a normal run does.
  A run where most answers fail (say, more than half) ends as **failed** with the first error
  shown, instead of reporting an agreement figure over the few that worked.
- **Run again on the same pairs** (C1, "Same pairs as"): a new `calibration_runs` row on the
  existing sample, with a fresh `judge_options` snapshot.
- **Tuning:** "Tune and run again…" opens a dialog filled in with the run's prompt (every
  judge) and minimum confidence (TypeSafe Jev). The new run's snapshot carries what was entered, and
  the job judges with the snapshot (`CalibrationRun#tuned_judge`), never the saved judge, so trying
  settings changes nothing. A run whose settings differ from the judge's saved ones says so, and
  **Apply these settings to {judge}** makes them the judge's own. Each run's page shows the prompt
  it used, and "{judge}'s runs on these pairs" lists that judge's runs on the sample (other judges'
  runs compare something else) with each one's settings beside its figures.

### C6 — Showing the result

**The calibration page** (`books/:book_id/calibrations/:id`), for one run:

```
openai (gpt-4o)  vs  Osc Team Member (human)          50 pairs · done 3 min ago
prompt changed since this run — results may be stale   [ Tune and run again… ]

  α (ordinal) 0.61   exact 72%   within one grade 96%   openai rates 0.3 grades lower
  n = 47 compared · 3 unrateable answers (not compared)

  Confusion matrix (rows: Osc Team Member, columns: openai)
                 0 Irrelevant   1 Relevant
  0 Irrelevant        25            2
  1 Relevant          11            9     ← click a cell to list its pairs

  Rating distribution: Osc Team Member ▇▇▇▇▅  openai ▇▇▇▇▇▇▂   (side-by-side bars)

  By confidence (judges that report it):
  confidence   pairs   exact   within one   escalated at this floor
  0.9–1.0        14     93%      100%              36  (72%)
  0.7–0.9        18     78%      100%              18  (36%)
  …
```

- **Headline:** ordinal Krippendorff's α, exact and within-one agreement, mean signed difference,
  and `n`, all from the `JudgeAgreement` service the research doc plans (D1, D3, S1). Below 30
  compared pairs: "not enough pairs compared" instead of α (research D4). Unrateable answers are
  counted and listed but not compared (research D2).
- **Confusion matrix** as an HTML table, shaded by count, axes labelled with the book's scale
  labels. Clicking a cell lists its pairs: query, document title, both grades, and the calibrated
  judge's explanation, each linking to the pair. Reading these is how a prompt gets fixed
  (`optimizing_llm_as_judge_query_based_on_golden_dataset.md`).
- **Rating distribution** for both judges on the sample, side by side (Vega-Lite). It shows at a
  glance a judge that never uses a grade.
- **By confidence**, when answers carry one: agreement per confidence band, and how many pairs
  would escalate if the minimum confidence were the band's lower edge. This is the table for
  choosing the floor (research D7.2). It shows the trade-off; it doesn't set the floor.
- **Stale:** the page says so when the judge's current options differ from the run's snapshot, or
  when reference ratings changed since the sample was drawn.
- **Runs on this sample:** when a sample has more than one run, a small table of them, newest first:
  date, what changed in `judge_options` since the previous run (prompt, model, minimum confidence),
  α, exact, within one. This is the before/after for a prompt edit.

**Two tabs** on the result: **Pairs agreement** (everything above) and **Ranks agreement**, for a
sample drawn by queries (`CalibrationScoreImpact`). Each query's top 10 is scored with nDCG@10 (linear
gain) in the order the search returned it, once with each judge's grades, so a disagreement at rank 1
counts for more than one at rank 9, as in a case's score. It shows Kendall's τ-b between the two
judges' per-query scores (do both find the same queries easy and hard? none under 10 queries), the
average absolute shift, how many queries move by 0.1 or more, which way the judge leans, and a
per-query table, largest shift first. A query with an unrateable answer is left out and counted: a
hole in the list changes its score by itself. A pair-sampled calibration's Ranks tab says how to get
this view.

**The calibrations list** (`books/:book_id/calibrations`): one row per run, with judge, reference,
pairs, status (with progress while running), α and exact agreement, a stale badge, and the date.
It is filterable by judge.

**Judgement Stats**: a small "Calibration" card with the latest done run per (judge, reference)
pair, its α, and a link. The research doc's agreement card over *existing* overlap (its S2) sits
beside it. The two answer different questions: "how do these judges agree on what they happened
to both rate" against "how would they agree on a fair sample".

*Not v1:* colouring α as good or bad. The research doc leaves the cut-off undecided (§9); the page
shows the number and `n`.

### C7 — Who can do it

Anyone who can open the book can see its calibrations. Starting one needs the same rights as
running a judge on the book, plus visibility of the judge being calibrated (the AI Judge page's
rule). A calibration reads only this book's pairs and judgements.

## 4. Steps, in the order they would land

Each is deployable on its own.

**K1 · `JudgeAgreement` service** (research doc S1, unchanged): ordinal α, exact and within-one,
confusion matrix, mean signed difference, the 30-pair threshold. It takes two lists of
(pair, rating) so that calibration and the existing-overlap card both feed it.
*Verify:* the unit tests in research doc §7.

**K2 · Samples:** the three tables, eligible-pair selection and the uniform frozen draw.
*Verify:* only rateable, on-scale pairs the reference rated, within `rank_depth`; uniform (no
position weighting); the reference rating is snapshotted; sample size is clamped to 30–500 and to
the eligible count.

**K3 · Running:** `CalibrationRunJob`, the controller (create, show, cancel, resume, run again),
the dialog, the calibrations list with live progress. No figures yet: answers only.
*Verify:* job writes answers and never a judgement; cancel and resume; on-call judge allowed; an
unassigned judge allowed; mostly-failing run ends as failed.

**K4 · Results page:** headline, confusion matrix with drill-down, distributions, stale notice,
runs on this sample.
*Verify:* figures match `JudgeAgreement` on fixtures; drill-down lists exactly the cell's pairs;
stale when the prompt changes.

**K5 · Confidence:** Jev returns confidence as a number; `calibration_answers.confidence`; the
by-confidence table.
*Verify:* bands and the "escalated at this floor" counts on fixtures.

**K6 · Entry points and Judgement Stats card:** the Judge Activity icon, the AI Judge page's
"Calibrate on …", and the Judgement Stats card.

**K7 · Manual scenario:** a new scenario in `docs/manual-testing/12-ai-judges.md` with `paths`
in `tracking.yml`: calibrate an AI judge against a human on Book of Ratings, read the matrix and
check three cells' pairs by hand; edit the prompt, run again on the same pairs, compare the two
runs; calibrate an on-call judge against its cheap judge.

## 5. Tests worth writing beyond the obvious

- A calibration never creates, changes or deletes a `judgements` row, and never enqueues
  `UpdateCaseRatingsJob`.
- The sample ignores the cap: a pair with three judgements is eligible.
- Running again on the same sample uses exactly the same pairs, in a new run, with a new snapshot.
- A reference judgement changed after the draw: the result uses the snapshot and the page says it
  changed.
- A reference judgement deleted after the draw: that pair is skipped and counted, not crashed on.
- A judge deleted: its runs remain readable (the snapshot names it). Decide whether deleting an AI
  judge with calibration runs is blocked, like one with judgements (`AiJudgesController#destroy`).

## 6. Fit with the other plans

- **Escalation** (`escalating_judges.md` §5.2): calibrating the on-call judge against the cheap
  judge is the measurement that plan asks for before trusting the chain. The by-confidence table
  is how the cheap judge's minimum confidence gets chosen.
- **Prompt tuning** (`optimizing_llm_as_judge_query_based_on_golden_dataset.md` §8): "run again on
  these pairs" is its in-Quepid test-set check, and a human-referenced sample is a golden set that
  can be exported later.
- **Agreement on Judgement Stats** (research doc S2) is independent and can land before or after
  K3.

## 7. Open questions

- **Keep these ratings.** Should a good calibration's answers be promotable to judgements (C3)?
  Useful when the expensive judge's answers are worth keeping; but then a calibration is no longer
  free of side effects, and the action has to respect the cap and the one-per-judge rule.
- **Calibrating humans.** A "rate pairs *X* already rated" mode in the human judging flow
  (`JudgementsController#new` with a sample instead of `SelectionStrategy`). The answers are worth
  keeping as real judgements, which argues for writing them to `judgements`, unlike AI calibration.
  Not v1.
- **Samples across books.** A golden set usually lives in one book. Calibrating a judge for use on
  *another* book measures how well it transfers, not how it will do there. v1 is per book.
- **How many runs to keep.** Runs are small, but a tuning session can make dozens. Keep all for now.
