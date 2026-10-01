# Judgement escalation — what worries me about it

> Companion to `docs/todo/escalating_judges.md`, which is the plan. This is the risk register:
> what I think can go wrong, what it would cost to find out, and where I would change the plan.
> Written before any code exists, while changing our minds is still free.

## 0. What today's code actually does (checked, not assumed)

Four facts the whole design rests on:

1. **Unrateable judgements still occupy a slot.** `SelectionStrategy`'s cap counts rows, not
   ratings: `HAVING COUNT(judgements.id) < 3` (`selection_strategy.rb:77`). Nothing filters on
   `unrateable`.
2. **Scoring ignores them.** `RatingsManager` averages `query_doc_pair.judgements.rateable`
   (`ratings_manager.rb:58`), so an unrateable row never moves a rating.
3. **A pair's rating is the mean of whoever rated it.** Same place — so on an escalated pair the
   rating is the expensive judge's alone, because the cheap judge's row is excluded.
4. **`RunJudgeJudyJob` has no concurrency limit** (unlike `PopulateBookJob` and
   `RunCaseEvaluationJob`). Two runs on one book can already overlap today.

## 1. The judgement set stops being homogeneous — and nothing says so

This is the one I would think hardest about, because it is silent and it survives into everything
downstream.

With a chain, **which model rated a pair depends on how hard the pair was**. Easy pairs get the
cheap model; the pairs the cheap model found ambiguous get the expensive one. The book's ratings
are then a mixture of two distributions, correlated with difficulty — and every number computed
from that book inherits it:

- inter-rater agreement between "Jev" and a human is now measured on the *easy* subset only,
  because the hard pairs were handed away;
- a comparison of two search configurations is scored against ratings whose provenance varies by
  pair, so a difference between configurations can be a difference between judges;
- anyone exporting the book to train or evaluate a model gets that mixture with no marker for it.
  `book_importer.rb` carries judgements with their `user_id`, so the information exists — but
  nothing in the UI, the export, or `RatingsManager` says "these two ratings came from different
  tiers of judge".

Not a reason to abandon the feature: a human panel has the same property whenever the confident
rater answers first. It *is* a reason to (a) make provenance visible wherever ratings are
consumed, and (b) never quietly present a chain-judged book as if one judge rated it.

## 2. Escalation spends the per-pair judgement budget twice as fast

From fact 1 + fact 2: an escalated pair consumes **two of three** slots and produces **one**
rating. So a chain-judged book reaches "every pair has three judgements" — the thing
`moar_judgements_needed?` and the book banners announce — with substantially fewer independent
opinions than a flat book of the same size. Worse, the shortfall lands precisely on the hard
pairs, which are the ones that deserve more opinions, not fewer.

Options, none free:
- accept and document (the plan's choice) — cheap, but the banners now lie a little;
- stop counting unrateable rows toward the cap — arguably correct anyway, but it changes human
  judging too: a book full of "unrateable" rows would suddenly want more judgements;
- give `judgements` a `superseded_by` (escalated-from) link and count a chain as one logical
  judgement — the honest model, and the most schema churn.

I would not ship a chain over a large book without picking one deliberately.

## 3. We route on a number we throw away

The whole feature turns on Jev's `confidence`, and today that number exists only inside the
explanation string (`"... confidence 0.35. Distribution: ..."`). That means:

- you cannot ask "how many pairs would escalate at 0.4?" before turning it on;
- you cannot plot confidence against agreement with a human to calibrate the threshold;
- you cannot audit afterwards which pairs escalated and why, except by parsing prose.

If a number is load-bearing for routing and spend, it should be a column (or a small structured
blob on the judgement), not free text. That is a schema decision the plan currently dodges, and
it is the one I would most want made *before* S4 rather than after.

The same applies to token usage: both providers return it, and `LlmJudgeAdapters` discards it.
Escalation makes "what did this run cost" a question people will actually ask.

## 4. Cost control is a guess, and the loudest button is the dangerous one

`judge_all` ("Unleash the Kraken") runs the whole book. With a chain behind it, the expensive
judge's exposure is bounded only by how often the cheap judge is unsure — a number nobody can see
in advance (§3). The plan's budget cap helps, but:

- the default (10% of the run) is invented; the right number is per book and per wallet;
- there is no preview: no "this would have escalated 412 pairs" dry run;
- there is no spend readout afterwards, only a count of escalations;
- two overlapping runs (fact 4) double it, and nothing stops them.

## 5. A pair that fails escalation is stuck forever

`SelectionStrategy` excludes pairs the judge has already judged. So if the expensive judge is down,
rate-limited, or the budget ran out, the pair keeps its unrateable rows and **no later run will
retry it** — the cheap judge won't pick it again, and the expensive judge is only reachable through
the cheap judge's escalation. The chain has no resumability.

This alone makes me want the two-pass design in §7.

## 6. Escalation is nondeterministic, so the book changes shape between runs

Jev's confidence varies between identical calls (we have seen the same kind of pair come back at
0.02 and at 0.67). Which pairs escalate is therefore a coin toss near the threshold, and re-running
a book produces a different mixture (§1). That is fine for judging throughput and bad for anything
that assumes a book is a stable artefact — comparisons over time, regression tests on scores,
"why did this case's score move?".

## 7. I would reconsider doing this inline

The plan escalates inside the run loop (its D5). Having written it, the **two-pass** shape looks
better for a first version:

> Run the cheap judge over the book as today. Then run a second job that selects *only the pairs
> whose judgement from judge X is unrateable* and judges them with judge Y.

What that buys, against the inline version:

| | inline | two-pass |
| --- | --- | --- |
| Cost preview | none | the count of unrateable pairs *is* the preview, before you pay |
| Resumability (§5) | none | re-run the second pass any time |
| Failure blast radius | one run, mixed judges | passes fail independently |
| Progress reporting | interleaved, two judges in one counter | one judge per run, as today |
| Latency mixing | expensive calls stall the cheap loop | none |
| New machinery | escalation service + budget + depth guard inside the job | one selection predicate + the existing job |
| Fits the deferred batch work | poorly (conditional requests can't be pre-built) | naturally (the second pass is just another batch) |

The cost is that it is not "automatic" — somebody has to trigger the second pass, or a recurring
job does. Given §4 and §5, I think that is a feature rather than a defect for v1, and the inline
version becomes an option once the numbers from §3 exist.

## 8. Configuration can rot underneath a chain

A chain names judges; judges get removed from teams (that happened during this session), lose their
key, get deleted, or get unassigned from the book. A chain whose next rung has no API key fails
every escalation and burns the budget doing it. Validation at save time (the plan's D6) does not
help with drift afterwards, so the run needs to degrade honestly: skip the missing rung, say so
once in the completion broadcast, and not mark pairs unrateable in a way that hides it.

## 9. It will look like the cheap judge is bad at its job

Judgement Stats shows per-judge counts. After a chain run, Jev's row reads "6 unrateable" and the
expensive judge's reads "6 rated" — which, without explanation, reads as *Jev is unreliable* rather
than *Jev knows when to ask*. The same applies to the sleeping judge: a judge with no "Prepare to
Judge!" button looks broken unless the page says who wakes it. This is a docs-and-labels problem,
but it is the first impression everyone will form.

## 10. Testing it honestly is awkward

The interesting behaviour only appears when the cheap judge is unsure, which is exactly what you
cannot summon on demand from a live model. Two levers make manual scenarios deterministic and
should be written into 12.7: set `jev_min_confidence` to **1.0** so everything escalates, and to
**0** (or blank) so nothing does. Automated tests should stub adapters rather than call anybody —
but that means the thing we are least sure about (how often real confidence falls below a real
threshold on a real corpus) is precisely what the test suite cannot tell us.

## 11. Smaller things I would still write down

- **Ping-pong.** Two judges configured to escalate to each other, or a chain that includes the
  running judge. Depth limit plus save-time validation; cheap to get wrong.
- **The unique index is the backstop.** `(user_id, query_doc_pair_id)` will raise if a rung is
  asked twice for the same pair; the code must skip, not rescue.
- **`judge_later` as the last rung.** "No model could rate this" is useful signal and the existing
  flag already means "a human should look". Ending the chain there instead of at `unrateable`
  turns a dead end into a work queue.
- **Disagreement as a trigger.** Two cheap judges that disagree is at least as strong a signal as
  one cheap judge that is unsure, and it needs the same plumbing.
- **Implicit judgements.** `Book#support_implicit_judgements` decides whether the averaged rating
  is rounded (`ratings_manager.rb:66`). With one rater per escalated pair, rounding behaviour is
  unchanged — but it is worth a test, because "average of one" is exactly the case people forget.

## 12. What I would want to know before building any of it

1. On a real book, what fraction of pairs fall below a candidate threshold? (One cheap-judge run
   plus §3's persisted confidence answers this, and it decides whether the feature is worth
   anything at all.)
2. Do the escalated pairs actually get *better* ratings from the expensive judge — measured
   against a human sample — or merely different ones?
3. What does a run cost today, and what would the chain cost? (Needs the usage numbers we
   currently discard.)

If (1) says 2% of pairs escalate, this feature saves almost nothing on a cheap-judge-only workflow
and mostly buys insurance. If it says 40%, the economics are excellent but §1 and §2 become
serious and the two-pass design in §7 becomes close to mandatory.
