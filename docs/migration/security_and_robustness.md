# Security and robustness checklist

Consolidated from the March 2026 code review and design notes. Actionable regardless of the Angular migration status.

---

## P1 — Proxy controller SSRF risk

**Location:** `app/controllers/proxy_controller.rb`

**Issue:** The proxy controller allows unauthenticated requests (`skip_before_action :require_login`) and forwards requests to arbitrary URLs without validation. When tries use `proxy_requests: true`, the browser calls `ProxyController#fetch` so search hits the engine same-origin (CORS workaround). That path is **not** dev-only — it is part of the normal search flow in some deployments.

**Current protection:** None (no auth, no URL validation, no rate limiting).

**Recommendations:**
1. Add URL validation similar to `SearchEndpoints::ValidationsController`
2. Require authentication or API key
3. Add rate limiting
4. Validate URLs against allowlist if possible

---

## P2 — Authorization: scope by user (IDOR hardening)

**Issue:** APIs must resolve cases, teams, books, and related records through **scopes the current user may access**, not unconstrained id lookups.

**Action:** Audit and fix as you migrate or refactor controllers.

---

## P2 — CSRF protection bypass

**Location:** Multiple controllers

**Issue:** Several controllers skip CSRF verification:

- `proxy_controller.rb:5` — `skip_before_action :verify_authenticity_token, only: [ :fetch ]`
- `sessions_controller.rb:6` — `skip_before_action :verify_authenticity_token, only: :create`
- `api/v1/signups_controller.rb:7` — `skip_before_action :verify_authenticity_token`

**Assessment:**
- API endpoints (`Api::ApiController`) use `protect_from_forgery with: :null_session` — appropriate.
- Sessions/signups skip CSRF for API-style auth (JSON, tokens) — expected.
- **Proxy is the concerning one** — fix together with the SSRF item above.

---

## P2 — Rating deletion: tolerate "already gone"

**Issue:** Deleting a rating that was already removed can error; races (tabs, double clicks) get worse with more async UI.

**Action:** Prefer **no-op success** (or equivalent) for "delete missing rating" so the client can stay optimistic without surfacing 500s.

---

## P2 — N+1 query issues

**Locations:**

1. **`cases_controller.rb:32`** — `includes(:owner, :teams, scores: :user)` may still cause N+1 if scores are accessed beyond the eager load.
2. **`teams_controller.rb:248`** — missing `scores` association if scores are accessed in the view.
3. **`api/v1/cases_controller.rb`** (`fetch_full_cases`) — watch for extra associations touched in serializers.

**Status:** Bullet gem is in the Gemfile (dev/test). Fix N+1s as they surface — don't guess, measure.

---

## P2 — Inefficient query in API cases controller

**Location:** `app/controllers/api/v1/cases_controller.rb:192-195`

**Issue:** `fetch_full_cases` uses `left_outer_joins(:metadata)` (commented "this is slow!") and orders by `case_metadata.last_viewed_at`.

**Status:** Composite index `idx_last_viewed_case` on `(last_viewed_at, case_id)` exists in schema. If users with 50+ cases still report slowness, consider denormalizing or switching to `includes`.

---

## Proxy usage in production

The proxy (`/proxy/fetch`) is invoked when a search endpoint has `proxy_requests: true`. In the core UI, `search_executor.js` builds that URL via `buildProxyUrl` for Solr and ES/OpenSearch when `tryConfig.proxy_requests !== false`. Treat proxy security (SSRF item above) as production-critical.
