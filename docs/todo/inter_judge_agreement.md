# Inter-judge agreement — do the judges on a book mean the same thing?

> **Status:** plan only, nothing implemented. Background and sources:
> `docs/todo/judge_calibration_research.md`. The escalation work depends on this
> (`docs/todo/escalating_judges.md` §5.2), but it stands on its own: any book with more than
> one judge needs it.

## 1. The scenario

A book is judged by several judges: two or three people, an AI judge alongside them, or two AI
judges. Quepid averages their ratings per pair (`RatingsManager`) and scores searches against the
result. Nothing tells the book's owner whether those judges *agree*:

- Is the new AI judge any good? Today the only way to tell is to read its explanations one by one.
- Is one person much stricter than the others, dragging every pair they touch down a grade?
- Did rewording a judge's prompt make it agree with the humans more, or less?
- Is the book's scale itself the problem — do judges agree on 0 and 3 but scatter across 1 and 2?

The IR literature answers these with a chance-corrected agreement statistic plus a confusion matrix
per pair of judges (research note §2.4). Quepid has neither: Judgement Stats shows how *many*
judgements each judge made, never how they compare.

## 2. What already exists

| Piece | Where | How it serves this |
| --- | --- | --- |
| One judgement per (judge, pair) | `judgements` unique index on `(user_id, query_doc_pair_id)` | two judges' ratings on a pair are directly comparable rows |
| The book's scale and labels | `Book#scale`, `#scale_with_labels`, `JudgeScale` | the ordered grades the metric compares on |
| Rateable vs not | `Judgement.rateable`, `unrateable`, `judge_later` | which rows carry a rating at all |
| Human vs AI judge | `User#ai_judge?` (`AiJudge` is an STI subclass of `User`) | lets the page separate "AI vs human" from "human vs human" |
| A per-judge stats page | `BooksController#judgement_stats`, `books/judgement_stats.html.erb` | where the numbers belong |
| A rating distribution | `BooksController#rating_distribution_for` | already shows *how* ratings spread, but pooled across judges |

Two facts about today's code that shape the design:

- **Judges are steered away from each other.** `SelectionStrategy.random_query_doc_pair_for_multiple_judges`
  orders candidate pairs by how many judgements they already have, fewest first. A second judge
  therefore works through the pairs nobody has rated before it touches a pair someone has. That is
  right for coverage and wrong for measuring agreement: on a large book, two judges may share
  almost no pairs.
- **Ratings off the scale exist.** Book merge averages two judgements of the same judge on the same
  pair (`BooksController`, `(judgement.rating + j.rating) / 2`), so a 0–3 book can hold a 1.5.
  An ordinal metric has to decide what to do with those.

## 3. Decisions

### D1 — Krippendorff's α, ordinal, as the headline number

Krippendorff's α is chance-corrected like Cohen's κ, but it works with **any number of judges**,
an **ordinal** scale (a 0-vs-3 disagreement costs more than 0-vs-1), and **missing data** — a judge
need not rate every pair (research note §2.4.2). All three are true of every Quepid book.

Show beside it the plain **exact-agreement** and **within-one-grade** percentages. α is the number
to compare across books and judges; the percentages are the ones a person can read without a
statistics lesson.

*Rejected:* Cohen's κ as the headline. It handles only two judges with no missing ratings, so it
would need a different statistic for the book-wide figure. Weighted κ remains a fine way to
cross-check a single pair of judges.

### D2 — Which judgements count

- **Rateable only.** `unrateable` and `judge_later` rows have no rating to compare.
- **Named judges only.** Judgements with no `user_id` (anonymous) come from an unknown number of
  people; treating them as one judge would invent agreement or disagreement. Excluded, and the
  page says how many were skipped.
- **On-scale ratings only.** A rating that is not one of `Book#scale`'s values (a merge average) is
  skipped and counted, rather than rounded — rounding would quietly decide which grade a 1.5
  "meant".
- **Within `rank_depth`**, matching `SelectionStrategy`, so the metric describes the same pairs
  judging works on.
- **Escalated judgements count normally.** But an escalated pair carries the cheap judge's
  *unrateable* row and the expensive judge's rating, so it contributes **no overlap** between those
  two judges. Escalation cannot measure its own calibration; D6 is how that overlap is made.

### D3 — Two views: per pair of judges, and per book

- **Pairwise:** for each two judges, α over the pairs both rated, the overlap `n`, the agreement
  percentages, and a **confusion matrix** (judge A's grade by judge B's grade). The matrix shows the
  *direction* of an offset — B one grade below A on most pairs — that α alone hides. Also show the
  mean signed difference ("B rates 0.4 grades lower than A on average").
- **Book-wide:** α across all judges on all pairs with at least two rateable judgements. One number
  for "how consistent is this book's judging".

AI judges and humans are marked. "AI judge vs each human" is the comparison that decides whether to
trust an AI judge at all; humans are the reference wherever a book has them (research note §2.4.1).

### D4 — No number without enough overlap

Below a minimum overlap (start at **30 shared pairs**, a constant to tune), show the overlap and
"not enough shared pairs" instead of α. A κ or α from ten pairs swings wildly and would be read as
real. `n` is always shown next to the number.

Confidence intervals (bootstrap over pairs) are the honest next step but not v1; the threshold plus
a visible `n` covers the worst case.

### D5 — Computed on request, in one service

A `JudgeAgreement` service takes a book and returns the pairwise and book-wide figures. The data
comes from one grouped query over `judgements` joined to itself on `query_doc_pair_id`, filtered by
D2, which yields every pair of judges' confusion counts at once; α is computed in Ruby from those
counts. No new tables or columns.

Judgement Stats is visited rarely and a book is at most tens of thousands of pairs, so computing on
page load is fine for v1. If it is not, cache per book keyed on the latest judgement's
`updated_at`.

*Not here:* writing α into `RatingsManager` or the case score. This is a diagnostic about the
judges, not an input to the ratings.

### D6 — Make overlap on purpose: a calibration sample

Because of `SelectionStrategy`'s ordering (§2), overlap does not happen by accident. Add a way to
ask a judge to rate a **random sample of pairs another judge has already rated** — for example
"Judge 50 pairs that Jev has judged" on an AI judge's row in Judgement Stats.

- For an **AI judge**, this is a `RunJudgeJudyJob` run with a different pair source: pairs the
  reference judge rated, that this judge has not, chosen uniformly at random (not position-weighted —
  a calibration sample must not over-represent the top of the list).
- For a **human**, the same selection backs a "calibration" judging mode, so a person can rate
  pairs a colleague or an AI judge has already rated.
- Calibration judgements are ordinary judgements: they also count toward ratings and the
  three-judgement cap. A pair already at three judgements is not eligible.

This is the piece the escalation plan needs: the expensive judge rates a random sample of pairs
the cheap judge answered confidently, and the confusion matrix between them is the calibration
check (`escalating_judges.md` §5.2, item 2).

## 4. Code, in the order it would land

Every step is deployable on its own.

**S1 · `JudgeAgreement` service.** The D2 filters, the grouped query, pairwise and book-wide
ordinal α, exact and within-one agreement, confusion matrices, mean signed difference, and the D4
threshold. No UI.
*Verify:* unit tests against hand-computed α on small fixtures (see §5), including the worked
example for "all metrics, any number of observers, missing data" (section D) in Krippendorff's
*Computing Krippendorff's Alpha-Reliability*.

**S2 · Judgement Stats: "Judge agreement" card.** Book-wide α with `n`; a judge-by-judge table of
pairwise α and overlap, AI judges marked; each cell opens that pair's confusion matrix with the
book's scale labels on the axes. Counts of skipped anonymous and off-scale ratings.
*Verify:* controller and rendering tests; manual scenario (§6).

**S3 · Calibration sample** (D6). The pair-selection predicate, the AI judge run with a sample
size, and the human calibration mode.
*Verify:* selection tests (only pairs the reference judge rated, not this judge, under the cap,
uniformly random); job test; manual scenario.

**S4 · Export.** The pairwise figures in the book export, so agreement travels with the ratings.
Optional; see §7.

## 5. Tests worth writing beyond the obvious

- Two judges in perfect agreement: α = 1. Two judges where one is always exactly one grade lower:
  α well below 1, exact agreement 0%, within-one 100%, mean signed difference −1.
- Three judges on overlapping, incomplete subsets: book-wide α matches a hand calculation.
- Unrateable, `judge_later`, anonymous and off-scale (1.5) ratings are excluded and counted.
- Overlap below the threshold returns "not enough shared pairs", not a number.
- A pair escalated from one judge to another contributes no overlap between them.
- A judge with every rating identical (no variance): α is undefined, and the service says so
  instead of dividing by zero.
- Calibration sample: never picks a pair this judge already rated, or a pair at the cap.

## 6. Manual testing

New scenario in `docs/manual-testing/12-ai-judges.md` when S2 lands, **"Agreement between
judges"**: on a book with human judgements, run an AI judge's calibration sample against a human
judge; open Judgement Stats and confirm the agreement card shows α, the overlap, and the
percentages for that pair; open the confusion matrix and check it against a few of the pairs by
hand. Then confirm a pair of judges with too little overlap shows "not enough shared pairs".

## 7. Open questions

- **Tuning prompts against the reference.** Once a reference judge exists, the same agreement
  numbers drive prompt tuning: `docs/todo/optimizing_llm_as_judge_query_based_on_golden_dataset.md`.
- **Human consensus as one reference.** Compare an AI judge with each human separately (v1), or
  with the humans' majority grade where two or more rated a pair? The second is closer to how TREC
  uses gold labels, but needs enough multiply-judged pairs to be meaningful.
- **Threshold for "good enough".** Quepid could colour α against a cut-off. Colouring invites
  treating a convention as a guarantee; leaving it plain asks people to know what α means. If it is
  coloured, the cut-off needs a cited source — none has been checked yet. Undecided.
- **Over time.** A judge's agreement before and after a prompt edit is exactly what someone tuning
  a prompt wants, and needs either history or a snapshot per run.
- **Labels changed mid-book.** Agreement between judgements made under different label wording
  (`escalating_judges.md` D5) measures the wording change as much as the judges. Nothing records which
  wording a judgement was made under, so this cannot be filtered yet.
- **Export (S4).** Agreement in the export is useful to anyone training or evaluating on the book;
  whether it belongs in the existing export format or a separate report is undecided.
