# Code review findings

**Date:** March 21, 2026  
**Reviewer:** AI code review  
**Scope:** Security and performance notes for **this repository (`main`-line)**. Actionable regardless of the Angular core port. The core UI query list uses Stimulus (`query_row_controller.js`) and `app/javascript/modules/search_executor.js` for live search; those call the same `/proxy/fetch` endpoint when a try has `proxy_requests` enabled. Cross-check file paths after large refactors.

---

## Table of Contents

1. [Security concerns](#security-concerns)
2. [Performance issues](#performance-issues)
3. [Proxy usage in production](#proxy-usage-in-production)

---

## Security concerns

### Proxy controller SSRF risk — **P1**

**Location:** `app/controllers/proxy_controller.rb`

**Issue:** The proxy controller allows unauthenticated requests (`skip_before_action :require_login`) and forwards requests to arbitrary URLs. While there is some SSRF protection in `Api::V1::SearchEndpoints::ValidationsController`, the proxy controller itself doesn't validate URLs.

**Current protection:**

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

**Pragmatic note:** Proxy is used in production when search endpoints have `proxy_requests: true` (CORS workaround). The Stimulus stack defaults to the proxy when `proxy_requests` is not explicitly false (`search_executor.js`). Unauthenticated + arbitrary URL = SSRF. Require auth or disable in prod until fixed.

---

### CSRF protection bypass — **P2**

**Location:** Multiple controllers

**Issue:** Several controllers skip CSRF verification:

- `app/controllers/proxy_controller.rb:5` — `skip_before_action :verify_authenticity_token, only: [ :fetch ]`
- `app/controllers/sessions_controller.rb:6` — `skip_before_action :verify_authenticity_token, only: :create`
- `app/controllers/api/v1/signups_controller.rb:7` — `skip_before_action :verify_authenticity_token`

**Impact:** These endpoints are vulnerable to CSRF attacks if not properly protected by other means.

**Severity:** Medium (for API endpoints, this is expected; for proxy controller, it's concerning)

**Recommendation:** Review each case:

- API endpoints (`Api::ApiController`) use `protect_from_forgery with: :null_session` which is appropriate
- Sessions controller may need CSRF protection via tokens
- Proxy controller should require authentication or API key

**Pragmatic note:** Sessions/signups often skip CSRF for API-style auth (JSON, tokens). Proxy is the concerning one; fix together with the proxy SSRF item above.

---

## Performance issues

### Potential N+1 query issues — **P2**

**Location:** Multiple controllers

**Issue:** Some queries may trigger N+1 queries:

1. **`app/controllers/cases_controller.rb:32`**

   ```ruby
   query = query.includes(:owner, :teams, scores: :user).distinct
   ```

   This includes `scores: :user` but `scores` is a `has_many` association. If scores are accessed later, this may still cause N+1 queries.

2. **`app/controllers/teams_controller.rb:248`**

   ```ruby
   @pagy_cases, @cases = pagy(cases_query.order(:id).includes(:owner, :teams))
   ```

   Missing `scores` association if scores are accessed in the view.

3. **`app/controllers/api/v1/cases_controller.rb`** (`fetch_full_cases`, ~`187`–`196`) — `includes(:owner, :book).preload(:tries, :teams, :cases_teams)` is sound if those match what the response uses; watch for extra associations touched in serializers. The `left_outer_joins(:metadata)` path is called out separately under [Inefficient query in API cases controller](#inefficient-query-in-api-cases-controller--p2).

**Impact:** Performance degradation with large datasets.

**Severity:** Medium

**Recommendation:**

- Use Bullet gem in development to detect N+1 queries
- Review views to ensure all accessed associations are eager-loaded
- Consider using `with_counts` scope more consistently

**Pragmatic note:** Add Bullet in development; fix N+1s as they appear. Don't guess — measure.

---

### Inefficient query in API cases controller — **P2**

**Location:** `app/controllers/api/v1/cases_controller.rb:192-195`

**Issue:** `fetch_full_cases` uses `left_outer_joins(:metadata)` with a comment "this is slow!" and orders by `case_metadata.last_viewed_at`.

**Current code:**

```ruby
base_query.includes(:owner, :book).preload(:tries, :teams, :cases_teams)
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

## Proxy usage in production

The proxy (`/proxy/fetch`) is invoked when a search endpoint has `proxy_requests: true` — used to avoid CORS when the frontend can't call Solr/ES directly. In the migrated core UI, `app/javascript/modules/search_executor.js` builds that URL (via `buildProxyUrl`) for Solr and ES/OpenSearch when `tryConfig.proxy_requests !== false`. This means the proxy is part of the normal search flow in some deployments, not just a dev tool. Treat proxy security (SSRF item above) as production-critical if you use proxy endpoints.
