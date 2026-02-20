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
9. [JSHint → ESLint/Prettier Migration Review](#9-jshint--eslintprettier-migration-review-feb-2026)

---

## Critical Issues

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

