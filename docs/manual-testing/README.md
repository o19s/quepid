# Quepid Manual Testing Guide

This is a step-by-step manual test script for Quepid, organized so a tester can work through the entire application, feature area by feature area, without needing prior knowledge of the codebase.

Quepid is a search relevance tuning tool. Broadly, a user connects Quepid to a search engine (a **Search Endpoint**), creates a **Case** containing a list of test **Queries**, judges how good the results are (**Ratings**), and watches a **Score** (computed by a **Scorer**) change over time as the search configuration is tuned. Separately, **Books** let teams collect relevance **Judgements** from multiple people (including AI) offline, which can then feed back into a Case as ratings.

## How this guide is organized

Each part below is a self-contained document covering one feature area. Work through them in order for full regression coverage, or jump to the part that covers whatever you're testing. Every part uses the same format:

- **Purpose** — what the feature is for, in plain language.
- **Where to find it** — menu/page/button path.
- **Test steps** — numbered actions to perform.
- **Expected result** — what should happen.
- **Edge cases / negative tests** — trickier scenarios, error states, and validation checks worth confirming, called out separately since they're easy to skip.

## Tracking coverage and staleness

`tracking.yml` in this directory records, per numbered scenario, when it was last actually verified, the result, and which source files it exercises. Run `bin/manual_test_status` (from the repo root, plain `ruby`) to see what's due for a rerun — never run, stale by time, or whose tracked files changed (committed or uncommitted) since the last run. See `CLAUDE.md`'s "Manual testing tracker" section for the full workflow. Passing every checkbox in one sitting is the exception, not the norm — update `tracking.yml` with exactly what you covered, not with what the part *would* cover if run exhaustively.

Use the checkboxes (`- [ ]`) to track your pass through each test case; check them off as you confirm expected behavior.

## Parts

| # | Part | Covers |
|---|---|---|
| 1 | [Environment Setup & Accounts](01-environment-setup-and-accounts.md) | Getting a test environment running, seed accounts, sign up, login/logout, password reset, invitations, OAuth, profile, API keys, account deletion |
| 2 | [Home Dashboard](02-home-dashboard.md) | The landing page: recent cases/books, score trend cards, sparklines, cookie consent |
| 3 | [Case Management](03-case-management.md) | Cases list page, creating a case (new-case wizard), archiving/unarchiving/deleting cases from the list view |
| 4 | [Core Workbench — Queries & Scoring](04-core-workbench-queries-and-scoring.md) | The main case-tuning screen: adding/moving queries, rating documents, scorers, query options, Tune Relevance drawer |
| 5 | [Core Workbench — History, Snapshots & Annotations](05-core-workbench-history-snapshots-and-annotations.md) | Tries/try history, snapshots, compare-snapshots (diff), annotations, score graph |
| 6 | [Core Workbench — Import, Export & Explain Tools](06-core-workbench-import-export-and-explain-tools.md) | Import/export a case, clone/delete/share a case, query & document explain tools, Frog Report, Missing Documents finder |
| 7 | [Search Endpoints & Mapper Wizard](07-search-endpoints-and-mapper-wizard.md) | Connecting Quepid to Solr/ES/OpenSearch/Vectara/Algolia/custom APIs, the AI-assisted Mapper Wizard |
| 8 | [Scorers](08-scorers.md) | Creating, editing, cloning, sharing, and defaulting relevance scoring formulas |
| 9 | [Teams & Sharing](09-teams-and-sharing.md) | Creating teams, managing members/invites, sharing cases/books/endpoints/scorers |
| 10 | [Books Management](10-books-management.md) | Creating/configuring books, import/export, combining books, danger-zone tools |
| 11 | [Judging Workflows](11-judging-workflows.md) | The one-at-a-time judging screen, bulk judging, judgement stats, query/doc pair management |
| 12 | [AI Judges](12-ai-judges.md) | Configuring an AI judge, refining its prompt, running it against a book ("Judge Judy") |
| 13 | [Analytics](13-analytics.md) | Tries visualization, case public/private sharing, duplicate-score diagnostics |
| 14 | [Admin Area](14-admin-area.md) | User management, announcements, websocket tester, job/SQL admin tools |
| 15 | [Global Navigation & Notebooks](15-global-navigation-and-notebooks.md) | Sidebar, navbar quick-access dropdowns, avatar menu, API Docs, cookies page, the JupyterLite Notebooks integration |
| 16 | [Cross-Cutting: BS5, Responsive & Accessibility](16-cross-cutting-bs5-responsive-and-accessibility.md) | Bootstrap 3→5 migration regression checks, narrow-viewport reflow, modal accessibility |

## General testing notes

- **Test across browsers** where feasible (Chrome, Firefox, Safari) — the core workbench uses a fair amount of custom JS/CSS (AngularJS + Bootstrap 5) and has known cross-browser layout traps.
- **Test at multiple viewport widths.** Several modals (case wizard, export/import, diff) are tall and scroll internally; narrow/mobile widths are a known regression area. See Part 16 for the dedicated checklist.
- **This app is mid-migration from Bootstrap 3 to Bootstrap 5.** A whole class of bug exists where an element is present and technically working but not actually visible (wrong `display`/`opacity`/`transform`/`font-size`). Functional click-through testing won't catch this — you have to actually look. Part 16 covers this in depth; keep it in mind throughout every other part too, especially around popovers, tooltips, modals, dropdowns, and accordions.
- **Watch for flash messages.** Quepid surfaces most success/failure feedback as flash banners at the top of the page or inline alerts in modals — always confirm the message text matches the action taken, not just that "something happened."
- **Confirm destructive actions carefully.** Several deletes (case, scorer, search endpoint, query doc pairs, judgements) are irreversible and some have only a single confirmation click. These are flagged explicitly in each part.
- **Multi-user scenarios matter.** Many features (sharing, teams, judgements, admin) only show interesting behavior with 2+ accounts — use the seed accounts described in Part 1, or create additional test users.
- Record bugs with: page URL, account used, exact steps, expected vs. actual result, and a screenshot if the issue is visual.
