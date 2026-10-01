# Judge calibration — how IR research and industry handle judges who disagree

> **Status:** research note, no code. Feeds the calibration section of
> `docs/todo/judgements-escalation.md` (§1.1) and the escalation plan in
> `docs/todo/escalating_judges.md`. Every claim cites its source; where a point is our own
> inference rather than a finding, it says so.

## 1. The question

Escalation routes each pair to one of two judges based on how hard the pair is. Both judges rate
on the book's scale (`JudgeScale`), but sharing a scale is not the same as reading it the same way:
one judge can be systematically stricter about what counts as "Relevant". This note asks how
people who build relevance-judgement sets deal with that — how they **measure** it, how they
**calibrate** a judge against a reference, how they **correct** for it, and what is known about
**mixing** judges in one judgement set.

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

## 3. Implications for Quepid's escalation plan

1. **Measure before trusting the mixture.** Ship nothing that mixes judges by difficulty without a
   way to compute agreement between them. Krippendorff's α (ordinal) fits Quepid's books directly:
   graded scales, several judges, and judges who rated different subsets.
2. **Calibrate on random pairs, not escalated ones.** Escalated pairs are hard by construction, so
   comparing the two judges only there measures difficulty, not offset. Have the expensive judge
   also rate a small **random sample** the cheap judge rated confidently. Those overlap pairs give
   the offset, the confusion matrix, and the agreement figure (§2.4).
3. **Use the humans Quepid already has.** A book often has human judgements. Those pairs are the
   gold set: report each AI judge's α/κ and confusion matrix against them, as Bing did with
   first-party labels (§2.4.1).
4. **Pick the threshold from data.** A confidence floor of 0.5 is a guess. With Jev's confidence
   persisted (risk register §3) and a gold sample, the floor can be chosen as the point where
   accepting the cheap judge's answer still meets an agreement target (§2.5).
5. **Report, don't remap, in v1.** A per-judge confusion matrix could remap the expensive judge's
   grades onto the cheap judge's (§2.4.3), but it is opaque and needs enough overlap to estimate.
   Show the offset first; decide on correction later.
6. **Expect rankings to hold better than scores.** Comparing two search configurations on a mixed
   book is likelier to be safe than reading a case's absolute score over time (§2.2). Any UI that
   shows a score trend across runs should say when the judge mix changed.
7. **Watch for circularity.** If a case's search configuration uses the same model family as a
   judge (e.g. a GPT-4o reranker judged by GPT-4o), flag it (§2.6).
