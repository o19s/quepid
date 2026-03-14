# Core Case Evaluation Interface Manual

This manual describes the **core case evaluation interface** in Quepid: the main screen where you work with a case, its queries, search results, ratings, and scores. It is the primary workspace for tuning search relevance. Screenshots are referenced throughout; to capture or update them, see [Screenshot Guide for Core Case Evaluation Manual](core_case_evaluation_manual_screenshots.md). Image files live in `docs/images/core_case_evaluation_manual/`.

## Overview

The core case evaluation interface is the AngularJS application loaded when you open a specific case and try. It lets you:

- View and manage the case’s **queries**
- Run those queries against your **search endpoint** and see **results**
- **Rate** results (relevance judgments)
- See **scores** at query and case level from your chosen **scorer**
- Adjust **try settings** (query template, tuning knobs, endpoint) and **rerun** searches
- Create **snapshots** and compare results with **diffs**
- Perform case-level actions (scorer, judgements, snapshot, diff, import/export, share, clone, delete)

Everything in this interface is scoped to one **case** and one **try** (a configuration snapshot of that case).

## Access and URL

- **URL pattern:** `/case/:caseNo/try/:tryNo` (case number and try number in the route).  
  Example: `/case/42/try/1` is case 42, try 1.
- If you omit the try, the latest try for that case is used.
- You reach this interface by:
  - Choosing a case from the **Relevancy Cases** dropdown in the header, or
  - Opening a case from the cases list and (if needed) selecting a try.

The interface loads the case and try, fetches queries, runs all queries against the current try’s search endpoint, and then displays results and scores.

On first load you may see a **Loading...** state while the app bootstraps; then **Bootstrapping Queries** and progress (**Updating Queries: X / Y**) while queries run.

![Loading and bootstrapping progress](images/core_case_evaluation_manual/16_loading_bootstrapping.png) Success and error feedback appear in **flash messages** at the top of the page (e.g. “All queries finished successfully!” or “Some queries failed to resolve!”). Search-specific errors can appear in a dedicated search-error area.

If you have no cases yet (or the URL has `showWizard=true`), the **case creation wizard** may open automatically. You can also open it from the header via “Create a case” under Relevancy Cases. The wizard walks through selecting or creating a search endpoint, configuring it, adding initial queries, and creating the case.

## Layout

![Full layout of the core case evaluation interface](images/core_case_evaluation_manual/01_full_layout.png)

The screen is divided into:

1. **Header** (top) – Global nav: Relevancy Cases, Books, Teams, Scorers, Notebooks, user menu, User Manual, Wiki.
2. **Main area** – Case title, case-level score, case actions bar, then the **query list** (each query expandable to show results and tools).
3. **East pane** (optional) – **Tune Relevance** panel: try settings, query sandbox, tuning knobs, history, annotations. Shown/hidden via “Tune Relevance.” The east pane is **resizable**: drag the vertical divider (east-slider) between the main area and the panel to change its width.

---

## Header

![Header with Relevancy Cases dropdown](images/core_case_evaluation_manual/02_header_relevancy_cases.png)

- **Relevancy Cases** – Recent cases; “View all cases”; “Create a case.”
- **Books** – Recent books; “View all books”; “Create a book.”
- **Teams** – Teams management.
- **Scorers** – Scorers list.
- **Notebooks** – Link to Notebooks.
- **User menu** – Profile, Log out, API Docs; for admins: Admin, Users, Announcements, Job Manager.
- **User Manual** / **Wiki** – External docs.

Use the case dropdown to switch cases (and optionally tries) without leaving the core interface.

---

## Case Header

![Case header and case actions bar](images/core_case_evaluation_manual/03_case_header_and_actions.png)

At the top of the main area:

- **Case score** – One or more score badges (e.g. **qscore-case**):
  - Current case score from the active scorer.
  - When the case has more than one saved score, a **score history graph** (sparkline) and **annotation** markers appear in the badge, showing how the case score changed over time.
  - If a diff is active, additional scores for each snapshot/searcher in the comparison.
- **Case name** – Double‑click to rename (inline edit).
- **Try name** – e.g. “Try 1”; double‑click to rename (inline edit).
- **Scorer name** – The case’s selected scorer (e.g. “AP@10”).
- **Badges** – “PUBLIC,” “ARCHIVED,” or nightly icon if the case is marked for nightly evaluation.

---

## Case Actions Bar

Below the case header is a horizontal list of actions:

| Action | Description |
|--------|-------------|
| **Select scorer** | Open modal to choose the case’s scorer (e.g. AP@10, NDCG@10, custom). |
| **Judgements** | Open modal to associate a **Book** with this case and to refresh the case’s ratings from that book’s judgements (or to manage the book–case link). |
| **Create snapshot** | Save current query results as a named snapshot for later comparison. |
| **Diff** | Choose one or more snapshots to compare with current results (side‑by‑side). |
| **Import ratings** | Import ratings from file (CSV, RRE, LTR, etc.) into this case. |
| **Share case** | Share the case with teams. |
| **Clone case** | Duplicate the case (queries, ratings, settings). |
| **Delete** | Open modal: **Delete All Queries** (removes all queries and their ratings), **Archive Case** (hide case; find it later via “Archived Cases” on the cases list), or **Delete Case** (permanently remove the case). |
| **Export case** | Export case/ratings in various formats (CSV, TREC, RRE, LTR, etc.). |
| **Tune Relevance** | Show or hide the east pane (try settings, query sandbox, knobs, history, annotations). |

![Select scorer modal](images/core_case_evaluation_manual/14_select_scorer_modal.png)

![Delete case options modal](images/core_case_evaluation_manual/15_delete_options_modal.png)

All of these apply to the **current case** (and effectively to the current try for settings that are try-specific).

---

## Query List

![Query list with controls and collapsed rows](images/core_case_evaluation_manual/04_query_list_controls.png)

The main content is a list of **queries** for the case. Each row summarizes one query; expanding it shows results and per‑query tools.

### List-Level Controls

- **Add query** – Create a new query: enter query text and add. You can add **multiple queries at once** by separating query text with **semicolons** (`;`); each non-empty segment becomes a new query, and all are run after being added.
- **Show only rated** – Checkbox: when on, each query’s result list shows only **documents that have been rated** (instead of the full result set). The query list itself is unchanged; all queries still appear.
- **Collapse all** – Collapse every query row.
- **Sort** – Sort the list by:
  - **Manual** – Custom order (drag‑and‑drop if enabled by configuration).
  - **Name** – Query text.
  - **Modified** – Last modified.
  - **Score** – Last score.
  - **Errors** – Queries with errors first.
  Arrow indicates ascending/descending; click again to flip.
- **Filter** – Text filter to show only queries whose text matches.
- **Number of Queries** – Total count.
- **FROG report** – Link to the FROG (Focusing on Retrieval Optimization Goals) report for the case.

Queries are **paginated** (default 15 per page); use the paging controls at the bottom to move through pages.

### Per-Query Row (Collapsed)

Each list row shows:

- **Query score** – From the case scorer (and, if diff is on, scores for each snapshot in the comparison).
- **Query text** – The search phrase (tooltip can show “Info Need” if set).
- **Result count** – e.g. “47 Results.”
- **Warning icon** – Shown if the query had an error (e.g. search failure).
- **Unrated indicator** – e.g. frog icon + count of missing ratings when not all shown results are rated.
- **Querqy icon** – Shown when a Querqy rule was triggered for this query (if applicable).
- **Expand/collapse** – Click to open or close the row.

Click the row (or the expand control) to expand.

### Per-Query Row (Expanded)

![Expanded query with results and toolbar](images/core_case_evaluation_manual/05_query_expanded.png)

When expanded, you get:

- **Score All** – One place to set the rating for this query (e.g. default rating for the whole query). Opens the same rating scale popover as on individual docs.
- **Toolbar:**
  - **Copy** – Copy query text.
  - **Toggle Notes** – Show/hide the notes and “Information Need” fields.
  - **Query Explain** – Open explanation for how the query was executed (e.g. explain API).
  - **Missing Documents** – Open advanced search (e.g. by doc ID or query) to find and rate documents not in the current result set.
  - **Query options** – Per‑query overrides (e.g. custom scorer, options).
  - **Move query** – Move this query to another case.
  - **Delete Query** – Remove this query from the case.
- **Notes / Information Need** – Editable “Information Need” and “Notes on this Query” (saved on Save).
- **Diff results** – If a diff is active, a comparison view (e.g. side‑by‑side) for this query’s results vs selected snapshot(s).
- **Search results** – List of documents (or “Rated only” when “Show only rated” is on). For each result:
  - **Rating control** – Click to open the **rating popover**: choose a numeric rating from the scorer’s scale (and optional label). **RESET** clears the rating.
  - **Title** – Often a link; click to open the **detailed document** modal (all fields).
  - **Snippets / fields** – Displayed according to the try’s “Displayed fields” (and any thumbnails, media, translations if configured). Fields can show as plain text, links, or expandable JSON. **Document errors** (e.g. “This document can’t be uniquely identified…”) appear when the backend cannot store ratings for that result.
  - **Explain** – If available, a way to open explain for that doc, and a **stacked chart** (score breakdown) showing how the document’s score was computed (e.g. from Solr/ES explain).
- **Peek at next page** – Load more results for this query (when the endpoint returns more).
- **Browse on Solr** – For Solr, link to browse all results in the engine (if applicable).
- **Depth of rating note** – If the scorer only uses the top N results, a note like “Only the top N results are used in the scoring” or “Results above are counted in scoring” at the cutoff rank.

When “Show only rated” is on, the result list and “Peek at next page” are limited to **rated** documents only.

---

## Ratings and Scoring

![Rating popover on a search result](images/core_case_evaluation_manual/06_rating_popover.png)

- **Ratings** are per (query, document): you assign a relevance value (and optionally a label) from the scorer’s scale.
- **Query score** – The scorer computes a single score for each query from its ratings (e.g. AP@10, NDCG@10).
- **Case score** – Typically the average (or similar aggregate) of all query scores; shown in the case header.
- **Scorer** – Chosen in “Select scorer” and can be a built‑in (e.g. AP@10) or a custom scorer. The scale (e.g. 0–3) and labels are defined by the scorer.
- Scores update when:
  - You change ratings and the UI recalculates (and may persist scores).
  - You **Rerun My Searches** (or run in background), so results (and thus which docs are in the top N) may change and scores are recomputed.

The **Score All** control on a query sets a default rating for that query; individual result rows override with their own rating. The **rating popover** on each result is the main way to set per‑doc ratings.

---

## Tune Relevance (East Pane)

**Tune Relevance** toggles the east panel. The panel has **tabs**:

![East pane – Query tab (Query Sandbox)](images/core_case_evaluation_manual/07_east_pane_query_tab.png)

### Query (Query Sandbox)

- **Query parameters** for the current try:
  - **Solr** – Text area for query params (e.g. `q`, `fq`, `defType`).
  - **Elasticsearch / OpenSearch / Vectara / Algolia / SearchAPI** – JSON editor (e.g. query DSL).
- Used to define how each query text is sent to the endpoint (e.g. which field to search, boosts).
- Validation warnings may appear if the template is invalid or inconsistent with the engine.

### Tuning Knobs (Curator Variables)

![East pane – Tuning Knobs tab](images/core_case_evaluation_manual/08_east_pane_tuning_knobs.png)

- Variables you define in the query template with `##name##` (e.g. `title^##titleBoost##`).
- Each variable appears as a knob: you can change the value and then **Rerun My Searches** to see the effect.
- Add/remove knobs by editing the query template in the Query tab.

### Settings

![East pane – Settings tab](images/core_case_evaluation_manual/09_east_pane_settings.png)

- **Search Endpoints** – Choose which shared endpoint this try uses (dropdown or typeahead). You can link to “More” to edit the endpoint (e.g. URL, API key, custom HTTP headers).
- **Endpoint details** – Name, engine icon, URL, link to edit; TLS/protocol warning if Quepid and the endpoint use different HTTP/HTTPS. A warning appears if the selected endpoint has been **archived** (you can still use it; consider switching to an active endpoint).
- **Displayed fields** – Comma‑separated list of fields to show in result snippets (e.g. `title,description`). Must match what your query/engine returns.
- **Number of results** – How many results to request per query (e.g. 10; max 100).
- **Evaluate Nightly** – Checkbox to mark the case for nightly evaluation. **Rerun My Searches Now in the Background!** queues a background job to run all queries and store results/scores (then you can leave; progress is tracked via the job system).
- **Escape Queries** – (Advanced) Whether to escape special characters in query text. Turn off if you use engine-specific syntax (e.g. `title:value`).

### History

![East pane – History tab](images/core_case_evaluation_manual/10_east_pane_history.png)

- List of **tries** (past configurations). **Click a try** to switch the view to that try (URL and data load for that try).
- Links such as “Visualize your tries,” “Check Scores,” “Check Ratings” for analytics and data views.
- **“...” on a try** opens try details: **rename**, **delete try**, or **duplicate (clone) try**. You cannot delete the currently active try; switch to another try first.

### Annotations

![East pane – Annotations tab](images/core_case_evaluation_manual/11_east_pane_annotations.png)

- **Annotations** for the case: notes attached to scores over time (e.g. “Tuned title boost,” “Added new queries”). In this tab you can **add a new annotation** (attached to the current/last score), view the list of annotations, and edit or delete existing ones. You must have **run searches at least once** for the case before you can add an annotation (a score must exist). Used to record why scores changed.

### Rerun Actions (Bottom of Panel)

- **Rerun My Searches!** – Saves the current form values as a **new try** (creates a new try record), navigates to that try, then runs **all** queries in the case in the **foreground** and updates results and scores. This is the main way to “apply” changes after editing query params or knobs; each click builds your try history. For ES/OS/Vectara/Algolia/SearchAPI, the query template is validated as JSON before save; invalid JSON shows an error and does not save.
- **Rerun My Searches Now in the Background!** – Queues a **background job** to run all queries and store results/scores (useful for large cases or when you want to leave the page). Available in the Evaluate Nightly section; on success the UI **redirects to the app root** (e.g. dashboard); progress is visible via the Job Manager if you have access.
- If there is a **protocol mismatch** (e.g. Quepid on HTTPS, endpoint on HTTP), a button may appear to **Reload Quepid in [protocol]** or to fix the endpoint (e.g. use a proxied connection).

---

## Snapshots and Diffs

![Create snapshot modal](images/core_case_evaluation_manual/12_snapshot_modal.png)

![Diff modal – select snapshots to compare](images/core_case_evaluation_manual/13_diff_modal.png)

- **Create snapshot** – Saves the current result set (and associated state) for the case under a name and timestamp. Snapshots are used for comparison.
- **Diff** – Opens a modal to select one or more **snapshots**. After you select and confirm:
  - The UI fetches snapshot data and compares it to **current** results (per query and at case level).
  - You see **diff scores** (and optionally side‑by‑side result lists) for each snapshot vs current.
  - Case header and query rows can show extra score badges for each snapshot in the comparison.
- To stop comparing, open **Diff** again and clear the selection (or disable comparisons). The view returns to “current results only.”

This lets you compare “before vs after” or “try A vs try B” without losing the current try.

---

## Workflow Summary

1. **Open a case** (and try) from the header or cases list.
2. **Confirm or set the scorer** (Select scorer) and **search endpoint** (Tune Relevance → Settings).
3. **Add or adjust queries** (Add query; edit notes/info need if needed).
4. **Rate results** – Expand a query, use the rating popover on each result (or Score All for a default).
5. **Tune** – In Tune Relevance, edit Query sandbox and/or Tuning knobs, then click **Rerun My Searches!** to refresh results and scores.
6. **Iterate** – Change ratings or settings, rerun, and watch case/query scores. Use **Create snapshot** and **Diff** to compare configurations.
7. **Export/Share** – Use Export case, Share case, or Clone case as needed.

---

## Tips and Notes

- **Protocol:** If the endpoint uses a different protocol (HTTP/HTTPS) than Quepid, the UI may block requests or show a warning. Use a proxied endpoint or run Quepid and the endpoint on the same protocol.
- **Manual sort:** If “Manual” sort is disabled by configuration, you cannot drag‑and‑drop to reorder queries (see angularjs_inventory for the config flag).
- **Scores:** Case and query scores depend on the **current** scorer and **current** ratings; after rerun, result order may change and scores are recomputed from the same ratings applied to the new result set.
- **Background run:** “Rerun My Searches Now in the Background!” redirects to the root URL after queuing the job; use the Job Manager (admin) to monitor progress.
- **Static search endpoint:** If the case’s try uses a “Static” search endpoint (pre-loaded dataset), the Query sandbox and Tuning Knobs tabs indicate there are no query settings or knobs to adjust; live search tuning is not applicable.
- **Stalled progress:** If the “Updating Queries: X / Y” counter stalls during a run, try a hard refresh of the page.

For data model and app structure, see `docs/data_mapping.md` and `docs/app_structure.md`. For the AngularJS inventory and migration context, see `docs/angularjs_inventory.md`.
