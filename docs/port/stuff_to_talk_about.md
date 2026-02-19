# UX Feedback & Discussion Notes

> User observations collected during testing of the `deangularjs-experimental` branch. Some items are addressed by the modern stack (e.g., guided tour work tracked in the parity archive). Many are UX design issues independent of the Angular→Stimulus migration. See [../archives/deangularjs_experimental_functionality_gaps_complete.md](../archives/deangularjs_experimental_functionality_gaps_complete.md).

---

- Solr demo server for Quepid appears to be down, OpenSearch works.
- Tutorial makes it sound like one needs to talk to search team to find fields, but it looks like they are auto-populated under Additional Display Fields?
- The Additional Fields dropdown doesn't like to go away, clicking escape closes the window altogether with no clear way to get back to it.
- First time I clicked finish it went back to the beginning for creating a new case, when I closed it, the case did not exist. The second time I went through it persisted the case.
    - May have had to do with naming. I named it `test` when it failed and `star wars 2` when it succeeded (checked, doesn't seem to be).
- I was not prompted to go through a guided tour of the case.
- Maybe something else than "Try"?
- Maybe full name for AP@10 with (AP@10) following.
    - Maybe a link to information on AP@10? Or hovering shows a short description, etc.
- The term "Scorer" is somewhat ambiguous and not shown in the UI before/after/above AP@10.
- "scaled label" in the tutorial is not clear.
- How does one edit a case? I don't see an option for edit...Ahh, it is under "Tune Relevance" - this is not intuitive.
- It is not clear how to close the Tune Relevance sidebar.
- Clicking on return to my searches does a full page reload but doesn't close the Tune Relevance sidebar.
- Tutorial should be rewritten for ES/OS.
- Should not show Compare snapshots when no snapshots have been taken.
- I don't see the change in score that is reflected in the screenshots.
- Judgements is not an intuitive term nor is Books.
- The difference between Subject Matter Experts and Expert Users is not clear.
- The reason we are told to change the Select Scorer is so we can make binary judgments but AP@10 also showed hte binaryu judgment screen.
- May want to warn users about conversions when changing between different scoring methods.
- Invalid queries seem to incremeent Try, which isn't ideal.
- One gets a dropdown with other fields on the initial case creation menu but not when in Tune Relevance -> Settings -> Displayed Fields.
- Should not show option to select team for Search Endpoints when there is no team.
- The frog icon is not intuitive for unrated docs.
- If we enter an invalid query it should not iterate the Try.
    - It is unclear how to access the Try.
- Explain Query - Params doesn't seem helpful with OpenSearch?
- Explain Query - Parsing does but could be broken out a lot more to provide more insight.
- It isn't intuitive that one needs to go to Tune Relevance -> History to see history of tries, would be nice if clicking on a Try maybe took to this.
- Too many steps: To stop comparing snapshots, click the Compare snapshots link and select the Disabled option and click the Update diff settings button.
- Why make info need only one line?


  Claude says
  ---                                                                           
  The sentence you're asking about is from docs/data_mapping.md (line 29):
                                                                                
  "The score of each query is transformed into a percentile score for the case, 
  and saved as a time series as the Score model."

  The word "percentile" here is misleading — the actual implementation is a
  simple arithmetic mean (average), not a statistical percentile. Here's how it
  works end-to-end:

  The Scoring Pipeline

  There are two paths that both end at the same place:

  Path 2: Server-side (RunCaseEvaluationJob)

  When a case is evaluated as a batch job:

  1. Individual query scoring — FetchService#score_snapshot runs each query's
  Scorer JavaScript via MiniRacer (V8) in lib/javascript_scorer.rb
  2. Case-level aggregation — Same averaging in app/services/fetch_service.rb:
  scores = queries_detail.values.map { |q| q[:score] }
  average_score = scores.sum.to_f / scores.length

  Both paths converge at CaseScoreManager

  app/services/case_score_manager.rb decides whether to create a new Score,
  update the last one, or ignore:

  - Same try/user/scorer and ratings changed within 5 minutes → updates the
  existing Score record
  - Same score value and not stale → ignores (deduplication)
  - Otherwise → creates a new Score record

  This is what makes it a time series — each new Score record is a timestamped
  data point in the case_scores table with:
  - score (float) — the averaged case score
  - queries (JSON blob) — individual query scores {query_id: {score, text}}
  - try_id — which configuration produced it
  - user_id, scorer_id — who and with what scorer

  Users can attach an Annotation to any Score to note what changed ("switched to
   BM25", "added synonyms", etc.), creating a narrated history.

  ★ Insight ─────────────────────────────────────
  The "percentile" misnomer: The doc says "percentile" but the code computes a
  mean. This matters because a percentile would tell you "X% of queries score
  below this threshold" while a mean tells you "on average, queries score X."
  They answer different questions about search quality.

  The deduplication logic is subtle: CaseScoreManager uses a 5-minute window and
   integer comparison (to_i) to decide whether to create a new time-series point
   or update in place. This means rapid-fire re-scoring during active tuning
  collapses into a single data point, while switching tries or waiting creates a
   new one — keeping the time series meaningful rather than noisy.

  Queries with no ratings are excluded, not zeroed: The client-side scoreAll
  skips 'zsr' (zero search results) and '--' (unrated) queries entirely. This
  means adding a new unrated query doesn't tank your case score — but it also
  means the score only reflects the queries you've bothered to rate.
