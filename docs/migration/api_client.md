# API client conventions (Stimulus + fetch)

**Scope:** How **new** workspace-facing JS should talk to the server when the core is no longer Angular. Today’s Angular code uses **`caseTryNavSvc.getQuepidRootUrl()`** and **`$http`** instead—see project rules.

These are **conventions**, not a prescription for one file layout or a fixed set of URL helpers.

---

## CSRF

- Prefer a **single shared entry point** for `fetch` that always attaches **`X-CSRF-Token`** from the meta tag Rails provides (`csrf_meta_tags`), so Stimulus controllers do not each reimplement token lookup.
- If you use raw `fetch` somewhere, obtain the token the same way the shared helper does; do not omit CSRF on mutating requests.

---

## URL rules

- **Never hardcode** a root of `/` or other absolute paths that break **subpath deployments**. Use the same root semantics the app already uses elsewhere (`quepid_root_url` / body `data-*` or equivalent).
- **When the URL is known at render time**, pass it from the server (ERB path helpers → `data-*-url` values on the element Stimulus controls). That stays correct for subpaths without client-side path math.
- **When the URL is built in JS** (dynamic ids, optional segments), centralize construction in one module or small set of functions so every caller stays subpath- and prefix-aware.
- Distinguish **JSON API** paths (typically under `/api/...`) from **page** paths (no `/api/`). Keep that distinction in one place so `fetch` targets stay consistent.
- **Query string** changes on the current page (sort, pagination, tour flags) should use APIs that respect the current path and search string, not string concatenation from a hardcoded pathname.

---

## Response formats

- Workspace endpoints may support **JSON**, **HTML** (e.g. Turbo Frame responses), or **Turbo Stream** (`Accept: text/vnd.turbo-stream.html`) depending on the feature. Negotiate with the **`Accept`** header; if Turbo is disabled for Drive but streams are used, the client may need to **apply stream bodies explicitly** (e.g. via Turbo’s stream renderer)—follow whatever the app’s bundle already exposes.
- Prefer **one obvious format per action** in the controller; if you support multiple formats, document which `Accept` value each Stimulus caller uses.

---

## Errors

- Check **`response.ok`** (or status) before treating the body as success.
- For JSON error bodies, parse safely and surface a message; avoid assuming a single error key—controllers vary.

---

## Full refresh vs in-place update

- After a mutation, prefer **in-place updates** (Turbo Frame / Stream, partial DOM update) when the UX allows.
- When a full reload is required, use whatever the app standardizes on (**Turbo.visit** to the current URL vs `location.reload()`) so behavior stays consistent where Turbo is loaded.

---

## Angular-era note

Until the workspace is ported, **`caseTryNavSvc.getQuepidRootUrl()`** remains the Angular-side root helper; Stimulus code should use the **Rails-provided root** and the rules above so both stacks don’t diverge on deployment paths.
