# API client conventions (Stimulus + fetch)

**Scope:** Browser-side **`fetch`** used by **Stimulus** and ES modules in `app/javascript/` (wired through **`application_modern`** and `config/importmap.rb`). This is separate from **server-side** outbound HTTP (**`HttpClientService`**, Faraday — proxy, fetch service, etc.). Legacy Angular uses **`$http`** plus **`ng-rails-csrf`** (`app/assets/javascripts/interceptors/rails-csrf.js`) and **`caseTryNavSvc.getQuepidRootUrl()`** — see project rules. Migration context: [angularjs_elimination_plan.md](./angularjs_elimination_plan.md); React option: [old/react_migration_plan.md](./old/react_migration_plan.md).

These are **conventions** plus a snapshot of **what the repo does today** — not a mandate for one file layout.

---

## What exists in the codebase today

- **Shared JSON defaults:** **`jsonFetch()`** and **`railsJsonHeaders()`** in **`modules/json_fetch`** merge **`Accept`**, optional **`Content-Type: application/json`** (when `body` is a string), and **`X-CSRF-Token`** from **`csrfToken()`** in **`modules/api_url`**. They do **not** parse JSON, normalize errors, or retry — callers keep that logic. For CSRF-only or custom `fetch` shapes, still use **`csrfToken()`** directly.
- **App root for JS URL building:** `document.body.dataset.quepidRootUrl`, populated by **`data-quepid-root-url`** on `<body>` in layouts such as `app/views/layouts/core_new_ui.html.erb` and `app/views/layouts/core.html.erb` (`request.base_url` + `ENV['RAILS_RELATIVE_URL_ROOT']`). Use this (or server-provided URLs) instead of hardcoding `/` or ignoring relative URL roots.
- **Case workspace context** on the same layouts: e.g. **`data-case-id`**, **`data-try-number`**, plus feature flags (`data-communal-scorers-only`, `data-query-list-sortable`). Controllers read these when constructing API paths.
- **Pinned modules** (see `config/importmap.rb`): e.g. **`modules/search_executor`**, **`modules/query_template`**. Search from the browser goes through **`search_executor.js`**, which implements the same **`search_endpoint.search_engine`** types as legacy splainer-search: **Solr**, **static** (Solr-shaped), **Elasticsearch**, **OpenSearch**, **Vectara**, **Algolia**, and **SearchAPI** (GET/POST + `mapper_code`). It calls **`/proxy/fetch`** (with the same root prefix) when proxying is enabled — see below.

---

## CSRF

- **Today:** Import **`csrfToken()`** from **`modules/api_url`** and send **`X-CSRF-Token: csrfToken()`** on mutating requests to Rails-backed JSON/HTML endpoints (token comes from **`csrf_meta_tags`**). Do not duplicate `document.querySelector('meta[name="csrf-token"]')` in controllers.
- Use **`jsonFetch`** / **`railsJsonHeaders`** when several call sites in one change need the same header bundle; avoid a heavier global wrapper (magic retries, auto-parsed errors) unless the whole app opts in.
- **Exception:** Requests to **`ProxyController#fetch`** intentionally skip Rails CSRF verification; proxied search **`fetch`** calls in **`search_executor.js`** do not attach the token. Do not assume every `fetch` in the app should send CSRF — match the target controller.

---

## URL rules

For **`apiUrl()`**, **`csrfToken()`**, and general URL conventions, see [stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md) (authoritative). The notes below cover **edge cases** specific to fetch patterns:

- **When the URL is known at render time**, prefer Stimulus **`values`** (e.g. `data-*-url` from ERB) — see **`mapper_wizard_controller.js`**.
- **Path-relative `fetch`** (e.g. `books/${id}/...` with no leading slash) is valid when the current page is under that path; it resolves against the browser’s current origin and path prefix. Use consistently with your feature’s routing.
- **`search_executor.js`** builds **`${rootUrl}/proxy/fetch?url=${encodeURIComponent(targetUrl)}`** for CORS-safe outbound search when proxying is on (all engines above).

---

## Response formats

- Workspace **`fetch`** callers usually expect **JSON** (`Accept: application/json` where needed) and use **`response.json()`**. Always check **`response.ok`** (or status) before treating the body as success.
- Turbo is loaded from **`application_modern.js`**, but **`Turbo.session.drive` is set to `false`**, so full-page navigation is not Turbo Drive–driven by default. Prefer **`response.ok`** handling and targeted DOM updates; some flows still use **`window.location.reload()`** after success (e.g. add-query). Use **`Turbo.visit`** when intentionally aligning with Turbo navigation in places where Drive or visits are enabled.

---

## Errors

- Check **`response.ok`** before parsing success bodies.
- For JSON errors, parse safely; error shapes differ by controller.

---

## Full refresh vs in-place update

- Prefer **in-place updates** when UX allows (DOM replacement, frames/streams).
- When a full reload is used today, code may call **`window.location.reload()`**; if you introduce Turbo Drive or visit-based flows, standardize on **`Turbo.visit`** for that surface.

---

## Angular-era note

Until the workspace is fully ported, Angular keeps **`caseTryNavSvc.getQuepidRootUrl()`** and **`$http`** with CSRF for **`api/`** URLs. Stimulus code should use **`data-quepid-root-url`** (and the rules above) so both stacks stay consistent under subpath deployments.
