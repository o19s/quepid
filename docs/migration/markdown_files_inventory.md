# Markdown Files Inventory

All `.md` files tracked in the Quepid repository, with UI state screenshot coverage analysis.

## Existing Screenshots

Screenshots in `docs/images/core_case_evaluation_manual/`:

| # | Filename | Description |
|---|----------|-------------|
| 01 | `01_full_layout.png` | Main view, east pane closed |
| 02 | `02_header_relevancy_cases.png` | Relevancy Cases dropdown open |
| 03 | `03_case_header_and_actions.png` | Case header + actions bar |
| 04 | `04_query_list_controls.png` | Query list with controls |
| 05 | `05_query_expanded.png` | Expanded query with results |
| 06 | `06_rating_popover.png` | Rating popover on a result |
| 07 | `07_east_pane_query_tab.png` | East pane, Query tab |
| 08 | `08_east_pane_tuning_knobs.png` | East pane, Tuning Knobs tab |
| 09 | `09_east_pane_settings.png` | East pane, Settings tab |
| 10 | `10_east_pane_history.png` | East pane, History tab |
| 11 | `11_east_pane_annotations.png` | East pane, Annotations tab |
| 12 | `12_snapshot_modal.png` | Create Snapshot modal |
| 13 | `13_diff_modal.png` | Diff/Compare modal |
| 14 | `14_select_scorer_modal.png` | Select Scorer modal |
| 15 | `15_delete_options_modal.png` | Delete Case options modal |
| 16 | `16_loading_bootstrapping.png` | Loading/bootstrapping state |
| 17 | `17_clone_case_modal.png` | Clone Case modal |
| 18 | `18_share_case_modal.png` | Share Case modal |
| 19 | `19_export_case_modal.png` | Export Case modal |
| 20 | `20_import_ratings_modal.png` | Import Ratings modal |
| 21 | `21_judgements_modal.png` | Judgements modal |
| 22 | `22_frog_report_modal.png` | FROG Report modal |
| 23 | `23_query_explain_modal.png` | Query Explain modal |
| 24 | `24_targeted_search_modal.png` | Targeted Search / Missing Documents modal |
| 25 | `25_query_options_modal.png` | Query Options modal |
| 26 | `26_move_query_modal.png` | Move Query modal |
| 27 | `27_detailed_document_modal.png` | Detailed Document modal |
| 28 | `28_matches_explain.png` | Matches/Explain (stacked chart) |
| 29 | `29_notes_information_need.png` | Notes / Information Need editing |
| 30 | `30_peek_browse_results.png` | Peek at next page / Browse on Solr |
| 31 | `31_try_details.png` | Try details (from History "...") |
| 32 | `32_login_page.png` | Login page (email/password + OAuth) |
| 33 | `33_signup_page.png` | Signup / registration form |
| 34 | `34_announcement_banner.png` | Announcement notification banner on home page |
| 34a | `34a_admin_announcement_form.png` | Admin: New Announcement form |
| 35 | `35_team_details.png` | Team details page (members, cases, endpoints) |
| 36 | `36_user_menu_dropdown.png` | User menu / avatar dropdown |
| 37 | `37_book_dropdown.png` | Book dropdown in header |
| 38 | `38_footer.png` | Footer with support links |
| 39 | `39_user_profile.png` | User profile page |
| 40 | `40_admin_dashboard.png` | Admin Panel dashboard |
| 41 | `41_admin_users.png` | Admin Users management |
| 42 | `42_admin_announcements.png` | Admin Announcements page |
| 43 | `43_admin_job_manager.png` | Admin Job Manager |
| 44 | `44_scorers_list.png` | Scorers list (with admin actions) |
| 45 | `45_search_endpoints_list.png` | Search Endpoints list |
| 46 | `46_books_list.png` | Books list page |
| 47 | `47_book_details.png` | Book details page |
| 48 | `48_inline_case_name_edit.png` | Inline case name editing (double-click) |
| 49 | `49_bulk_rating_score_all.png` | Bulk rating / Score All popover |
| 50 | `50_scorer_edit_form.png` | Scorer create/edit form (name, code, scale, labels) |
| 51 | `51_communal_scorer_edit.png` | Communal scorer edit with warning banners |
| 52 | `52_archive_case_confirm.png` | Archive case confirmation modal |
| 53 | `53_custom_headers_editor.png` | East pane Settings (custom headers area) |
| 54 | `54_ace_query_editor.png` | ACE / Query Sandbox editor |
| 55 | `55_field_picking_settings.png` | Field picking / Displayed Fields in Settings |
| 56 | `56_settings_nightly_escape.png` | Settings: Nightly eval and Escape Queries |
| 57 | `57_home_dashboard.png` | Home dashboard with case summary cards and prophet trends |
| 58 | `58_healthcheck.png` | Healthcheck endpoint |
| 59 | `59_cases_list.png` | Cases list / dashboard page |
| 60 | `60_compare_snapshots_modal.png` | Compare snapshots modal (select snapshots to diff) |
| W1 | `wizard_01_welcome.png` | Wizard: Welcome page |
| W2 | `wizard_02_doug_welcome.png` | Wizard: Doug's welcome message |
| W3 | `wizard_03_name_case.png` | Wizard: Name Your Case |
| W4 | `wizard_04_search_endpoint.png` | Wizard: Search endpoint (accordion) |
| W4b | `wizard_04b_engine_selection.png` | Wizard: Engine selection |
| W4b2 | `wizard_04b_endpoint_result.png` | Wizard: Endpoint result |
| W5 | `wizard_05_display_fields.png` | Wizard: Display fields |
| W6 | `wizard_06_add_queries.png` | Wizard: Add queries |
| W7 | `wizard_07_finish.png` | Wizard: Finish |

---

## Per-File UI State Analysis

### `CHANGELOG.md`

No UI states mentioned. Release notes and version history.

---

### `CLAUDE.md`

No UI states mentioned. Development configuration instructions.

---

### `CODE_OF_CONDUCT.md`

No UI states mentioned.

---

### `DEVELOPER_GUIDE.md`

**Covered:**
- Admin Dashboard / home page → `40_admin_dashboard.png`
- Users Management page (admin) → `41_admin_users.png`
- Announcements page (admin) → `42_admin_announcements.png`
- Job Manager (admin) → `43_admin_job_manager.png`

**Not covered:**
- Keycloak / OIDC login page (requires Keycloak to be configured)

---

### `README.md`

No specific UI states mentioned. Project overview and setup instructions.

---

### `.claude-on-rails/` (all files)

No UI states mentioned. Agent configuration prompts.

---

### `.github/` (all files)

No UI states mentioned. Issue/PR templates.

---

### `deployment/cloudformation/README.md`

No UI states mentioned. Infrastructure documentation.

---

### `deployment/quepid-docker-deploy/README.md`

**Covered:**
- User registration/signup screen → `33_signup_page.png`

---

### `docs/core_case_evaluation_manual.md`

**Covered:**
- Full layout → `01_full_layout.png`
- Header with Relevancy Cases dropdown → `02_header_relevancy_cases.png`
- Case header and actions bar → `03_case_header_and_actions.png`
- Query list with controls → `04_query_list_controls.png`
- Expanded query with results → `05_query_expanded.png`
- Rating popover → `06_rating_popover.png`
- East pane Query tab → `07_east_pane_query_tab.png`
- East pane Tuning Knobs tab → `08_east_pane_tuning_knobs.png`
- East pane Settings tab → `09_east_pane_settings.png`
- East pane History tab → `10_east_pane_history.png`
- East pane Annotations tab → `11_east_pane_annotations.png`
- Create Snapshot modal → `12_snapshot_modal.png`
- Diff modal → `13_diff_modal.png`
- Select Scorer modal → `14_select_scorer_modal.png`
- Delete Case options modal → `15_delete_options_modal.png`
- Loading/bootstrapping state → `16_loading_bootstrapping.png`
- Clone Case modal → `17_clone_case_modal.png`
- Share Case modal → `18_share_case_modal.png`
- Export Case modal → `19_export_case_modal.png`
- Import Ratings modal → `20_import_ratings_modal.png`
- Judgements modal → `21_judgements_modal.png`
- FROG report → `22_frog_report_modal.png`
- Query Explain modal → `23_query_explain_modal.png`
- Missing Documents / Targeted Search modal → `24_targeted_search_modal.png`
- Query Options modal → `25_query_options_modal.png`
- Move Query modal → `26_move_query_modal.png`
- Detailed Document modal → `27_detailed_document_modal.png`
- Matches/Explain stacked chart → `28_matches_explain.png`
- Notes / Information Need → `29_notes_information_need.png`
- Peek at next page / Browse on Solr → `30_peek_browse_results.png`
- Try details → `31_try_details.png`
- Case creation wizard → `wizard_01` through `wizard_07`

**Newly covered:**
- Inline case name editing → `48_inline_case_name_edit.png`

**Not covered (require specific runtime state):**
- Flash messages / success-error feedback at top of page (transient)
- Search-error area (dedicated error display per query, requires failing endpoint)
- Protocol mismatch button ("Reload Quepid in [protocol]", requires mixed-content condition)

---

### `docs/core_case_evaluation_manual_screenshots.md`

Specifies screenshots 01–16. All covered. No additional UI states beyond what's in the manual.

---

### `docs/app_structure.md`

**Covered:**
- Admin area for managing users and default scorers → `40_admin_dashboard.png`, `41_admin_users.png`, `44_scorers_list.png`
- User account/password management → `39_user_profile.png`

---

### `docs/angularjs_inventory.md`

**Covered:**
- All 31 main screenshots and wizard screenshots are referenced through their corresponding AngularJS controllers/templates.
- Custom HTTP headers editor → `53_custom_headers_editor.png`
- ACE editor for query parameters → `54_ace_query_editor.png`
- Stacked chart / score breakdown → partially in `28_matches_explain.png`
- CSV import interface → covered by `20_import_ratings_modal.png`

**Newly covered:**
- Archive/Unarchive case confirm modal → `52_archive_case_confirm.png`
- Compare snapshots modal → `60_compare_snapshots_modal.png`

**Not covered (excluded or require specific state):**
- 404 error page (`404.html`) — excluded per user request
- Media embed displays (audio/image/video) (`embed.html`) — requires specific data with media fields
- Flash messages / alerts container (`flash.html`) — transient UI element
- Vega chart visualizations — requires specific visualization config

---

### `docs/operating_documentation.md`

**Covered:**
- Login page (email/password + OAuth) → `32_login_page.png`
- Signup / user invitation page → `33_signup_page.png`
- OAuth sign-in options (Google, OpenID) → visible in `32_login_page.png`
- User profile management page → `39_user_profile.png`
- Footer with support links → `38_footer.png`
- Admin home page → `40_admin_dashboard.png`
- Healthcheck endpoint status page → `58_healthcheck.png`
- Announcement notification banner → `34_announcement_banner.png`

**Not covered (excluded or require specific config):**
- Password reset flow — excluded per user request
- Legal pages (terms & conditions, privacy policy, cookies policy) — excluded per user request
- GDPR consent checkbox on signup — not configured in dev environment
- Email marketing consent checkbox on signup — not configured in dev environment

---

### `docs/admin_communal_scorers_removal.md`

**Covered:**
- Scorers list (includes communal scorers with admin actions) → `44_scorers_list.png`

**Not covered (historical feature, partially removed):**
- Admin communal scorers list view (`/admin/communal_scorers`) — route removed
- Delete confirmation prompt for communal scorers — transient dialog

---

### `docs/admin_scorer_editing.md`

**Covered:**
- Scorers list view with admin actions → `44_scorers_list.png`
- Communal scorer edit form (name, code, scale, scale labels fields) → `51_communal_scorer_edit.png`
- Warning banner: "You are editing a communal scorer..." → `51_communal_scorer_edit.png`
- Info alert: "This is a communal scorer available to all Quepid users." → `51_communal_scorer_edit.png`
- Scorer create/edit form → `50_scorer_edit_form.png`

---

### `docs/data_mapping.md`

References data model entities (Cases, Queries, Ratings, Scores, Annotations, Snapshots, Books, Judgements, Scorers) but does not describe specific UI states. No screenshot gaps identified from this file.

---

### `docs/database.md`

No UI states mentioned. Database operations documentation.

---

### `docs/docker_images.md`

No UI states mentioned. Docker image management.

---

### `docs/ENCRYPTION_SETUP.md`

No UI states mentioned. Technical encryption setup.

---

### `docs/endpoints_solr.md`

**Covered:**
- Case creation wizard → `wizard_01` through `wizard_07`
- Settings pane → `09_east_pane_settings.png`
- Query pane → `07_east_pane_query_tab.png`
- Find and Rate Missing Documents modal → `24_targeted_search_modal.png`
- Field picking UI → `55_field_picking_settings.png`
- Search Endpoints list → `45_search_endpoints_list.png`

---

### `docs/endpoints_opensearch.md`

**Covered:**
- Case creation wizard → `wizard_01` through `wizard_07`
- Settings pane → `09_east_pane_settings.png`
- Query pane → `07_east_pane_query_tab.png`
- Detailed document modal → `27_detailed_document_modal.png`
- Field picking UI → `55_field_picking_settings.png`

---

### `docs/jupyterlite.md`

No UI states mentioned. Notebook deployment documentation.

---

### `docs/credits.md`

No UI states mentioned. Contributors list.

---

### `docs/agentic_javascript_extraction.md`

No UI states mentioned. Technical implementation documentation.

---

### `docs/examples/external_eval/README.md`

**Covered:**
- Cases list with scores → `59_cases_list.png`
- Home page score visualization / graphs over time → `57_home_dashboard.png`

**Not covered:**
- Case detail page with no queries (scores-only, plotted via external eval)

---

### `docs/images/core_case_evaluation_manual/README.md`

Placeholder file referencing the screenshot spec. No additional UI states.

---

### `docs/migration/README.md`

Index of migration docs (Angular elimination plan, stack options, inventories). No UI states.

---

### `docs/migration/screenshot_automation.md`

All 16 core screenshots and wizard screenshots documented here are covered. No gaps.

---

### `docs/migration/old/react_migration_plan.md`

**Covered:**
- All core case evaluation UI states (screenshots 01–31)
- Wizard flow (wizard_01–wizard_07)
- Bulk rating bar/controls → `49_bulk_rating_score_all.png`
- Book dropdown → `37_book_dropdown.png`
- User menu / avatar / logout dropdown → `36_user_menu_dropdown.png`

**Not covered (require specific state):**
- Media embed component (audio/image/video preview) — requires data with media fields
- Flash/error messages display — transient UI element

---

### `docs/migration/rails_stimulus_migration_alternative.md`

Same UI states as `old/react_migration_plan.md`. Same coverage and gaps.

---

### `docs/migration/migration_roundtable_discussion.md`

No additional UI states beyond those in the migration plans.

---

### `test/fixtures/files/llm_generated_response.md`

No UI states mentioned. Test fixture data.

---

## Summary: Screenshot Coverage

**Total screenshots: 69** (61 main + 8 wizard)

### Newly captured in this pass (screenshots 32–60):

| # | Filename | Category |
|---|----------|----------|
| 32 | `32_login_page.png` | Auth: Login (with OAuth buttons) |
| 33 | `33_signup_page.png` | Auth: Signup form |
| 34 | `34_announcement_banner.png` | Nav: Announcement notification banner |
| 34a | `34a_admin_announcement_form.png` | Admin: New Announcement form |
| 35 | `35_team_details.png` | Teams: Team detail page |
| 36 | `36_user_menu_dropdown.png` | Nav: User menu dropdown |
| 37 | `37_book_dropdown.png` | Nav: Book dropdown |
| 38 | `38_footer.png` | Nav: Footer |
| 39 | `39_user_profile.png` | Account: Profile page |
| 40 | `40_admin_dashboard.png` | Admin: Dashboard |
| 41 | `41_admin_users.png` | Admin: Users management |
| 42 | `42_admin_announcements.png` | Admin: Announcements |
| 43 | `43_admin_job_manager.png` | Admin: Job Manager |
| 44 | `44_scorers_list.png` | Admin: Scorers list |
| 45 | `45_search_endpoints_list.png` | Config: Search endpoints |
| 46 | `46_books_list.png` | Books: List page |
| 47 | `47_book_details.png` | Books: Detail page |
| 48 | `48_inline_case_name_edit.png` | Case: Inline rename |
| 49 | `49_bulk_rating_score_all.png` | Case: Score All popover |
| 50 | `50_scorer_edit_form.png` | Scorers: Create/edit form with scale options |
| 51 | `51_communal_scorer_edit.png` | Scorers: Communal scorer edit with warning banners |
| 52 | `52_archive_case_confirm.png` | Case: Archive confirmation modal |
| 53 | `53_custom_headers_editor.png` | Settings: Custom headers area |
| 54 | `54_ace_query_editor.png` | Settings: ACE query editor |
| 55 | `55_field_picking_settings.png` | Settings: Field picking |
| 56 | `56_settings_nightly_escape.png` | Settings: Nightly eval and Escape Queries |
| 57 | `57_home_dashboard.png` | Home: Dashboard with case summaries and trends |
| 58 | `58_healthcheck.png` | Info: Healthcheck |
| 59 | `59_cases_list.png` | Nav: Cases list dashboard |
| 60 | `60_compare_snapshots_modal.png` | Case: Compare snapshots modal |

### Remaining unscreenshotted UI states

These require specific runtime conditions, configuration, or data that isn't available in the standard dev environment:

#### Excluded per user request
- 404 error page
- Password reset flow
- Legal pages (terms, privacy, cookies)

#### Require specific runtime state
- Flash messages / success-error notifications (transient — appear briefly after actions)
- Search-error area per query (requires failing search endpoint)
- Protocol mismatch button (requires mixed HTTP/HTTPS condition)

#### Require specific data or configuration
- Media embed displays (audio/image/video) — requires documents with media fields
- Vega chart visualizations — requires specific visualization configuration
- GDPR/marketing consent on signup — not enabled in dev environment
- Keycloak/OIDC login page — requires Keycloak server
- Case detail with no queries (scores-only via external eval)
