# Code Review Findings

**Date:** February 19, 2026  
**Reviewer:** AI Code Review  
**Scope:** Entire codebase review for errors, bugs, bad practices, inconsistencies, lost functionality, and regressions  
**Second pass:** Additional findings from deeper review (IDOR vulnerabilities, Stimulus leaks, integer coercion)

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Security Concerns](#security-concerns)
3. [Code Quality & Consistency](#code-quality--consistency)
4. [Performance Issues](#performance-issues)
5. [Missing Functionality](#missing-functionality)
6. [Documentation Issues](#documentation-issues)
7. [Pragmatic Engineer: Additional Observations](#pragmatic-engineer-additional-observations)
8. [Recommendations](#recommendations)

---

## Critical Issues

### 1. Boolean Parameter Parsing Inconsistency — **P3**

**Location:** `app/controllers/proxy_controller.rb:13`

**Issue:** The `proxy_debug` parameter is parsed using string comparison (`'true' == params[:proxy_debug]`) instead of the project's standard `deserialize_bool_param` helper.

**Current Code:**
```ruby
proxy_debug = 'true' == params[:proxy_debug]
```

**Expected:**
```ruby
proxy_debug = deserialize_bool_param(params[:proxy_debug])
```

**Impact:** Inconsistent behavior with other boolean parameters. The string comparison will fail for `true`, `1`, `"1"`, etc., which `deserialize_bool_param` handles correctly.

**Severity:** Medium

**Pragmatic note:** Proxy is used when `proxyRequests` is true on search endpoints (see `doc_cache.js`). `proxy_debug` is rarely passed; low real-world impact.

---

### 2. URL Parsing Bug in Proxy Controller — **P3**

**Location:** `app/controllers/proxy_controller.rb:60-65`

**Issue:** The `extract_extra_url_params` method has a bug when parsing query parameters from URLs. It splits on `=` but doesn't handle multiple query parameters correctly.

**Current Code:**
```ruby
def extract_extra_url_params url_param
  return {} unless url_param.include?('?')
  
  # Handle URLs like http://myserver.com/search?q=tiger or http://myserver.com/search?q=tiger?
  extra_query_param = url_param.split('?', 2).last.split('=')
  { extra_query_param.first => extra_query_param.second }
end
```

**Problem:** This only extracts the first key-value pair. URLs like `http://example.com/search?q=test&rows=10` will only extract `q=test` and ignore `rows=10`.

**Impact:** Query parameters beyond the first one are lost when proxying requests.

**Severity:** Medium

**Recommendation:** Use `URI.parse` and `CGI.parse` or `Addressable::URI` to properly parse query strings.

**Pragmatic note:** Only affects URLs with multiple query params in the proxy URL string. Single-param URLs (common case) work. Fix when addressing proxy security.

---

### 3. IDOR: JudgementsController Unscoped Lookup — **P0**

**Location:** `app/controllers/judgements_controller.rb:133-135`

**Issue:** `set_judgement` uses `Judgement.find(params[:id])` without scoping through the book. The `before_action` order runs `set_judgement` before `set_book`, and the judgement is not verified to belong to the current book.

**Current Code:**
```ruby
def set_judgement
  @judgement = Judgement.find(params[:id])
end
```

**Impact:** Any authenticated user can view, edit, update, or destroy any judgement by ID, including judgements from books they don't have access to. Example: `/books/123/judgements/999` could expose judgement 999 even if it belongs to a different book.

**Severity:** High

**Recommendation:**
1. Reorder: `before_action :set_book` before `before_action :set_judgement`
2. Scope the lookup: `@judgement = @book.judgements.find(params[:id])`

**Pragmatic note:** Exploitable today. URLs like `/books/123/judgements/999` expose judgement 999 regardless of book. Fix before next release.

---

### 4. IDOR: ApiKeysController Unscoped Lookup — **P0**

**Location:** `app/controllers/api_keys_controller.rb:38`

**Issue:** `destroy` uses `ApiKey.find(params[:id])` without scoping through the current user.

**Current Code:**
```ruby
def destroy
  @api_key = ApiKey.find(params[:id])
  @api_key.destroy
  redirect_to profile_path
end
```

**Impact:** Any authenticated user could delete another user's API key by guessing or enumerating IDs.

**Severity:** High

**Recommendation:** Use `@api_key = current_user.api_keys.find(params[:id])`

**Pragmatic note:** One-line fix. API keys are high-value; deleting another user's key could lock them out of integrations. Fix with #3.

---

### 5. Potential IDOR: BooksController find_user — **P3**

**Location:** `app/controllers/books_controller.rb:396-398`

**Issue:** `find_user` uses `User.find(params[:user_id])` without scoping to users who have access to or have judged the book.

**Current Code:**
```ruby
def find_user
  @user = User.find(params[:user_id])
end
```

**Impact:** Used for `reset_unrateable`, `reset_judge_later`, `delete_ratings_by_assignee`. Operations are scoped to `@book.judgements.where(user: @user)`, so impact is limited, but any user_id can be passed. Consider scoping to users who have judged this book (e.g., `@book.judgements.distinct.pluck(:user_id)` or a join) to enforce authorization.

**Severity:** Low

**Pragmatic note:** Operations are scoped to `@book.judgements`; worst case is no-op or empty result. Low exploit value. Defer unless hardening this flow.

---

### 6. Unsafe Integer Coercion — **P3**

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

**Issue:** `params[:rows].to_i` and `params[:start].to_i` are used without validation. Non-numeric strings (e.g., `"abc"`) coerce to `0`, which may cause unexpected behavior (e.g., zero rows returned).

**Current Code:**
```ruby
rows = params[:rows].to_i if params[:rows]
start = params[:start].to_i if params[:start]
```

**Recommendation:** Use `params[:rows].presence&.to_i` and validate range, or use `Integer(params[:rows])` with rescue for invalid input. Match the pattern used in `Api::V1::Tries::Queries::SearchController` (lines 40-42).

**Severity:** Low

**Pragmatic note:** `"abc".to_i` → 0; user gets empty results. Unlikely to be hit by normal use. Fix if you see odd pagination bugs.

---

## Security Concerns

### 7. Proxy Controller SSRF Risk — **P1**

**Location:** `app/controllers/proxy_controller.rb`

**Issue:** The proxy controller allows unauthenticated requests (`skip_before_action :require_login`) and forwards requests to arbitrary URLs. While there is some SSRF protection in `Api::V1::SearchEndpoints::ValidationsController`, the proxy controller itself doesn't validate URLs.

**Current Protection:**
- No authentication required
- No URL validation
- No rate limiting

**Impact:** Potential SSRF (Server-Side Request Forgery) attacks if malicious URLs are provided.

**Severity:** High

**Recommendation:**
1. Add URL validation similar to `SearchEndpoints::ValidationsController`
2. Consider requiring authentication or API key
3. Add rate limiting
4. Validate URLs against allowlist if possible

**Note:** The proxy controller is documented as a development/testing tool (see comments), but it's accessible in production.

**Pragmatic note:** Proxy is used in production when search endpoints have `proxy_requests: true` (CORS workaround). Unauthenticated + arbitrary URL = SSRF. Require auth or disable in prod until fixed.

---

### 8. CSRF Protection Bypass — **P2**

**Location:** Multiple controllers

**Issue:** Several controllers skip CSRF verification:

- `app/controllers/proxy_controller.rb:5` - `skip_before_action :verify_authenticity_token, only: [ :fetch ]`
- `app/controllers/sessions_controller.rb:6` - `skip_before_action :verify_authenticity_token, only: :create`
- `app/controllers/api/v1/signups_controller.rb:7` - `skip_before_action :verify_authenticity_token`

**Impact:** These endpoints are vulnerable to CSRF attacks if not properly protected by other means.

**Severity:** Medium (for API endpoints, this is expected; for proxy controller, it's concerning)

**Recommendation:** Review each case:
- API endpoints (`Api::ApiController`) use `protect_from_forgery with: :null_session` which is appropriate
- Sessions controller may need CSRF protection via tokens
- Proxy controller should require authentication or API key

**Pragmatic note:** Sessions/signups often skip CSRF for API-style auth (JSON, tokens). Proxy is the concerning one; fix with #7.

---

## Code Quality & Consistency

### 9. Stimulus Controller Event Listener Leaks — **P2**

**Location:** Multiple Stimulus controllers

**Issue:** Several controllers add event listeners in `connect()` but do not remove them in `disconnect()`. When Turbo navigates away, controllers disconnect but listeners may persist if attached to `document` or long-lived elements, or the controller may not fully clean up.

**Affected Controllers:**
- `add_query_controller.js:18` — `inputTarget.addEventListener("input", ...)` never removed
- `share_case_controller.js:79` — dynamically created buttons get listeners; modal content may be replaced without cleanup
- `share_book_controller.js:76` — same pattern
- `share_search_endpoint_controller.js:79` — same pattern
- `share_scorer_controller.js:76` — same pattern
- `scorer_scale_controller.js:9,14` — `addEventListener` without matching `removeEventListener` in disconnect
- `diff_controller.js:66,83` — listeners on dynamically created elements
- `judgements_controller.js:136,145` — listeners in loop, no cleanup

**Impact:** Memory leaks on SPA-style navigation, duplicate handlers if elements are re-used, potential "ghost" behavior.

**Severity:** Low–Medium

**Recommendation:** Add `disconnect()` methods that remove all listeners. For dynamically created elements, either remove listeners when replacing innerHTML or use event delegation on a stable parent.

**Pragmatic note:** `add_query_controller`'s `inputTarget` is replaced on Turbo navigation, so the element (and listener) is GC'd. Share modals rebuild `innerHTML` each open — listeners on old nodes may leak. Fix share controllers if users report sluggishness after heavy modal use.

---

### 10. Inconsistent Navigation Patterns — **P2**

**Location:** Multiple JavaScript controllers

**Issue:** Many controllers use `window.location.href` and `window.location.reload()` directly instead of using the project's URL helper methods (`getQuepidRootUrl()`, `buildPageUrl()`).

**Affected Files:**
- `app/javascript/controllers/import_case_controller.js:69,71`
- `app/javascript/controllers/add_query_controller.js:151,153`
- `app/javascript/controllers/settings_panel_controller.js:52,77,109,111,171`
- `app/javascript/controllers/new_case_wizard_controller.js:160,163`
- `app/javascript/controllers/delete_query_controller.js:65,75,77`
- `app/javascript/controllers/clone_case_controller.js:107`
- `app/javascript/controllers/import_snapshot_controller.js:101`
- `app/javascript/controllers/delete_case_controller.js:49`
- `app/javascript/controllers/delete_case_options_controller.js:78,92,102`
- `app/javascript/controllers/scorer_panel_controller.js:146`
- `app/javascript/controllers/move_query_controller.js:79`
- `app/javascript/controllers/judgements_controller.js:190,223,260,262`
- `app/javascript/controllers/frog_report_controller.js:70,72`
- `app/javascript/controllers/mapper_wizard_controller.js:451`
- `app/javascript/controllers/query_list_controller.js:450`

**Impact:** 
- Hardcoded URLs break when deployed under a subpath (e.g., `/quepid/`)
- Inconsistent with project conventions documented in `docs/port/api_client.md`
- Makes subpath deployment difficult

**Severity:** Medium

**Recommendation:** Replace all `window.location.href = "/..."` with `buildPageUrl(root, ...)` and `window.location.reload()` with Turbo navigation where possible.

**Pragmatic note:** Only matters if you deploy under a subpath (e.g. `/quepid/`). If you're always at root, P3. If subpath is on the roadmap, fix before that deploy.

---

### 11. Inconsistent Error Handling — **P3**

**Location:** Multiple controllers

**Issue:** Error handling patterns vary across controllers:

1. **Some use `rescue` with early returns:**
   - `app/controllers/api/v1/search_endpoints/validations_controller.rb:37-39,52-54,57-59,62-65,78-80`
   - `app/controllers/api/v1/import/ratings_controller.rb:29-31`

2. **Some use `rescue` without early returns:**
   - `app/controllers/core/imports_controller.rb:92-95,192-195`

3. **Some don't handle errors at all:**
   - Many API controllers don't have comprehensive error handling

**Impact:** Inconsistent user experience, potential for unhandled exceptions.

**Severity:** Low-Medium

**Recommendation:** Standardize error handling:
- Use `rescue_from` in base controllers for common exceptions
- Return consistent error response formats
- Log errors appropriately

**Pragmatic note:** Inconsistent but not breaking. Tackle when adding `rescue_from` for a new exception type.

---

### 12. Predicate Method Naming Inconsistency — **P3**

**Location:** Multiple files

**Issue:** Some code uses `has_*` prefix for predicate methods, which violates the project convention of using `*?` suffix.

**Examples:**
- `app/models/selection_strategy.rb:10,24,56` - `every_query_doc_pair_has_three_judgements?`, `user_has_judged_all_available_pairs?`
- `app/views/bulk_judge/new.html.erb:137,139` - `has_key?` (this is Ruby Hash method, acceptable)
- `app/views/judgements/_form.html.erb:159,161` - `has_key?` (Ruby Hash method, acceptable)

**Impact:** Inconsistent with project conventions (`.cursor/rules/quepid-project.mdc` states: "In Ruby we say `credentials?` versus `has_credentials?` for predicates").

**Severity:** Low

**Recommendation:** Rename predicate methods to use `?` suffix:
- `every_query_doc_pair_has_three_judgements?` → `every_query_doc_pair_has_three_judgements?` (already correct)
- `user_has_judged_all_available_pairs?` → `user_judged_all_available_pairs?`

**Note:** `has_key?` is a Ruby Hash method and should remain as-is.

**Pragmatic note:** Style-only. Don't block releases.

---

### 13. Code Duplication: URL Parameter Extraction — **P3**

**Location:** Multiple controllers

**Issue:** Similar logic for extracting and parsing URL parameters appears in multiple places:

- `app/controllers/proxy_controller.rb:60-65` - `extract_extra_url_params`
- `app/controllers/api/v1/search_endpoints/validations_controller.rb` - URL parsing logic
- `app/helpers/application_helper.rb:139-147` - `get_protocol_from_url`

**Impact:** Maintenance burden, potential for bugs to be fixed in one place but not others.

**Severity:** Low

**Recommendation:** Extract common URL parsing logic into a shared service or helper.

**Pragmatic note:** Extract when fixing proxy URL parsing (#2); don't do a separate refactor.

---

## Performance Issues

### 14. Potential N+1 Query Issues — **P2**

**Location:** Multiple controllers

**Issue:** Some queries may trigger N+1 queries:

1. **`app/controllers/cases_controller.rb:32`**
   ```ruby
   query = query.includes(:owner, :teams, scores: :user).distinct
   ```
   This includes `scores: :user` but `scores` is a `has_many` association. If scores are accessed later, this may still cause N+1 queries.

2. **`app/controllers/teams_controller.rb:296`**
   ```ruby
   @cases = query.order(:id).includes(:owner, :teams)
   ```
   Missing `scores` association if scores are accessed in the view.

3. **`app/controllers/api/v1/cases_controller.rb:190`**
   ```ruby
   base_query.includes(:owner, :book).preload(:tries, :teams, :cases_teams)
   ```
   Uses both `includes` and `preload` which is fine, but the comment says "this is slow!" for the `left_outer_joins(:metadata)`.

**Impact:** Performance degradation with large datasets.

**Severity:** Medium

**Recommendation:** 
- Use Bullet gem in development to detect N+1 queries
- Review views to ensure all accessed associations are eager-loaded
- Consider using `with_counts` scope more consistently

**Pragmatic note:** Add Bullet in development; fix N+1s as they appear. Don't guess — measure.

---

### 15. Inefficient Query in Cases Controller — **P2**

**Location:** `app/controllers/api/v1/cases_controller.rb:191-193`

**Issue:** The query uses `left_outer_joins(:metadata)` with a comment "this is slow!" and orders by `case_metadata.last_viewed_at`.

**Current Code:**
```ruby
.left_outer_joins(:metadata) # this is slow!
.select('cases.*, case_metadata.last_viewed_at')
.order(Arel.sql('`case_metadata`.`last_viewed_at` DESC, `cases`.`updated_at` DESC'))
```

**Impact:** Performance issues with large datasets.

**Severity:** Medium

**Recommendation:**
- Add database index on `case_metadata.last_viewed_at` if not present
- Consider denormalizing `last_viewed_at` to `cases` table
- Use `includes(:metadata)` instead of `left_outer_joins` if metadata is always needed

**Pragmatic note:** Case list is a hot path. If users have 50+ cases and report slowness, index `last_viewed_at` first.

---

## Missing Functionality

### 16. Missing Error Handling in Try Creation — **P3**

**Location:** `app/controllers/api/v1/tries_controller.rb:72-77`

**Issue:** The `create` action has a `rescue ActiveRecord::ValueTooLong` block that restarts ancestry tracking, but there's no handling for other potential exceptions during save.

**Current Code:**
```ruby
begin
  case_saved = @case.save
rescue ActiveRecord::ValueTooLong
  @try.parent = nil # restart the ancestry tracking!
  case_saved = @case.save
end
```

**Impact:** Other exceptions during save will bubble up unhandled.

**Severity:** Low-Medium

**Recommendation:** Add broader error handling or let exceptions bubble up with proper error responses.

**Pragmatic note:** `ValueTooLong` is the known edge case; it's handled. Other exceptions will 500 — acceptable until you see them in logs.

---

### 17. Incomplete URL Building in Some Controllers — **P2**

**Location:** Multiple JavaScript controllers

**Issue:** Some controllers use `new URL(window.location.href)` to parse URLs but don't use the project's URL building helpers consistently.

**Examples:**
- `app/javascript/controllers/tour_controller.js:17`
- `app/javascript/controllers/new_case_wizard_controller.js:160,494`
- `app/javascript/controllers/query_list_controller.js:222,232,372,382`

**Impact:** May break in subpath deployments.

**Severity:** Low-Medium

**Recommendation:** Use `getQuepidRootUrl()` and `buildPageUrl()` consistently.

**Pragmatic note:** Same as #10 — subpath deployment blocker.

---

## Documentation Issues

### 18. TODO Comments Without Context — **P3**

**Location:** Multiple files

**Issue:** Several TODO comments lack context or assignment:

- `app/services/fetch_service.rb:285` - `# TODO: Confirm with David Fisher this is right.`
- `app/controllers/api/v1/import/ratings_controller.rb:78-80` - `# TODO: report this to logging infrastructure so we won't lose any important errors that we might have to fix.`

**Impact:** Technical debt without clear ownership or timeline.

**Severity:** Low

**Recommendation:** 
- Create GitHub issues for each TODO
- Add context about what needs to be done
- Assign owners and deadlines

**Pragmatic note:** Create issues if they're real work; otherwise delete the TODOs.

---

### 19. Commented-Out Code — **P3**

**Location:** Multiple files

**Issue:** Several files contain commented-out code that should be removed:

- `app/controllers/cases_controller.rb:30-31` - Commented includes and order
- `app/controllers/home_controller.rb:16,26-32,36-39` - Multiple commented sections
- `app/controllers/api/v1/teams_controller.rb:11-13` - Commented query examples

**Impact:** Code clutter, confusion about what's active.

**Severity:** Low

**Recommendation:** Remove commented-out code or move to git history. If code is needed for reference, add a comment explaining why.

**Pragmatic note:** Delete on sight when touching a file. Don't do a sweep.

---

### 20. Inconsistent Documentation Style — **P3**

**Location:** Multiple files

**Issue:** Documentation comments vary in style and completeness:

- Some methods have comprehensive YARD documentation
- Some have inline comments
- Some have no documentation

**Impact:** Makes it harder for new developers to understand the codebase.

**Severity:** Low

**Recommendation:** Establish documentation standards and gradually improve coverage.

**Pragmatic note:** Document as you go; don't backfill.

---

## Pragmatic Engineer: Additional Observations

### Dead code: ScoresController#set_score

**Location:** `app/controllers/scores_controller.rb:24-26`

`set_score` is defined but never used in a `before_action`. The only score-destroy path is `destroy_multiple`, which uses `@case.scores.where(id: params[:score_ids])` — correctly scoped. Safe to delete `set_score`.

---

### Proxy usage in production

The proxy (`/proxy/fetch`) is invoked when a search endpoint has `proxy_requests: true` — used to avoid CORS when the frontend can't call Solr/ES directly. This means the proxy is part of the normal search flow in some deployments, not just a dev tool. Treat proxy security (#7) as production-critical if you use proxy endpoints.

---

### Prioritization summary

| Priority | Count | Items |
|----------|-------|-------|
| **P0** | 2 | #3 JudgementsController IDOR, #4 ApiKeysController IDOR |
| **P1** | 1 | #7 Proxy SSRF |
| **P2** | 6 | #8 CSRF, #9 Stimulus leaks, #10 Nav patterns, #14 N+1, #15 Slow query, #17 URL building |
| **P3** | 11 | All others |

**Recommendation:** Fix P0 items in the current sprint. Address P1 (proxy) before or with the next release if proxy is used in prod. P2 items can be batched when you touch those areas.

---

## Recommendations

### High Priority

1. **Fix IDOR Vulnerabilities (Immediate)**
   - **JudgementsController:** Scope `set_judgement` through `@book`; reorder `set_book` before `set_judgement`
   - **ApiKeysController:** Use `current_user.api_keys.find(params[:id])` in destroy

2. **Fix Proxy Controller Security Issues**
   - Add URL validation
   - Require authentication or API key
   - Fix URL parameter parsing bug
   - Add rate limiting

3. **Standardize Boolean Parameter Parsing**
   - Update `proxy_controller.rb` to use `deserialize_bool_param`
   - Audit all controllers for similar issues

4. **Fix Navigation Patterns**
   - Replace all `window.location.href = "/..."` with `buildPageUrl()`
   - Replace `window.location.reload()` with Turbo navigation where possible
   - Test subpath deployment

### Medium Priority

5. **Standardize Error Handling**
   - Add `rescue_from` handlers in base controllers
   - Standardize error response formats
   - Improve error logging

5. **Performance Optimization**
   - Add Bullet gem to detect N+1 queries
   - Review and optimize slow queries
   - Add database indexes where needed

6. **Code Cleanup**
   - Remove commented-out code
   - Extract duplicated logic into shared services
   - Address TODO comments

### Low Priority

7. **Documentation Improvements**
   - Establish documentation standards
   - Add missing method documentation
   - Update inline comments for clarity

8. **Code Consistency**
   - Rename predicate methods to follow conventions
   - Standardize code formatting
   - Improve test coverage

---

## Summary Statistics

- **Critical Issues:** 5 (including 2 IDOR vulnerabilities)
- **Security Concerns:** 2
- **Code Quality Issues:** 5 (including Stimulus listener leaks)
- **Performance Issues:** 2
- **Missing Functionality:** 2
- **Documentation Issues:** 3

**Total Issues Found:** 20

**By importance:** P0: 2 | P1: 1 | P2: 6 | P3: 11

---

## Notes

- The codebase is generally well-structured and follows Rails conventions
- Most issues are consistency-related rather than critical bugs
- The migration from Angular to Stimulus/Turbo appears to be mostly complete
- Security issues in the proxy controller should be addressed promptly
- Navigation patterns need standardization for subpath deployment support

---

**Next Steps:**

1. Review and prioritize findings
2. Create GitHub issues for each finding
3. Assign owners and set deadlines
4. Track progress in project management system
5. Schedule follow-up review after fixes are implemented
