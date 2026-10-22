# Judges on a book — agreement, calibration and combining ratings

> **Status:** research and plan, nothing implemented. **Part I (§1–3)** is research: how IR
> research and industry measure, calibrate, correct and combine judges who disagree, and what that
> implies for Quepid. Every claim there cites its source; where a point is our own inference, it
> says so. **Part II (§4–9)** is the plan: agreement figures on Judgement Stats, a calibration
> sample to create overlap, and how to use a calibration. The escalation work depends on this
> (`docs/todo/escalating_judges.md` §5.2), but it stands on its own: any book with more than one
> judge needs it.

# Part I — Research

## 1. The scenario

A book is judged by several judges: two or three people, an AI judge alongside them, or two AI
judges. Quepid combines their ratings into one per pair (`RatingsManager`; not a plain mean, see
§2.7) and scores searches against the result. Nothing tells the book's owner whether those judges
*agree*:

- Is the new AI judge any good? Today the only way to tell is to read its explanations one by one.
- Is one person much stricter than the others, dragging every pair they touch down a grade?
- Did rewording a judge's prompt make it agree with the humans more, or less?
- Is the book's scale itself the problem — do judges agree on 0 and 3 but scatter across 1 and 2?

The IR literature answers these with a chance-corrected agreement statistic plus a confusion matrix
per pair of judges (§2.4). Quepid has neither: Judgement Stats shows how *many* judgements each
judge made, never how they compare.

Escalation (`escalating_judges.md`) sharpens the problem. It routes each pair to one of two judges
based on how hard the pair is. Both judges rate on the book's scale (`JudgeScale`), but sharing a
scale is not the same as reading it the same way: one judge can be systematically stricter about
what counts as "Relevant". Part I asks how people who build relevance-judgement sets deal with that
— how they **measure** it, how they **calibrate** a judge against a reference, how they **correct**
for it, what is known about **mixing** judges in one judgement set, and how they **combine** several
judgements of one item into a single label.

"Calibration" means two different things here, and both matter:

- **Inter-judge calibration** — do two judges map the same pair to the same grade? A systematic
  offset (one judge stricter, or one never using the middle grades) is a calibration difference.
- **Confidence calibration** — when the cheap judge says it is 40% sure, is it right about 40% of
  the time? Escalation routes on that number, so it matters whether it means anything.

## 2. What is known

### 2.1 Judges disagree a lot at the label level, and the direction is not predictable

- **Human assessors disagree with each other heavily.** Voorhees re-judged TREC topics with
  additional NIST assessors and found wide variation in which documents were judged relevant
  ([Voorhees 2000, *IP&M*](https://www.nist.gov/publications/variations-relevance-judgments-and-measurement-retrieval-effectiveness)).
- **Judge expertise matters.** Bailey et al. compared "gold" (topic originators), "silver" (task
  experts) and "bronze" (neither) judges on the TREC Enterprise track: agreement between the groups
  was low ([Bailey et al., SIGIR 2008](https://www.nist.gov/publications/relevance-assessment-are-judges-exchangeable-and-does-it-matter)).
- **LLM-vs-human agreement is moderate.** UMBRELA (GPT-4o, reproducing Bing's prompt) reaches
  Cohen's κ of **0.31–0.37** against TREC assessors on the 4-grade scale and **0.42–0.50** on the
  binary collapse, across TREC DL 2019–2023. Agreement is worst on the middle grades: roughly 75%
  on grade 0, 50% on grade 1, **30% on grade 2**, 45% on grade 3
  ([Upadhyay et al. 2024, §4](https://arxiv.org/html/2406.06519)).
- **The prompt moves agreement as much as the model does.** At Bing, 32 prompt variants gave κ from
  **0.16 to 0.64** against TREC-Robust assessors, and 42 *paraphrases* of the best prompt ranged
  **0.50–0.72**. For comparison: crowd workers 0.24–0.52, trained lab assessors 0.58
  ([Thomas et al. 2023, §4.1, §4.3](https://arxiv.org/html/2309.10621)).
- **The direction of the bias depends on the judge.**
  - Bing's GPT-4 prompt was **stricter** than TREC assessors: it said "not relevant" 44% of the
    time against the assessors' 33%, and when it did say relevant it agreed 94% of the time
    ([Thomas et al. 2023, §A.1](https://arxiv.org/html/2309.10621)).
  - Other LLM judges are **more lenient** than humans and can be pushed toward "relevant" by query
    words injected into a passage, or by an instruction such as "this paper is perfectly relevant"
    ([Alaofi et al., SIGIR-AP 2024](https://arxiv.org/abs/2501.17969)).
  - Crowd workers were more **liberal** than NIST assessors, agreeing 76% on relevant documents
    against 63% on non-relevant ones ([Kutlu et al. 2018, §2.2](https://arxiv.org/html/1806.00755v3)).

  So "the expensive judge is stricter" or "the cheap judge is lenient" cannot be assumed; it has
  to be measured per judge, per prompt, and ideally per book.

### 2.2 System *rankings* survive judge disagreement; absolute *scores* do not

- Voorhees found that despite the label disagreement, the **relative ranking of systems** was
  stable when one assessor's judgements were swapped for another's
  ([Voorhees 2000](https://www.nist.gov/publications/variations-relevance-judgments-and-measurement-retrieval-effectiveness)).
- Bailey et al. found system scores and rankings shifted by "consistent but small" amounts across
  gold, silver and bronze judges — collections are "somewhat robust", but bronze judges can change
  the relative order of systems, and gold judges are preferred
  ([Bailey et al. 2008](https://www.nist.gov/publications/relevance-assessment-are-judges-exchangeable-and-does-it-matter)).
- With LLM judges, run rankings correlate well with human ones: Kendall's τ **0.87–0.94** on nDCG@10
  for UMBRELA ([Upadhyay et al. 2024](https://arxiv.org/html/2406.06519)), and **0.77–0.86** for
  Bing's prompt ([Thomas et al. 2023, §4.5](https://arxiv.org/html/2309.10621)).
- But **absolute effectiveness moves.** Re-annotating TREC DL 2019 kept system rankings stable while
  individual models' scores dropped substantially under the new judgements
  ([Parry et al., SIGIR 2025](https://arxiv.org/abs/2502.20937)).

Every one of these results swaps a whole judgement set (or whole topics) from one judge to another.
**None of them studies a set where the judge was chosen per pair by how hard the pair was.** That
is our inference from the study designs, not a finding — and it is exactly the escalation case.

### 2.3 Mixing judges in one set can work, when the split is designed and measured

Kutlu et al. split TREC judging between in-house experts and crowd workers and measured the result
against the official qrels. Sending experts the documents that matter most to the metric (ranked
high, weighted by statAP), or the topics with the lowest expected agreement, reached Kendall's
τ = 0.9 against the official system ranking with **15–55%** of judgements going to experts,
depending on the collection ([Kutlu et al. 2018, §3–4](https://arxiv.org/html/1806.00755v3)).

The useful lesson is the method, not the numbers: they **decided the split by what matters to the
metric**, and they **measured the mixed set against a reference** rather than assuming it was fine.

### 2.4 How practitioners calibrate a judge

1. **Calibrate against a gold set, and pick the prompt by agreement with it.** Bing chose its LLM
   prompt by agreement with first-party gold labels derived from real user feedback, and checked
   the choice was robust: the winning prompt stayed best in 829 of 1,000 train/test splits
   ([Thomas et al. 2023, §2.2, §5.2](https://arxiv.org/html/2309.10621)).
2. **Report a chance-corrected agreement statistic.** TREC and the LLM-judge papers report Cohen's
   κ. Krippendorff's α generalises it to any number of judges, ordinal scales (a 0-vs-3
   disagreement costs more than 0-vs-1) and **missing data** — a judge need not rate every item
   ([Krippendorff, *Computing Krippendorff's Alpha-Reliability*](https://www.asc.upenn.edu/sites/default/files/2021-03/Computing%20Krippendorff's%20Alpha-Reliability.pdf)).
3. **Model each judge's bias explicitly.** Dawid & Skene estimate a per-judge confusion matrix —
   how each judge maps a true grade to a reported one — from overlapping labels, with no gold set
   required ([Dawid & Skene 1979, *JRSS C* 28(1)](https://www.jstor.org/stable/2346806)). Kutlu et
   al. use it to aggregate crowd labels ([Kutlu et al. 2018](https://arxiv.org/html/1806.00755v3)).
4. **Correct the metric, not the labels.** Google researchers use a small set of human labels to
   estimate the LLM judge's error and put confidence intervals around the evaluation metric
   (prediction-powered inference and conformal risk control), capturing both its bias and variance
   ([Oosterhuis et al., KDD 2024](https://arxiv.org/abs/2407.02464)).
5. **Write the guidelines down, and keep humans for decisions.** Google's raters work from
   published guidelines "to ensure a consistent approach", and their ratings are used to benchmark
   and compare changes, not to rank directly
   ([Google, *Rigorous testing*](https://www.google.com/search/howsearchworks/how-search-works/rigorous-testing/)).
   Faggioli et al. frame the choice as a spectrum of how much humans rely on machines, rather than
   all-or-nothing ([Faggioli et al. 2023](https://arxiv.org/abs/2304.09161)).

### 2.5 How cascades decide when to escalate

FrugalGPT's cascade calls models from cheap to expensive and returns an answer once a **separate
scoring model** rates it above a per-model threshold. Both the scorer (e.g. a fine-tuned
DistilBERT) and the thresholds are **learned from labelled data**; it does not use the model's own
confidence ([Chen, Zaharia & Zou 2023, §3](https://arxiv.org/abs/2305.05176)).

Routing on the cheap model's own confidence, as the Quepid plan does, is only as good as that
confidence's calibration — modern neural networks are often poorly calibrated, though a
single-parameter fix (temperature scaling) fitted on held-out labels largely corrects it
([Guo et al., ICML 2017](https://arxiv.org/abs/1706.04599)). Whether Jev's confidence is calibrated
is unknown until it is checked against labels.

### 2.6 Risks specific to LLM judges

- **Circularity.** If the systems being evaluated use the same LLM as the judge (for example as a
  reranker), the judge favours them; and a system built to exploit an automatic judge can score
  well without being better ([Clarke & Dietz 2024](https://arxiv.org/abs/2412.17156)).
- **Self-preference.** LLM evaluators recognise and favour their own outputs
  ([Panickssery, Bowman & Feng, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf)).

### 2.7 Combining several judgements of one pair into one rating

**What Quepid does.** `RatingsManager#calculate_rating_from_judgements` takes the pair's rateable
judgements (unrateable and judge-later rows are dropped). One or two are averaged. With three or
more, it keeps the three highest and uses their value if they agree, otherwise the **lowest of the
three**. Books without `support_implicit_judgements` round the result. The judging queue stops
offering a pair at three judgement rows (`SelectionStrategy`, `HAVING COUNT(judgements.id) < 3`),
so more than three arrive only by other routes, such as re-importing anonymous judgements
(`docs/todo/todo.md`). The rule came in with #1597 ("Smarter averaging of ratings"), which links the
[Quepid manual page on how judgements become a rating](https://quepid-docs.dev.o19s.com/2/quepid/63/how-judgements-are-averaged-into-a-rating-in-a-case).
That page assumes judges are rational, biased subject-matter experts who "overrate, in the general
case". It cites no research or industry practice.

Worked from the code (our arithmetic, not a finding):

| Judgements | Rating | Note |
|---|---|---|
| 3, 0 | 1.5 (2 if rounded) | mean |
| 3, 3, 0 | 0 | adding a **higher** vote lowered the rating |
| 3, 3, 1 | 1 | the single lowest judge decides |
| 3, 3, 3, 1 | 3 | a fourth judge flips it back |
| 3, 3, 3, 0 | 3 | the 0 is ignored |
| 3, 3, 1, 0 | 1 | not 1.75 |

So the rule is not monotonic, since a higher vote can lower the result. It also changes between
two judges (equal weight) and three (the strictest decides).

**What research and practice do.**

- **TREC mostly avoids combining.** "The author of a topic is its primary assessor", and the
  official judgements are that one person's
  ([Voorhees 2000, §3.1](https://www.nist.gov/publications/variations-relevance-judgments-and-measurement-retrieval-effectiveness)).
- **Union and intersection are the nearest thing to "take the minimum".** With three assessors per
  TREC-4 topic, Voorhees built a **union** judgement set, where a document was relevant "if any
  assessor judged it relevant", and an **intersection** set, where it was relevant "if all three
  assessors judged it relevant". She called intersection "a particularly stringent definition of
  relevance". System rankings barely moved: Kendall's τ against the original ranking was 0.9508
  (union) and 0.9015 (intersection) on MAP
  ([Voorhees 2000, §3.1.2](https://www.nist.gov/publications/variations-relevance-judgments-and-measurement-retrieval-effectiveness)).
  On a yes/no scale, intersection is a minimum over all judges. Unlike Quepid's rule, it was a
  robustness experiment rather than a recommended way to make judgements, it covered *all* judges
  rather than the top three, and it applied the same way at every judge count (our reading).
- **Majority vote is the baseline.** It is "the most popular" aggregation for crowdsourced relevance
  labels, and labels aggregated this way had higher κ than individual ones
  ([Maddalena et al., HCOMP 2016, §2 and Table 2](https://cdn.aaai.org/ojs/13284/13284-64-16801-1-2-20201228.pdf)).
- **Models that learn each judge's reliability beat it.** On crowdsourced INEX 2010 relevance
  labels, an EM model of worker accuracy outperformed majority vote, both in label accuracy and in
  system ranking ([Hosseini et al., ECIR 2012](https://link.springer.com/chapter/10.1007/978-3-642-28997-2_16)).
  That family descends from Dawid & Skene (§2.4.3).
  - **GLAD** also infers each item's difficulty and outperforms majority vote
    ([Whitehill et al., NIPS 2009](https://papers.nips.cc/paper/3644-whose-vote-should-count-more-optimal-integration-of-labels-from-labelers-of-unknown-expertise)).
  - **MACE** learns which annotators to trust. Its authors note that majority vote "weights all
    answers equally" ([Hovy et al., NAACL 2013](https://aclanthology.org/N13-1132.pdf)).
  - **SQUARE** is a shared benchmark for comparing such consensus methods
    ([Sheshadri & Lease, HCOMP 2013](https://ojs.aaai.org/index.php/HCOMP/article/view/13088)).

  What they share: each judge's reliability is **estimated from the data**, never assumed to lean
  the same way for everyone.
- **LLM panels vote or average.** Verga et al. replaced one GPT-4 judge with three smaller models
  from different families. They used majority voting for binary judgements and **average pooling**
  for 1–5 scores, "because ... a three judge panel often does not produce a clear majority
  decision". On Chatbot Arena the panel's Pearson correlation was 0.917 against GPT-4's 0.817, at
  seven to eight times lower cost
  ([Verga et al. 2024](https://arxiv.org/html/2404.18796)).
- **"Top three, then minimum" has no published counterpart that we found**, in IR evaluation or
  crowdsourcing aggregation. That is the limit of our search, not proof that none exists.

## 3. Implications for Quepid

Part II turns points 1–3 into a plan. Everything in this section is our inference from §2.

1. **Measure before trusting the mixture.** Ship nothing that mixes judges by difficulty without a
   way to compute agreement between them. Krippendorff's α (ordinal) fits Quepid's books directly:
   graded scales, several judges, and judges who rated different subsets.
2. **Calibrate on random pairs, not escalated ones.** "Calibrate" here means measuring how two
   judges differ on the same pairs, not adjusting anyone's ratings (point 5). The cheap judge's row
   on an escalated pair is unrateable, so there is nothing to compare there. Even with a grade,
   escalated pairs are hard by construction and every judge disagrees more on them, so comparing
   there would measure difficulty, not offset. The offset matters on the pairs that are *not*
   escalated, because their rating comes from the cheap judge alone. So the expensive judge also
   rates a small random sample of pairs the cheap judge answered confidently: the calibration
   sample (D6). What to compute on it is D3; what to do with the result is D7.
3. **Use the humans Quepid already has.** A book often has human judgements. Those pairs are the
   gold set: report each AI judge's α/κ and confusion matrix against them, as Bing did with
   first-party labels (§2.4.1).
4. **Pick the threshold from data.** A confidence floor of 0.5 is a guess. With Jev's confidence
   persisted (`escalating_judges.md` §5.3) and a gold sample, the floor can be chosen as the point where
   accepting the cheap judge's answer still meets an agreement target (§2.5).
5. **Report, don't remap, in v1.** A per-judge confusion matrix could remap the expensive judge's
   grades onto the cheap judge's (§2.4.3), but it is opaque and needs enough overlap to estimate.
   Show the offset first; decide on correction later.
6. **Expect rankings to hold better than scores.** Comparing two search configurations on a mixed
   book is likelier to be safe than reading a case's absolute score over time (§2.2). Any UI that
   shows a score trend across runs should say when the judge mix changed.
7. **Watch for circularity.** If a case's search configuration uses the same model family as a
   judge (e.g. a GPT-4o reranker judged by GPT-4o), flag it (§2.6).
8. **The rating rule assumes a bias direction that §2.1 says cannot be assumed.** Quepid's rule
   trusts the lowest of the top three because judges are taken to overrate (§2.7). But the
   direction of bias depends on the judge. On a mixed book, a systematically strict AI judge would
   decide every three-judge pair it disagrees on, and a lenient one would rarely count. Escalated
   pairs are not affected today: they carry one rateable judgement, so they are averaged and the
   rating is the expensive judge's alone.
9. **Prefer a combining rule that never lowers the rating for a higher vote and works the same at
   every judge count.** Mean or median would do. The mean matches LLM-panel practice for graded
   scores and Quepid's own one- or two-judge branch. The median resists one outlier. If a
   pessimistic stance is wanted, a per-book choice that includes "minimum over all judges"
   (Voorhees' intersection) states it openly without the quirks. Weighting judges by measured
   reliability (Dawid & Skene and its successors, §2.7) is the principled later step, once the
   calibration sample (D6) supplies overlap data.
10. **Changing the rule re-scores cases.** Ratings are recomputed from judgements on sync, so a new
    rule moves every case fed by the book. Note the change in score histories (see point 6).

# Part II — Plan

## 4. What already exists

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

## 5. Decisions

### D1 — Krippendorff's α, ordinal, as the headline number

Krippendorff's α is chance-corrected like Cohen's κ, but it works with **any number of judges**,
an **ordinal** scale (a 0-vs-3 disagreement costs more than 0-vs-1), and **missing data** — a judge
need not rate every pair (§2.4.2). All three are true of every Quepid book.

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
trust an AI judge at all; humans are the reference wherever a book has them (§2.4.1).

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

Because of `SelectionStrategy`'s ordering (§4), overlap does not happen by accident. Add a way to
ask a judge to rate a **random sample of pairs another judge has already rated** — for example
"Judge 50 pairs that Jev has judged" on an AI judge's row in Judgement Stats.

- For an **AI judge**, this is a `RunJudgeJudyJob` run with a different pair source: pairs the
  reference judge rated, that this judge has not, chosen uniformly at random (not position-weighted —
  a calibration sample must not over-represent the top of the list).
- For a **human**, the same selection backs a "calibration" judging mode, so a person can rate
  pairs a colleague or an AI judge has already rated.
- Calibration judgements are ordinary judgements: they also count toward ratings and the
  three-judgement cap. A pair already at three judgements is not eligible.
- **Cost.** Calibration is the only reason a judge rates pairs it would not otherwise reach — for
  escalation, the only reason the expensive judge rates pairs that were not escalated. Keep the
  sample small and draw it once per judge setup (judge, prompt, book) rather than continuously;
  draw it again when any of the three changes.

This is the piece the escalation plan needs: the expensive judge rates a random sample of pairs
the cheap judge answered confidently, and the confusion matrix between them is the calibration
check (`escalating_judges.md` §5.2, item 2).

### D7 — Using a calibration

What to do with the D3 figures for a calibration sample (D6). In v1 none of this changes a stored
rating. It decides whether to run a setup, how to configure it, and how to read the scores it
produces. This is our inference from §2.

1. **Gate the setup.** Fix an agreement bar before looking at the numbers, for example ordinal α
   above a chosen value against the expensive judge, or against the humans when the book has them.
   - **Clears the bar:** run the cheap judge with escalation on this book.
   - **Misses it:** do not mix the judges yet. Read the confusion matrix for where the disagreement
     sits, for example one grade. Change the prompt there and calibrate again.
     `docs/todo/optimizing_llm_as_judge_query_based_on_golden_dataset.md` describes that loop.
2. **Set the escalation floor.** On the same set, group the cheap judge's answers by confidence and
   compute agreement per group. Put the floor where agreement still meets the bar (§3 point 4).
   Everything below it escalates, so this choice sets the cost/quality trade-off.
3. **Read scores with the offset in mind.**
   - **Two search configurations compared on the same book:** fairly safe. Both are scored under
     the same judge mix, so the offset largely cancels (§2.2).
   - **An absolute score, or a trend over time:** estimate the shift as offset × share of pairs
     rated by the cheap judge. An offset of −0.4 grades on 70% of pairs moves the average rating by
     about 0.3 grades. Treat that as an error bar on the score, not a correction to apply.
   - **Runs with a different judge mix or prompt are not directly comparable.** Mark the change
     wherever a score trend is shown (§3 point 6).
4. **Know when it is stale.** A calibration is valid only for the judge, prompt and book it was
   measured on. Calibrate again when any of them changes: a new model version, a reworded prompt,
   or a book whose queries differ. An occasional small spot-check catches drift in between. v1
   computes figures on request (D5) and keeps no history, so nothing records which prompt a
   calibration was measured under; until "Over time" (§9) is settled, note it by hand.
5. **Correct only once it is stable.** When repeated calibrations give a steady offset over enough
   overlap, two corrections become possible:
   - remap the cheap judge's grades through its confusion matrix (§2.4.3);
   - weight judges by measured reliability when ratings are combined, Dawid & Skene style (§2.7,
     §3 point 9).

   Both rely on the measurement being stable, which is why they come after reporting (§3 point 5).

## 6. Code, in the order it would land

Every step is deployable on its own.

**S1 · `JudgeAgreement` service.** The D2 filters, the grouped query, pairwise and book-wide
ordinal α, exact and within-one agreement, confusion matrices, mean signed difference, and the D4
threshold. No UI.
*Verify:* unit tests against hand-computed α on small fixtures (see §7), including the worked
example for "all metrics, any number of observers, missing data" (section D) in Krippendorff's
*Computing Krippendorff's Alpha-Reliability*.

**S2 · Judgement Stats: "Judge agreement" card.** Book-wide α with `n`; a judge-by-judge table of
pairwise α and overlap, AI judges marked; each cell opens that pair's confusion matrix with the
book's scale labels on the axes. Counts of skipped anonymous and off-scale ratings.
*Verify:* controller and rendering tests; manual scenario (§8).

**S3 · Calibration sample** (D6). The pair-selection predicate, the AI judge run with a sample
size, and the human calibration mode.
*Verify:* selection tests (only pairs the reference judge rated, not this judge, under the cap,
uniformly random); job test; manual scenario.

**S4 · Export.** The pairwise figures in the book export, so agreement travels with the ratings.
Optional; see §9.

## 7. Tests worth writing beyond the obvious

- Two judges in perfect agreement: α = 1. Two judges where one is always exactly one grade lower:
  α well below 1, exact agreement 0%, within-one 100%, mean signed difference −1.
- Three judges on overlapping, incomplete subsets: book-wide α matches a hand calculation.
- Unrateable, `judge_later`, anonymous and off-scale (1.5) ratings are excluded and counted.
- Overlap below the threshold returns "not enough shared pairs", not a number.
- A pair escalated from one judge to another contributes no overlap between them.
- A judge with every rating identical (no variance): α is undefined, and the service says so
  instead of dividing by zero.
- Calibration sample: never picks a pair this judge already rated, or a pair at the cap.

## 8. Manual testing

New scenario in `docs/manual-testing/12-ai-judges.md` when S2 lands, **"Agreement between
judges"**: on a book with human judgements, run an AI judge's calibration sample against a human
judge; open Judgement Stats and confirm the agreement card shows α, the overlap, and the
percentages for that pair; open the confusion matrix and check it against a few of the pairs by
hand. Then confirm a pair of judges with too little overlap shows "not enough shared pairs".

## 9. Open questions

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
