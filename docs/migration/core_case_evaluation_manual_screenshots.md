# Screenshot Guide for Core Case Evaluation Manual

This document specifies the screenshots needed to illustrate `core_case_evaluation_manual.md`. Capture them from a running Quepid instance with at least one case that has queries, ratings, and a try with search results.

**UI stack:** The core case screen is moving from the AngularJS app to **Rails + Stimulus** (`core_new_ui` layout, `app/views/core/*`). Use the case action bar labels from [core_case_evaluation_manual.md](./core_case_evaluation_manual.md) when capturing. Image paths and filenames below stay fixed so existing manual links keep working.

**Where to save screenshots:** `docs/images/core_case_evaluation_manual/`  
**Naming:** Use the filenames below (PNG recommended).  
**Tips:** Use a case with 2–3 queries, one expanded; include the header and (optionally) the east pane open where relevant. You can redact or use demo data for sensitive content. After expanding a query, **run search** (e.g. **Re-run** / **Run All**) so results and ratings UI are visible where your build supports them.

---

## 1. Full layout (main area + header)

**Filename:** `01_full_layout.png`

**What to capture:** The full core interface with the east pane **closed**: header (Relevancy Cases, Books, etc.), case header (case score, case name, try name, scorer), case actions bar (Select scorer, Judgements, Create snapshot, Compare snapshots, Import, Share case, Clone, Delete, Export, Tune Relevance), and the query list with at least one query row visible (collapsed). Optional: one query expanded so the result list is visible.

**Purpose:** Illustrates the **Layout** and **Overview** — the three main areas (header, main area, no east pane).

---

## 2. Header (dropdown open)

**Filename:** `02_header_relevancy_cases.png`

**What to capture:** The top navbar with **Relevancy Cases** dropdown **open**, showing “RECENT CASES”, a few case names, “View all cases”, and “Create a case”.

**Purpose:** Illustrates the **Header** and how to switch cases or create a new case.

---

## 3. Case header and case actions bar

**Filename:** `03_case_header_and_actions.png`

**What to capture:** The case header row (case score badge, “Current case”, case name, try name, scorer name) and the full case actions bar: **Select scorer**, **Judgements**, **Create snapshot**, **Compare snapshots**, **Import**, **Share case**, **Clone**, **Delete**, **Export**, **Tune Relevance**. No need to show the query list.

**Purpose:** Illustrates **Case Header** and **Case Actions Bar**.

---

## 4. Query list (collapsed rows + list controls)

**Filename:** `04_query_list_controls.png`

**What to capture:** The query list area: **Run All** (play icon), **Add query** field (placeholder e.g. “Add a query to this case”) and **Add query** submit button, **Show only rated**, **Collapse all**, **Sort** (Manual, Name, Modified, Score, Errors), **Filter Queries** search box, **Number of Queries**, and several **collapsed** query rows (score strip, query text, rated/result summary as shown). Include the **FROG report** control if your build shows it (common on the legacy Angular query list); the Stimulus shell may omit it until parity. Pagination at the bottom **if** your build shows paging controls.

**Purpose:** Illustrates **Query List** and **List-Level Controls** and **Per-Query Row (Collapsed)**.

---

## 5. Query row expanded (results + toolbar)

**Filename:** `05_query_expanded.png`

**What to capture:** One **expanded** query row after searches have run: at minimum **Re-run**, **Delete Query**, and the **search results** list with at least 2–3 documents (rating control, title, snippets) if your build renders them. **Legacy Angular UI:** also capture **Score All** and the full toolbar (Copy, Toggle Notes, Query Explain, Missing Documents, Query options, Move, Delete Query) when present. Optionally the “Peek at next page” / “Browse on Solr” area at the bottom of the results.

**Purpose:** Illustrates **Per-Query Row (Expanded)**, **Search results**, and the **Toolbar** (full or partial depending on stack).

---

## 6. Rating popover

**Filename:** `06_rating_popover.png`

**What to capture:** The **rating popover** open on one result: scale values (e.g. 0, 1, 2, 3) and the RESET button. Keep the result row and part of the query visible for context.

**Purpose:** Illustrates **Ratings** and the **rating popover** described in the manual.

---

## 7. East pane – Query tab (Query Sandbox)

**Filename:** `07_east_pane_query_tab.png`

**What to capture:** **Tune Relevance** open (east pane visible) with the **Query** tab selected. Show the query sandbox: for Solr a text area with query params, or for ES/OS a JSON editor. Include the “Rerun My Searches!” button at the bottom if visible.

**Purpose:** Illustrates **Tune Relevance** and **Query (Query Sandbox)**.

---

## 8. East pane – Tuning Knobs tab

**Filename:** `08_east_pane_tuning_knobs.png`

**What to capture:** East pane with **Tuning Knobs** (Curator Variables) tab selected, showing at least one variable (e.g. `titleBoost` with a value). Include the “Rerun My Searches!” button at the bottom if visible.

**Purpose:** Illustrates **Tuning Knobs (Curator Variables)**.

---

## 9. East pane – Settings tab

**Filename:** `09_east_pane_settings.png`

**What to capture:** East pane with **Settings** tab selected. Show: Search Endpoints dropdown/typeahead, Endpoint details (name, URL), Displayed fields, Number of results, Evaluate Nightly checkbox, and “Rerun My Searches Now in the Background!” in the Nightly section. Optionally Escape Queries.

**Purpose:** Illustrates **Settings** (endpoints, fields, number of results, nightly, background run).

---

## 10. East pane – History tab

**Filename:** `10_east_pane_history.png`

**What to capture:** East pane with **History** tab selected: list of tries (with “...” on at least one), and links like “Visualize your tries”, “Check Scores”, “Check Ratings”.

**Purpose:** Illustrates **History** (tries list and try actions).

---

## 11. East pane – Annotations tab

**Filename:** `11_east_pane_annotations.png`

**What to capture:** East pane with **Annotations** tab selected: the “add annotation” area and the list of existing annotations (or empty state with message). Include the “New Annotation” / message input if visible.

**Purpose:** Illustrates **Annotations** tab.

---

## 12. Create snapshot modal

**Filename:** `12_snapshot_modal.png`

**What to capture:** The **Create snapshot** modal open: name field and Create/Cancel (or equivalent). Optional: snapshot name filled in.

**Purpose:** Illustrates **Snapshots** (Create snapshot).

---

## 13. Compare snapshots modal

**Filename:** `13_diff_modal.png`

**What to capture:** **Compare Your Search Results** (or equivalent) open after **Compare snapshots** on the case actions bar. Show list of snapshots with checkboxes (one or more selected), and Confirm/Cancel (or equivalent).

**Purpose:** Illustrates **Snapshots** → **Compare snapshots**.

---

## 14. Select scorer modal

**Filename:** `14_select_scorer_modal.png`

**What to capture:** The **Select scorer** modal: list of scorers (e.g. AP@10, NDCG@10, custom) and Select Scorer / Cancel buttons.

**Purpose:** Illustrates **Case Actions Bar** → Select scorer.

---

## 15. Delete case options modal

**Filename:** `15_delete_options_modal.png`

**What to capture:** The **Delete** options modal: the three options (Delete All Queries, Archive Case, Delete Case) with one selected and the explanatory text visible. Cancel and the red action button visible.

**Purpose:** Illustrates **Case Actions Bar** → Delete (with options).

---

## 16. Loading / bootstrapping (optional)

**Filename:** `16_loading_bootstrapping.png`

**What to capture:** Either the initial loading state or in-progress query run feedback (e.g. “Bootstrapping Queries” / “Updating Queries: X / Y” on legacy Angular; equivalent messaging on the migrated stack if different).

**Purpose:** Illustrates **Access and URL** loading/progress states.

---

## Summary table

| # | Filename | Section(s) |
|---|----------|------------|
| 1 | `01_full_layout.png` | Layout, Overview |
| 2 | `02_header_relevancy_cases.png` | Header |
| 3 | `03_case_header_and_actions.png` | Case Header, Case Actions Bar |
| 4 | `04_query_list_controls.png` | Query List, List-Level Controls, Per-Query Row (Collapsed) |
| 5 | `05_query_expanded.png` | Per-Query Row (Expanded), Search results |
| 6 | `06_rating_popover.png` | Ratings and Scoring |
| 7 | `07_east_pane_query_tab.png` | Tune Relevance, Query Sandbox |
| 8 | `08_east_pane_tuning_knobs.png` | Tuning Knobs |
| 9 | `09_east_pane_settings.png` | Settings |
| 10 | `10_east_pane_history.png` | History |
| 11 | `11_east_pane_annotations.png` | Annotations |
| 12 | `12_snapshot_modal.png` | Snapshots |
| 13 | `13_diff_modal.png` | Snapshots (Compare snapshots modal) |
| 14 | `14_select_scorer_modal.png` | Case Actions Bar |
| 15 | `15_delete_options_modal.png` | Case Actions Bar |
| 16 | `16_loading_bootstrapping.png` | Access and URL (optional) |

After capturing, place the files in `docs/images/core_case_evaluation_manual/`. The manual already references these paths; once the files exist, the images will appear in the rendered doc.
