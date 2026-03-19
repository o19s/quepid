# Visual Parity Findings: deangularjs vs deangularjs-experimental

**Date:** 2026-02-18
**Method:** Automated Playwright screenshots (26 pages) + API structure comparison (9 endpoints)
**Users:** `quepid+realisticactivity@o19s.com` (both branches; seeded by sample_data)

> Note: Different seed data between branches means data content differs — the comparison focuses on **layout and structural parity**, not pixel-perfect matching.

---

## Summary

| Category | Count |
|----------|-------|
| Pages with full layout parity | 23 of 26 |
| Pages with notable differences | 3 of 26 |
| API endpoints structurally identical | 3 of 9 |
| API diffs that are data-dependent false positives | 5 of 9 |
| API diffs that are genuine structural additions | 1 of 9 |

**Overall verdict:** Layout and UI structure are at parity across all server-rendered pages. The only meaningful visual difference is the case workspace, which is the core Angular SPA being replaced.

---

## Pages with Full Layout Parity

These pages have the same layout, structure, and UI components across both branches. Any visible differences are solely due to different seed data (different users, record counts, names).

| # | Page | Notes |
|---|------|-------|
| 00 | Login page | Pixel-perfect match |
| 01 | Home dashboard | Same redirect behavior |
| 02 | Cases index | Same table columns (ID, Case Title, Last Try, # of Queries, Last Score, Last Run On, Last Run By, Associated Judgements, Teams, Owner) |
| 03 | Cases archived | Same filter behavior |
| 05 | Books index | Same table (ID, Name, Teams, Scale, Status) |
| 06 | Book show | Same tab nav (Overview, QueryDoc Pairs, Judgement Stats, Judgements, Import, Share book, Export, Settings), same sections |
| 07 | Book new | Same form |
| 08 | Book edit | Same form |
| 09 | Scorers index | Same two-column layout (default scorer selector + scorers table with type/scale/owner) |
| 10 | Scorers new | Same form (name, code editor, scale radio buttons, custom scale list, scale labels) |
| 11 | Search Endpoints index | Same table (Name, Search Engine icon, Endpoint URL) |
| 12 | Search Endpoints new | Same form |
| 13 | Search Endpoint show | Same detail layout (name, engine, endpoint URL, headers, API method, proxy, auth, requests/min, options, code mapper, shared teams, used by cases, owner) |
| 14 | Teams index | Same table (ID, Name, Members, Cases) |
| 15 | Team show | Same sections: Add Team Member, Members list, Rename Team, Cases table, Books table, Search Endpoints table, Custom Scorers table |
| 16 | Profile | Same sections: Profile form, Account Security, Personal Access Tokens, Danger Zone |
| 17 | Analytics/Tries | Both render long detailed try comparison pages |
| 18 | Admin Panel | Identical layout (Managing Quepid, Analytics, Background Jobs) |
| 19 | Admin Users | Same table (Username, Name, Signed Up, Marketing, Number of Logins, Administrator) |
| 20 | Admin Announcements | Same layout |
| 21 | Query Doc Pairs | Same table (ID, Query text, Position, Doc ID, Document Fields) |
| 22 | Book Judgements | Same structure |
| 24 | Book Export | Same layout |
| 25 | Book Judgement Stats | Same layout |

## Pages with Notable Differences

### 1. Case Workspace (`04-case-workspace`) — Visual Parity Implemented

This is the **core Angular SPA page** that is being replaced in the migration. Full visual parity has been implemented:

- **deangularjs:** Classic Angular workspace — "CASE — Try 1 — AP@10" header format, action buttons (Annotations, Create Snapshot, Compare Snapshots, Export, Share Case, Clone, Filter Relevancy). Query list and results pane as primary focus. Annotations behind a button/panel.
- **deangularjs-experimental:** Server-rendered workspace — same layout. Header shows case name — Try N — score scorer_name (e.g. "SOLR CASE — Try 1 — 0.42 AP@10"). Same action button order and labels. Annotations panel collapsed by default. Query list and results as primary focus.

### 2. Book Judge (`23-book-judge`) — Data Difference

- **deangularjs:** Shows judging form (Query: "200", rating scale buttons 0/1/Unknown, explanation field, "I will Judge Later" / "I can't Tell" buttons)
- **deangularjs-experimental:** Redirected to book show page with "You Have Judged All Available Pairs" message

This is a **data difference**, not a structural one. The experimental branch's user had already judged all pairs. The judge form itself is the same implementation.

### 3. Cases Archived (`03-cases-archived`) — Minor Data Difference

Both branches show the same archived cases view, but different archived case counts due to different seed data. Layout is identical.

---

## API Structure Comparison

### Identical Endpoints (3)

| Endpoint | Status |
|----------|--------|
| `/api/books` | Identical |
| `/api/books/:id` (book_detail) | Identical |
| `/api/search_endpoints` | Identical |

### Data-Dependent False Positives (5)

These show as "different" because the first record sampled had null values on one branch but populated values on the other. The **schema is the same** — the difference is in data content.

| Endpoint | Reported Diffs | Explanation |
|----------|---------------|-------------|
| `/api/cases` | `last_try_number`: number → null | First case on experimental branch has no tries |
| `/api/cases/:id` | `tries[0].field_spec`: string → null, `tries[0].name`: string → null | Same — different try data |
| `/api/users/current` | `default_scorer_id`: number → null | User on experimental branch has no default scorer set |
| `/api/teams` | `cases[0].last_try_number`: number → null, `cases[0].nightly`: boolean → null | Nested case data differences |
| `/api/teams/:id` | `members[0].avatar_url`: string → null, `members[0].email`: string → null | Member data not populated |

### Genuine Structural Addition (1)

| Endpoint | Field | Description |
|----------|-------|-------------|
| `/api/cases` and `/api/cases/:id` | `last_score` | **New field** in deangularjs-experimental. Returns a score object with keys: `all_rated`, `case_id`, `created_at`, `email`, `id`, `queries`, `score`, `shallow`, `try_id`, `updated_at`, `user_id`. Not present in deangularjs at all. |

### Spurious Type Diffs

A few diffs show `string → object` or `object → string` (e.g., `scores`, `user_scorers`, `scorers`). These occur when an empty collection is serialized as `""` (empty string) on one branch vs `[]` or `{}` on the other. This is a **serialization inconsistency** worth noting but not a functional difference.

---

## Coverage Gaps

The visual parity tool captures **26 static full-page screenshots** and **9 API endpoints**. The following pages, interactions, and endpoints are **not** currently captured.

### Pages / Views Not Captured

| Category | Missing Page | Route |
|----------|--------------|-------|
| Case | Create new case | `/cases/new` |
| Team | Create new team | `/teams/new` |
| Scorer | Edit scorer | `/scorers/:id/edit` |
| Search Endpoint | Edit | `/search_endpoints/:id/edit` |
| Search Endpoint | Clone | `/search_endpoints/:id/clone` |
| Search Endpoint | Mapper wizard | `/search_endpoints/mapper_wizard`, `/search_endpoints/:id/mapper_wizard` |
| Book | Import new/edit | `/books/:id/import/new`, `/books/:id/import/edit` |
| Book | Bulk judge | `/books/:id/judge/bulk` |
| Book | Query doc pair edit/show | `/books/:id/query_doc_pairs/:id/edit`, `/books/:id/query_doc_pairs/:id` |
| Judgement | Edit/show | `/books/:id/query_doc_pairs/:id/judgements/:id/edit`, `/judgements/:id` |
| Home | Sparklines, Case prophet, Book summary detail | `/home/sparklines`, `/home/case_prophet/:case_id`, `/home/book_summary_detail/:book_id` |
| Admin | User edit/show, Announcement new/edit | `/admin/users/:id/edit`, `/admin/users/:id`, `/admin/announcements/new`, `/admin/announcements/:id/edit` |
| Admin | Websocket tester, Mission Control Jobs, Blazer | `/admin/websocket_tester`, `/admin/jobs`, `/admin/blazer` |
| Auth | Signup, Password reset, Invitation | `/users/signup`, `/users/password/new`, `/users/password/edit`, `/users/invitation/edit` |
| Account | Account settings | `/account` |
| Static | Cookies | `/cookies` |
| AI | AI judge new/edit, Prompt edit | `/teams/:id/ai_judges/new`, `/teams/:id/ai_judges/:id/edit`, `/ai_judges/:id/prompt/edit` |
| Case | Ratings index, Scores index | `/cases/:id/ratings`, `/cases/:id/scores` |
| Analytics | Duplicate scores | `/analytics/cases/:id/duplicate_scores` |

### Interactions Not Captured

The tool captures **static screenshots only**. No user interaction is simulated.

| Interaction Type | Examples |
|------------------|----------|
| **Modal dialogs** | Share Case, Share Book, Share Scorer, Share Search Endpoint, Import Ratings, Import Snapshot, Clone Case, Export Case, Delete Query, Move Query, Query Options, Edit Annotation, Judgements, Diff, Frog Report |
| **Dropdowns** | Case switcher, try switcher, header menus |
| **Expandable panels** | Annotations panel (open vs collapsed) |
| **Hover states** | Buttons, links, table rows |
| **Form validation** | Error states, validation messages |
| **Toast notifications** | Flash messages, success/error toasts |
| **Turbo stream updates** | Post-create/update/delete UI changes |
| **Keyboard shortcuts** | Workspace shortcuts |

### Case Workspace State Variations

The workspace is captured only in its **initial load** state. These variations are not captured:

- Different try numbers (e.g. Try 2 vs Try 1)
- Annotations panel open vs collapsed
- Query options modal open
- Judgements modal open
- Diff modal (compare snapshots)
- Search results expanded/collapsed
- Query list with a selected query

### API Endpoints Not Compared

The API comparison covers 9 endpoints. Notable omissions:

- `/api/search_endpoints/:id` (individual show)
- `/api/scorers/:id` (individual scorer)
- `/api/books/:id` (individual book)
- `/api/cases/:id/search_endpoints`
- Case-nested endpoints (tries, queries, snapshots, annotations, etc.)
- `/api/announcements` (skipped — returns HTML, not JSON)

### Data / User Context Gaps

- **Single user:** `quepid+realisticactivity@o19s.com` — no admin vs non-admin comparison
- **Team membership:** Seed user may have no teams; share modals may appear empty
- **AI judges:** No AI judge setup; AI judge pages may be unreachable
- **Book judge:** Data-dependent; if all pairs judged, redirects to "You Have Judged All"

### Recommendations for Broader Coverage

1. **Add more pages** to `PAGES` in `capture_screenshots.mjs`: `/cases/new`, `/teams/new`, `/scorers/:id/edit`, `/search_endpoints/:id/edit`, `/search_endpoints/:id/clone`, `/books/:id/import/new`, `/books/:id/judge/bulk`, `/admin/users/:id/edit`, `/admin/announcements/new`, `/cookies`, `/home/sparklines`
2. **Add interaction-based captures** using `entry.setup`: click "Share Case", "Import", etc. before screenshot; capture workspace with annotations panel open
3. **Capture multiple try numbers** for the case workspace (e.g. Try 1 and Try 2)
4. **Add admin user** or use admin-capable seed user for admin page coverage
5. **Add more API endpoints** to `compare_apis.mjs` for nested resources (case detail, try detail, etc.)

---

## Methodology Notes

- Screenshots captured via Playwright (headless Chromium, 1440x900 viewport)
- Login via `form#login` on `/sessions/new`
- Dynamic page IDs resolved via API (e.g., first case, first book, first team)
- API comparison extracts key structure (nested key names + value types) from first array elements, then diffs
- Different seed data between branches is the primary source of false positives in the API comparison
- The `announcements` API endpoint was skipped (returns HTML, not JSON)

## How to Re-run

The comparison uses **git worktrees** so each branch runs in its own directory—no branch switching, so `package.json`/`yarn.lock` changes (e.g. from Playwright install) never block the run.

Visual parity runs use an **isolated Docker project** (`quepid-vp`) with its own containers, volumes, and ports (app on 3010, mysql on 3307, etc.). This avoids any conflict with the main quepid stack—you can run the comparison while main quepid is running, and main repo data is never touched.

```bash
# Full automated comparison (both branches, ~20 min)
# Creates worktrees at ../quepid-visual-parity-wt-<branch> if needed
bash test/visual_parity/run_comparison.sh

# Single branch capture
bash test/visual_parity/run_comparison.sh --capture deangularjs-experimental

# Generate report from existing captures
bash test/visual_parity/run_comparison.sh --report

# Remove worktrees when done (optional)
bash test/visual_parity/run_comparison.sh --remove-worktrees

# Open report
xdg-open test/visual_parity/report.html
```

Worktrees persist between runs for faster re-captures. Use `--remove-worktrees` to clean up.

### Standalone capture (app already running)

When the app is already running (e.g. via `bin/docker s`), you can capture screenshots and API structures directly without the orchestrator:

```bash
# App must be running at BASE_URL (default http://localhost:3000)
# For visual parity orchestrator runs, the app is at http://localhost:3010
node test/visual_parity/capture_screenshots.mjs --branch <name> --base-url http://localhost:3000
node test/visual_parity/compare_apis.mjs --branch <name> --base-url http://localhost:3000

# With custom credentials (default: quepid+realisticactivity@o19s.com / password)
node test/visual_parity/capture_screenshots.mjs --branch deangularjs --email user@example.com --password secret
```
