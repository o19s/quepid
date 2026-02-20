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

### 1. Case Workspace (`04-case-workspace`) — Expected Difference

This is the **core Angular SPA page** that is being replaced in the migration. The two branches render it fundamentally differently:

- **deangularjs:** Classic Angular workspace — "SOLR CASE — Try 1 — AP@10" header with action buttons (Annotations, Create Snapshot, Compare Snapshots, Export, Share Case, Clone, Filter Relevancy). Shows query list and results pane.
- **deangularjs-experimental:** Server-rendered workspace — landed on annotations view showing "Existing Annotations" with query/results split pane below. Different navigation pattern.

**This is the expected and most significant difference** between the branches — it's the whole point of the migration.

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

## Methodology Notes

- Screenshots captured via Playwright (headless Chromium, 1440x900 viewport)
- Login via `form#login` on `/sessions/new`
- Dynamic page IDs resolved via API (e.g., first case, first book, first team)
- API comparison extracts key structure (nested key names + value types) from first array elements, then diffs
- Different seed data between branches is the primary source of false positives in the API comparison
- The `announcements` API endpoint was skipped (returns HTML, not JSON)

## How to Re-run

The comparison uses **git worktrees** so each branch runs in its own directory—no branch switching, so `package.json`/`yarn.lock` changes (e.g. from Playwright install) never block the run.

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
