# Functionality Gap Report: Modern Workspace vs Legacy Angular

**Generated:** February 17, 2026
**Updated:** February 19, 2026 — All remaining items moved to [intentional_design_changes.md](intentional_design_changes.md).
**Scope:** Current codebase (Stimulus + ViewComponents + Turbo)
**Purpose:** Identify user-facing functionality that existed in the legacy Angular workspace and is either implemented, partially implemented, or still missing in the modern stack.
**Note:** Angular has been **removed**. The frontend is Stimulus + ViewComponents + Turbo only. `app/assets/javascripts/` contains only a small number of non-Angular scripts (e.g. `mode-json.js`, `scorerEvalTest.js`). The main UI lives in `app/components/` (ViewComponents) and `app/javascript/controllers/` (Stimulus).
---

## Architectural Notes

The biggest shift is from **client-side state management** (Angular services holding live state, client-side search execution, client-side scoring) to **server-authoritative state** (Rails renders, Turbo refreshes, server-side search proxy, server-side scoring).

Key implications:
- Score updates after rating use a two-tier approach: lightweight `QueryScoreService` for immediate per-query score feedback, plus debounced `RunCaseEvaluationJob` for full case-level scoring via Turbo Stream broadcasts.
- Search execution goes through `QuerySearchService` (Rails proxy to search engine), eliminating CORS issues but adding latency.
- All Angular UI code has been removed; the workspace is Stimulus + ViewComponents + Turbo only.