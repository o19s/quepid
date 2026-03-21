# Screenshot Guide for Core Case Evaluation Manual

This document specifies screenshots for [`core_case_evaluation_manual.md`](./core_case_evaluation_manual.md). Capture them from a running Quepid instance with at least one case that has queries, ratings, and a try with search results.

**UI stack:** The core case screen is moving from the AngularJS app to **Rails + Stimulus** (`core_new_ui` layout, `app/views/core/*`). Use the case action bar labels from the manual when capturing. Image paths and **core** filenames (Part A) stay fixed so existing links keep working.

**Where to save screenshots:** `docs/images/core_case_evaluation_manual/`  
**Naming:** Use the filenames below (PNG recommended).  
**Tips:** Use a case with 2–3 queries, one expanded; include the header and (optionally) the east pane open where relevant. You can redact or use demo data for sensitive content. After expanding a query, **run search** (e.g. **Re-run** / **Run All**) so results and ratings UI are visible where your build supports them.

**Manual presentation:** In [`core_case_evaluation_manual.md`](./core_case_evaluation_manual.md), screenshots are embedded as **clickable thumbnails** (640px wide) linking to the same PNG for full-size viewing.

**Mockups:** Some Part B images were produced as static template mockups (see [angularjs_ui_inventory.md](./angularjs_ui_inventory.md) — 🟡 real template, 🟠 approximation). Prefer live captures when refreshing.

---

## Part A — Core figures (`01`–`16`)

Essential shots referenced in the manual’s main flow. Filenames are stable.

### 1. Full layout (main area + header)

**Filename:** `01_full_layout.png`

**What to capture:** The full core interface with the east pane **closed**: header (Relevancy Cases, Books, etc.), case header (case score, case name, try name, scorer), case actions bar (Select scorer, Judgements, Create snapshot, Compare snapshots, Import, Share case, Clone, Delete, Export, Tune Relevance), and the query list with at least one query row visible (collapsed). Optional: one query expanded so the result list is visible.

**Manual section:** Layout, Overview

---

### 2. Header (dropdown open)

**Filename:** `02_header_relevancy_cases.png`

**What to capture:** The top navbar with **Relevancy Cases** dropdown **open**, showing “RECENT CASES”, a few case names, “View all cases”, and “Create a case”.

**Manual section:** Header

---

### 3. Case header and case actions bar

**Filename:** `03_case_header_and_actions.png`

**What to capture:** The case header row (case score badge, “Current case”, case name, try name, scorer name) and the full case actions bar: **Select scorer**, **Judgements**, **Create snapshot**, **Compare snapshots**, **Import**, **Share case**, **Clone**, **Delete**, **Export**, **Tune Relevance**. No need to show the query list.

**Manual section:** Case Header, Case Actions Bar

---

### 4. Query list (collapsed rows + list controls)

**Filename:** `04_query_list_controls.png`

**What to capture:** The query list area: **Add query** field (placeholder e.g. “Add a query to this case”) and **Add query** submit button, **Show only rated**, **Collapse all**, **Sort** (Manual, Name, Modified, Score, Errors), **Filter Queries** search box, **Number of Queries**, and several **collapsed** query rows (score strip, query text, rated/result summary as shown). Include the **FROG report** control if your build shows it (common on the legacy Angular query list); the Stimulus shell may omit it until parity. Pagination at the bottom **if** your build shows paging controls. Include **Run All** if your build shows it (Stimulus shell).

**Manual section:** Query List

---

### 5. Query row expanded (results + toolbar)

**Filename:** `05_query_expanded.png`

**What to capture:** One **expanded** query row after searches have run: at minimum **Re-run**, **Delete Query**, and the **search results** list with at least 2–3 documents (rating control, title, snippets) if your build renders them. **Legacy Angular UI:** also capture **Score All** and the full toolbar (Copy, Toggle Notes, Query Explain, Missing Documents, Query options, Move, Delete Query) when present. Optionally the “Peek at next page” / “Browse on Solr” area at the bottom of the results.

**Manual section:** Per-Query Row (Expanded)

---

### 6. Rating popover

**Filename:** `06_rating_popover.png`

**What to capture:** The **rating popover** open on one result: scale values (e.g. 0, 1, 2, 3) and the RESET button. Keep the result row and part of the query visible for context.

**Manual section:** Ratings and Scoring

---

### 7. East pane – Query tab (Query Sandbox)

**Filename:** `07_east_pane_query_tab.png`

**What to capture:** **Tune Relevance** open (east pane visible) with the **Query** tab selected. Show the query sandbox: for Solr a text area with query params, or for ES/OS a JSON editor. Include the “Rerun My Searches!” button at the bottom if visible.

**Manual section:** Tune Relevance → Query

---

### 8. East pane – Tuning Knobs tab

**Filename:** `08_east_pane_tuning_knobs.png`

**What to capture:** East pane with **Tuning Knobs** (Curator Variables) tab selected, showing at least one variable (e.g. `titleBoost` with a value). Include the “Rerun My Searches!” button at the bottom if visible.

**Manual section:** Tune Relevance → Tuning Knobs

---

### 9. East pane – Settings tab

**Filename:** `09_east_pane_settings.png`

**What to capture:** East pane with **Settings** tab selected. Show: Search Endpoints dropdown/typeahead, Endpoint details (name, URL), Displayed fields, Number of results, Evaluate Nightly checkbox, and “Rerun My Searches Now in the Background!” in the Nightly section. Optionally Escape Queries.

**Manual section:** Tune Relevance → Settings

---

### 10. East pane – History tab

**Filename:** `10_east_pane_history.png`

**What to capture:** East pane with **History** tab selected: list of tries (with “...” on at least one), and links like “Visualize your tries”, “Check Scores”, “Check Ratings”.

**Manual section:** Tune Relevance → History

---

### 11. East pane – Annotations tab

**Filename:** `11_east_pane_annotations.png`

**What to capture:** East pane with **Annotations** tab selected: the “add annotation” area and the list of existing annotations (or empty state with message). Include the “New Annotation” / message input if visible.

**Manual section:** Tune Relevance → Annotations

---

### 12. Create snapshot modal

**Filename:** `12_snapshot_modal.png`

**What to capture:** The **Create snapshot** / **Take a Snapshot** modal open: **snapshot name** field, **Record document fields?** (Include Document Fields) checkbox, primary action (e.g. Take Snapshot) and Cancel. Optional: snapshot name filled in.

**Manual section:** Snapshots

---

### 13. Compare snapshots modal (legacy capture)

**Filename:** `13_diff_modal.png`

**What to capture:** Older **Compare Your Search Results** UI with **checkbox** (or list) selection of snapshots—kept for historical reference. **Prefer `60_compare_snapshots_modal.png`** for the current Angular `diff/_modal.html` (dropdown + Add Snapshot).

**Manual section:** Snapshots (legacy)

---

### 14. Select scorer modal

**Filename:** `14_select_scorer_modal.png`

**What to capture:** The **Select scorer** modal: list of scorers (e.g. AP@10, NDCG@10, custom) and Select Scorer / Cancel buttons.

**Manual section:** Case Actions Bar

---

### 15. Delete case options modal

**Filename:** `15_delete_options_modal.png`

**What to capture:** The **Delete** options modal: the three options (Delete All Queries, Archive Case, Delete Case) with one selected and the explanatory text visible. Cancel and the red action button visible.

**Manual section:** Case Actions Bar

---

### 16. Loading / bootstrapping (optional)

**Filename:** `16_loading_bootstrapping.png`

**What to capture:** Either the initial loading state or in-progress query run feedback (e.g. “Bootstrapping Queries” / “Updating Queries: X / Y” on legacy Angular; equivalent messaging on the migrated stack if different).

**Manual section:** Access and URL

---

## Part B — Extended figures (Angular parity and deep UI)

Additional filenames used by the manual for modals, east-pane detail, errors, and migration reference. When re-capturing, match the **current** Angular templates where possible.

### 17. Clone case modal

**Filename:** `17_clone_case_modal.png` — **Manual:** Case Actions → Case action modals

**What to capture:** Clone case modal: new case name, history scope (try vs full history), try selector, include queries/ratings checkboxes, Clone / Cancel.

---

### 18. Share case modal

**Filename:** `18_share_case_modal.png` — **Manual:** Case Actions → Case action modals

**What to capture:** Share Case modal: teams list or empty state, create team link if shown, Cancel.

---

### 19. Export case modal

**Filename:** `19_export_case_modal.png` — **Manual:** Case Actions → Case action modals

**What to capture:** Export Case modal: format radio options (CSV variants, TREC, RRE, LTR, etc.) with short descriptions, Export / Cancel.

---

### 20. Import ratings modal

**Filename:** `20_import_ratings_modal.png` — **Manual:** Case Actions → Case action modals

**What to capture:** Import into Case modal: tabs (Ratings, Information Needs, Snapshots), format radios, file chooser, optional “clear existing queries”, Import / Cancel.

---

### 21. Judgements modal

**Filename:** `21_judgements_modal.png` — **Manual:** Case Actions → Case action modals

**What to capture:** Judgements modal: Book association text, populate options, Refresh ratings / Create book / Cancel.

---

### 22. FROG Pond Report modal

**Filename:** `22_frog_report_modal.png` — **Manual:** Query List → FROG report

**What to capture:** Frog report open from query list link: summary stats, distribution chart, Close.

---

### 23. Query Explain modal

**Filename:** `23_query_explain_modal.png` — **Manual:** Per-Query Row → toolbar modals

**What to capture:** Explain Query Parsing: tabs (Params, Parsing, Query Template), JSON or structured output, Copy / Close.

---

### 24. Targeted search (Missing Documents) modal

**Filename:** `24_targeted_search_modal.png` — **Manual:** Per-Query Row → toolbar modals

**What to capture:** Find and Rate Missing Documents: search input, Lucene-syntax help, Search / Reset / Close.

---

### 25. Query Options modal

**Filename:** `25_query_options_modal.png` — **Manual:** Per-Query Row → toolbar modals

**What to capture:** Query Options: JSON ACE editor for per-query overrides, Set Options / Cancel.

---

### 26. Move Query modal

**Filename:** `26_move_query_modal.png` — **Manual:** Per-Query Row → toolbar modals

**What to capture:** Move Query to Another Case: destination case selector or empty state, Cancel.

---

### 27. Detailed Document modal

**Filename:** `27_detailed_document_modal.png` — **Manual:** Per-Query Row → toolbar modals

**What to capture:** Detailed Document View: field table, View Document / View All Fields / Close.

---

### 28. Matches / stacked chart

**Filename:** `28_matches_explain.png` — **Manual:** Per-Query Row → figures

**What to capture:** Expanded result with **Matches** / `<stacked-chart>` visible on the right column.

---

### 29. Notes and Information Need

**Filename:** `29_notes_information_need.png` — **Manual:** Per-Query Row → figures

**What to capture:** Expanded query with **Toggle Notes** on: Information Need input, Notes textarea, Save.

---

### 30. Peek / Browse on Solr

**Filename:** `30_peek_browse_results.png` — **Manual:** Per-Query Row → figures

**What to capture:** Bottom of result list: Peek at next page link, Browse on Solr button (if Solr), depth-of-rating note if visible.

---

### 31. Try details (History “…”)

**Filename:** `31_try_details.png` — **Manual:** Tune Relevance → History

**What to capture:** Try row with “…” open or try detail panel: rename, delete try, duplicate try.

---

### 48. Inline case rename

**Filename:** `48_inline_case_name_edit.png` — **Manual:** Case Header

**What to capture:** Case name in inline edit mode (input + Rename / Cancel).

---

### 49. Score All (popover open)

**Filename:** `49_bulk_rating_score_all.png` — **Manual:** Per-Query Row / Ratings

**What to capture:** **Score All** control with the same rating popover template open as on a single doc.

---

### 52. Archive case confirm

**Filename:** `52_archive_case_confirm.png` — **Manual:** Alternate delete / archive flows

**What to capture:** Archive confirmation from cases list (or equivalent flow), Cancel / Confirm.

---

### 53. Custom headers editor

**Filename:** `53_custom_headers_editor.png` — **Manual:** Tune Relevance → Settings (endpoint configuration parity)

**What to capture:** `<custom-headers>` UI (currently in case wizard template; acceptable stand-in for headers editing).

---

### 54. ACE query editor

**Filename:** `54_ace_query_editor.png` — **Manual:** Tune Relevance → Query

**What to capture:** East pane Query tab for ES/OS (or similar): ACE JSON editor with gutter and syntax highlighting.

---

### 55. Field picking (displayed fields)

**Filename:** `55_field_picking_settings.png` — **Manual:** Tune Relevance → Settings

**What to capture:** Rich displayed-fields UI (e.g. tag tokens) if enabled in your build.

---

### 56. Nightly + Escape Queries detail

**Filename:** `56_settings_nightly_escape.png` — **Manual:** Tune Relevance → Settings

**What to capture:** Evaluate Nightly section and Escape Queries section with tooltips/labels legible.

---

### 60. Compare snapshots (canonical Angular)

**Filename:** `60_compare_snapshots_modal.png` — **Manual:** Snapshots

**What to capture:** **Compare Your Search Results** matching live `diff/_modal.html`: Snapshot 1..N dropdowns, **Add Snapshot**, duplicate/processing warnings if applicable, **Update Comparison Settings**, **Clear Comparison View**, **Cancel**.

**Note:** **`13_diff_modal.png`** is the legacy checkbox-style capture; use **`60_compare_snapshots_modal.png`** for documentation updates unless you intentionally document historical UI.

---

### 61. Annotation list items

**Filename:** `61_annotation_list_with_items.png` — **Manual:** Tune Relevance → Annotations

**What to capture:** List of saved annotations with timestamps, try/score context, hamburger menus (🟡 mockup acceptable per inventory).

---

### 61b. Edit Annotation modal

**Filename:** `61b_annotation_update_modal.png` — **Manual:** Tune Relevance → Annotations

**What to capture:** Edit Annotation: message textarea, Update / Cancel (🟡 mockup acceptable).

---

### 62. Pagination controls

**Filename:** `62_pagination_controls.png` — **Manual:** Query List

**What to capture:** `dir-pagination-controls` at bottom of list: prev / page numbers / next.

---

### 64. Debug matches / detailed explain modal

**Filename:** `64_debug_matches_modal.png` — **Manual:** Per-Query Row → advanced result actions

**What to capture:** Debug explain modal with JSON tree (Lucene-style breakdown) (🟡 mockup acceptable).

---

### 65. Expand content modal

**Filename:** `65_expand_content_modal.png` — **Manual:** Per-Query Row → advanced result actions

**What to capture:** Expanded View: full relevancy explain text (🟡 mockup acceptable).

---

### 66. Query diff results

**Filename:** `66_query_diff_results.png` — **Manual:** Snapshots (comparison active)

**What to capture:** Side-by-side **Current Results** vs snapshot column(s), ranks, “No result at position N” if shown (🟠 mockup acceptable).

---

### 68. Vega tries visualization

**Filename:** `68_vega_visualization.png` — **Manual:** Tune Relevance → History

**What to capture:** “Visualize your tries” graph (tree/cluster) from live app.

---

### 70. Flash messages

**Filename:** `70_flash_messages.png` — **Manual:** Access and URL

**What to capture:** Success (green) and error (red) flash banners with dismiss control (🟡 mockup acceptable).

---

### 71. Delete case (simple modal)

**Filename:** `71_delete_case_simple_modal.png` — **Manual:** Alternate delete flows

**What to capture:** Simple “Delete This Case” confirmation (🟡 mockup acceptable).

---

### 73. Case header badges

**Filename:** `73_case_header_badges.png` — **Manual:** Case Header

**What to capture:** PUBLIC, ARCHIVED badges and nightly icon on case header (🟠 mockup acceptable).

---

### 74. Diff scores in case header

**Filename:** `74_diff_scores_header.png` — **Manual:** Snapshots

**What to capture:** Case score area with current score plus snapshot comparison score badges side by side (🟠 mockup acceptable).

---

### 75. Query error row

**Filename:** `75_query_error_state.png` — **Manual:** Query List → Per-Query Row (Collapsed)

**What to capture:** Query row in error state: ERR styling, warning text (🟠 mockup acceptable).

---

### 76. Threshold indicator

**Filename:** `76_threshold_indicator.png` — **Manual:** Per-Query Row → results

**What to capture:** Threshold bar above/below styling with check/X (🟠 mockup acceptable).

---

### 77. Search endpoint typeahead

**Filename:** `77_search_endpoint_typeahead.png` — **Manual:** Tune Relevance → History / Settings

**What to capture:** Typeahead dropdown open on “Select endpoint to use” with engine icons and URLs (🟠 mockup acceptable).

---

### 78. Media embed

**Filename:** `78_media_embed.png` — **Manual:** Per-Query Row → results

**What to capture:** Result row with `[quepid-embed]` audio/video/image placeholder (🟠 mockup acceptable).

---

### 79. Debug and Expand buttons

**Filename:** `79_debug_expand_buttons.png` — **Manual:** Per-Query Row → results

**What to capture:** Inline **Debug** and **Expand** buttons on a result (🟡 mockup acceptable).

---

### 80. Drag-and-drop reorder

**Filename:** `80_drag_drop_reorder.png` — **Manual:** Query List

**What to capture:** Manual sort enabled: grip handles on rows, optional mid-drag dashed border (🟠 mockup acceptable).

---

## Summary tables

### Part A (core)

| # | Filename | Manual section(s) |
|---|----------|-------------------|
| 1 | `01_full_layout.png` | Layout, Overview |
| 2 | `02_header_relevancy_cases.png` | Header |
| 3 | `03_case_header_and_actions.png` | Case Header, Case Actions Bar |
| 4 | `04_query_list_controls.png` | Query List |
| 5 | `05_query_expanded.png` | Per-Query Row (Expanded) |
| 6 | `06_rating_popover.png` | Ratings and Scoring |
| 7 | `07_east_pane_query_tab.png` | Tune Relevance → Query |
| 8 | `08_east_pane_tuning_knobs.png` | Tune Relevance → Tuning Knobs |
| 9 | `09_east_pane_settings.png` | Tune Relevance → Settings |
| 10 | `10_east_pane_history.png` | Tune Relevance → History |
| 11 | `11_east_pane_annotations.png` | Tune Relevance → Annotations |
| 12 | `12_snapshot_modal.png` | Snapshots |
| 13 | `13_diff_modal.png` | Snapshots (legacy compare UI) |
| 14 | `14_select_scorer_modal.png` | Case Actions Bar |
| 15 | `15_delete_options_modal.png` | Case Actions Bar |
| 16 | `16_loading_bootstrapping.png` | Access and URL (optional) |

### Part B (extended)

| Filename | Manual section(s) |
|----------|-------------------|
| `17_clone_case_modal.png` | Case Actions → modals |
| `18_share_case_modal.png` | Case Actions → modals |
| `19_export_case_modal.png` | Case Actions → modals |
| `20_import_ratings_modal.png` | Case Actions → modals |
| `21_judgements_modal.png` | Case Actions → modals |
| `22_frog_report_modal.png` | Query List |
| `23_query_explain_modal.png` | Per-Query Row |
| `24_targeted_search_modal.png` | Per-Query Row |
| `25_query_options_modal.png` | Per-Query Row |
| `26_move_query_modal.png` | Per-Query Row |
| `27_detailed_document_modal.png` | Per-Query Row |
| `28_matches_explain.png` | Per-Query Row |
| `29_notes_information_need.png` | Per-Query Row |
| `30_peek_browse_results.png` | Per-Query Row |
| `31_try_details.png` | Tune Relevance → History |
| `48_inline_case_name_edit.png` | Case Header |
| `49_bulk_rating_score_all.png` | Per-Query Row / Ratings |
| `52_archive_case_confirm.png` | Alternate delete / archive |
| `53_custom_headers_editor.png` | Tune Relevance → Settings |
| `54_ace_query_editor.png` | Tune Relevance → Query |
| `55_field_picking_settings.png` | Tune Relevance → Settings |
| `56_settings_nightly_escape.png` | Tune Relevance → Settings |
| `60_compare_snapshots_modal.png` | Snapshots (canonical) |
| `61_annotation_list_with_items.png` | Tune Relevance → Annotations |
| `61b_annotation_update_modal.png` | Tune Relevance → Annotations |
| `62_pagination_controls.png` | Query List |
| `64_debug_matches_modal.png` | Per-Query Row |
| `65_expand_content_modal.png` | Per-Query Row |
| `66_query_diff_results.png` | Snapshots |
| `68_vega_visualization.png` | Tune Relevance → History |
| `70_flash_messages.png` | Access and URL |
| `71_delete_case_simple_modal.png` | Alternate delete flows |
| `73_case_header_badges.png` | Case Header |
| `74_diff_scores_header.png` | Snapshots |
| `75_query_error_state.png` | Query List |
| `76_threshold_indicator.png` | Per-Query Row |
| `77_search_endpoint_typeahead.png` | Tune Relevance |
| `78_media_embed.png` | Per-Query Row |
| `79_debug_expand_buttons.png` | Per-Query Row |
| `80_drag_drop_reorder.png` | Query List |

After capturing, place files in `docs/images/core_case_evaluation_manual/`. Additional images in that directory (login, admin, wizard-only steps, etc.) are specified in [angularjs_ui_inventory.md](./angularjs_ui_inventory.md), not necessarily in this guide.
