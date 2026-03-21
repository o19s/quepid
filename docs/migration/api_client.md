# API client conventions (Stimulus + fetch)

**Scope:** Browser-side **`fetch`** used by **Stimulus** and ES modules in `app/javascript/` (wired through **`application_modern`** and `config/importmap.rb`). This is separate from **server-side** outbound HTTP (**`HttpClientService`**, Faraday — proxy, fetch service, etc.). Legacy Angular uses **`$http`** plus **`ng-rails-csrf`** (`app/assets/javascripts/interceptors/rails-csrf.js`) and **`caseTryNavSvc.getQuepidRootUrl()`** — see project rules. Migration context: [angularjs_elimination_plan.md](./angularjs_elimination_plan.md); React option: [old/react_migration_plan.md](./old/react_migration_plan.md).

These are **conventions** plus a snapshot of **what the repo does today** — not a mandate for one file layout.

---

## What exists in the codebase today

- **No shared `fetch` helper module** yet. Stimulus controllers each read the CSRF meta tag and build `headers` locally (same token source Angular’s interceptor uses: `meta[name="csrf-token"]`).
- **App root for JS URL building:** `document.body.dataset.quepidRootUrl`, populated by **`data-quepid-root-url`** on `<body>` in layouts such as `app/views/layouts/core_new_ui.html.erb` and `app/views/layouts/core.html.erb` (`request.base_url` + `ENV['RAILS_RELATIVE_URL_ROOT']`). Use this (or server-provided URLs) instead of hardcoding `/` or ignoring relative URL roots.
- **Case workspace context** on the same layouts: e.g. **`data-case-id`**, **`data-try-number`**, plus feature flags (`data-communal-scorers-only`, `data-query-list-sortable`). Controllers read these when constructing API paths.
- **Pinned modules** (see `config/importmap.rb`): e.g. **`modules/search_executor`**, **`modules/query_template`**. Search from the browser goes through **`search_executor.js`**, which calls **`/proxy/fetch`** (with the same root prefix) when proxying is enabled — see below.

---

## CSRF

- **Today:** Read the token from **`csrf_meta_tags`** → `document.querySelector('meta[name="csrf-token"]')` (`.content` or `.getAttribute("content")`) and send **`X-CSRF-Token`** on mutating requests to Rails-backed JSON/HTML endpoints.
- **Aspirational:** A single small module (e.g. `csrfToken()` + `fetchWithRailsDefaults()`) would avoid duplicating that lookup across controllers.
- **Exception:** Requests to **`ProxyController#fetch`** intentionally skip Rails CSRF verification; proxied search **`fetch`** calls in **`search_executor.js`** do not attach the token. Do not assume every `fetch` in the app should send CSRF — match the target controller.

---

## URL rules

- **Typical Rails JSON paths:** prefer **`apiUrl()`** from **`modules/api_url`** (and **`csrfToken()`** from the same module) so subpath deployments stay correct — see [stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md). The bullets below cover **`data-*` URLs**, proxy search, and cases where a shared helper is not used yet.
- **Never hardcode** a site root of **`/`** for APIs when the app may sit under a **relative URL root**. Prefer **`document.body.dataset.quepidRootUrl`** or URLs supplied from the server.
- **JSON API** routes used by the new UI are typically under **`${rootUrl}/api/...`** (e.g. cases, tries, queries, bulk queries), matching **`app/controllers/api`**.
- **When the URL is known at render time**, prefer Stimulus **`values`** (e.g. `data-*-url` from ERB) — see **`mapper_wizard_controller.js`**.
- **Path-relative `fetch`** (e.g. `books/${id}/...` with no leading slash) is valid when the current page is under that path; it resolves against the browser’s current origin and path prefix. Use consistently with your feature’s routing.
- **`search_executor.js`** builds **`${rootUrl}/proxy/fetch?url=${encodeURIComponent(targetUrl)}`** for CORS-safe search against Solr / Elasticsearch / OpenSearch when proxying is on.

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
