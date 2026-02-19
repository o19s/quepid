# Quepid Codebase Review Report

**Generated:** 2026-02-18
**Updated:** 2026-02-18 — Marked fixed items after implementing fixes.
**Scope:** Full codebase review for bugs, errors, bad practices, regressions, lost functionality, and security issues.
**References:** Project rules (`.cursor/rules`, `CLAUDE.md`), [docs/README.md](README.md), parity audits.

---

## Executive Summary

The codebase is generally well-structured with clear migration from Angular to Stimulus/ViewComponents/Turbo and strong documentation. This review identified **authorization (IDOR) risks** in three controllers, **URL construction bugs** in JavaScript (missing slash when using root), **inconsistent boolean parameter handling**, **XSS and mass-assignment concerns**, one **broken link** (Angular leftover), **leftover debug output**, and several **TODOs** and documentation gaps. No use of `.scss` (project uses `.css` only) and no broad `rescue Exception`; URL and boolean rules are followed in most places but with notable exceptions.

> **Status:** The high-priority IDOR fixes, URL construction bugs, XSS sanitization, boolean param consistency, broken Angular link, and debug output have all been **fixed**. Remaining open items are mass assignment (`permit!`), LIKE wildcards, TODOs, and documentation gaps.

---

## 4. Regressions / Lost Functionality

### 4.2 TODOs / Incomplete Behavior

| Location | Note |
|----------|------|
| `app/services/query_search_service.rb` (line 76) | `# TODO: add extraction when supported` — **FIXED**: Implemented Vectara and Algolia doc extraction in FetchService and wired into QuerySearchService. |
| `app/services/fetch_service.rb` (line 244) | `# TODO: Confirm with David Fisher this is right.` — behavior may need confirmation. |
| `app/controllers/api/v1/import/ratings_controller.rb` (line 77) | `# TODO: report this to logging infrastructure ...` — error reporting not implemented. |

### 4.3 Commented / Dead Code

| Location | Issue |
|----------|--------|
| `app/controllers/api/v1/bulk_ratings_controller.rb` (lines 45–46) | Comment says params should be `params.require(:rating).permit(:rating)` but code may not be updated; verify and align code with comment or remove comment. |

---

## 5. Inconsistencies

### 5.1 Boolean Handling — MOSTLY FIXED

- **Judgements:** `@compact` derived from `.present?` instead of a single boolean param. (Open — checkbox-absence pattern.)

### 5.2 Navigation After Background Job

| Location | Issue |
|----------|--------|
| `app/javascript/controllers/judgements_controller.js` (line 260) | After "refresh ratings" in background: `window.location.href = buildPageUrl(root)` (one argument) sends the user to the root URL. Confirm this is intended (e.g. "go home after background job") and not "stay on current case/try". |

### 5.3 Stylesheets

- No `.scss` files found; project uses `.css` only. No inconsistency.

---

## 6. Documentation and Comments

| Location | Recommendation |
|----------|----------------|
| `app/controllers/core_controller.rb` (lines 62–75) | Add a short comment on `populate_from_params` and the search endpoint / try update logic (params like `searchEngine`, `searchUrl`, `apiMethod`, `basicAuthCredential`, `fieldSpec`) and where they are used. |
| `app/controllers/concerns/authentication/current_case_manager.rb` (lines 21–31) | Add a one-line comment on the fallback: e.g. "try public case if not found in involved_with." |

---

## 7. Test Coverage (Critical Paths)

- **Cases (API):** Archive/unarchive and team-member permissions are tested in `test/controllers/api/v1/cases_controller_test.rb`.
- **Rails `CasesController` (HTML archive/unarchive):** No test found that verifies only the case owner (or otherwise authorized user) can archive/unarchive, or that `set_case` is scoped to the current user. Adding a test that another user cannot archive a case they don't own would close the IDOR gap.
- **TeamsController:** No test found that asserts a non-member cannot access `show` or other `set_team` actions for another team's ID.
- **QueryDocPairsController:** No test found that asserts a user cannot edit/update/destroy a query_doc_pair belonging to a different book (e.g. by sending `book_id` for their book and `id` for another book's pair).

---

## 8. Summary Table

| Category            | Count | Severity / note                                  | Status |
|---------------------|-------|--------------------------------------------------|--------|
| Mass assignment     | 2     | Medium — `permit!` on import book/case          | Open |

---

## 9. Recommendations (Priority)

### Medium — MOSTLY DONE

3. **Replace `permit!` in import controllers** — Open. Use explicit permit lists in `api/v1/import/books_controller.rb` and `api/v1/import/cases_controller.rb`.

### Low — MOSTLY DONE

8. **Resolve or document TODOs** — QuerySearchService Vectara/Algolia extraction **FIXED**. FetchService and import ratings controller TODOs remain open.

---

## References

- [docs/README.md](README.md) — Documentation index
- [docs/api_client.md](api_client.md) — URL building (getQuepidRootUrl, quepid_root_url)
- [docs/archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md) — Resolved parity gaps and completed recommendations (archive)
- `.cursor/rules/quepid-project.mdc` — Project rules (Docker, URLs, booleans, CSS)
