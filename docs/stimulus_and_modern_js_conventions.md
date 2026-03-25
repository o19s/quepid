# Stimulus and modern JavaScript conventions

**Authoritative** rules for code under `app/javascript/controllers/` and `app/javascript/modules/` (Rails ERB + Stimulus).

**Related:** [api_client.md](migration/api_client.md) for fetch edge cases (proxy, response formats, `data-*` URLs). [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) § *Vitest* and *ESLint and Prettier* for how to run tests and lint.

The case workspace route is `GET /case/:id(/try/:try_number)` (importmap + Stimulus).

---

## URLs and API calls

Always use `apiUrl()` from `modules/api_url` for building fetch URLs to Rails JSON APIs. Never construct URLs with `${rootUrl}/...` or hardcode a leading `/`. This keeps paths correct with no root prefix and when Quepid is mounted at a subpath.

```js
import { apiUrl, csrfToken } from "modules/api_url"
import { jsonFetch } from "modules/json_fetch"
// Prefer jsonFetch for JSON bodies + Accept + CSRF in one place:
jsonFetch(apiUrl(`api/cases/${caseId}/queries`), { method: "POST", body: JSON.stringify(payload) })
// Or headers only:
fetch(apiUrl(`api/cases/${caseId}/queries`), { headers: { "X-CSRF-Token": csrfToken() } })
```

For edge cases (proxy search, server-rendered URLs in `data-*` attributes), see [api_client.md](migration/api_client.md).

---

## Stimulus controller patterns

- **Outlets for inter-controller communication:** Use `static outlets = ["other-controller"]` and call methods on `this.otherControllerOutlets`. Never use `this.application.getControllerForElementAndIdentifier()`.
- **Lifecycle cleanup:** If a controller starts async work (fetch, timers, observers), implement `disconnect()` to cancel it. Use `AbortController` for fetch requests.
- **Values syntax:** Use the verbose form with type and default: `static values = { queryId: { type: Number }, queryText: { type: String, default: "" } }`.
- **Public API:** Methods called by outlets from other controllers should be clearly named (`collapse()`, `expand()`, `rerunSearch()`). Keep `toggle()` as the user-facing action.

---

## CSS and styling

- Never use inline `style="..."` attributes in Stimulus controller JS (`renderResults`, etc.). Define CSS classes in a `.css` file under `app/assets/stylesheets/` and add it to `build_css.js`.
- Use semantic HTML (`<ol>` for ranked lists, `<li>` for list items, etc.).
- Escape values for the correct context: `_escapeHtml()` for text content, `_escapeAttr()` for HTML attributes (`src`, `href`).

---

## Testing

- Every Stimulus controller needs a Vitest test file at `test/javascript/controllers/<name>_controller.test.js`.
- Pure JS modules get tests at `test/javascript/modules/<name>.test.js`.
- `yarn test` runs the Vitest test suite (see DEVELOPER_GUIDE for Docker-prefixed commands).
- New files under `app/javascript/modules/*.js` are picked up automatically as `modules/<name>` aliases in `vitest.config.js`; only non-standard paths need extra config.
- Rails controller actions serving the new UI need tests in `test/controllers/` using `assert_select` for response assertions (not `assigns` or `assert_template`, which require an extra gem).
- In Stimulus test HTML, use the same URL shape as `apiUrl()` (e.g. `api/cases/1/...`), not a leading `/api/...`, so expectations match production relative paths.
- **`query-list` URL sort:** `parseQueryListSortFromSearch` in `query_list_controller.js` parses `?sort=` / `?reverse=`. URL params are only written on explicit user sort actions (not on initial load), matching Angular QueriesCtrl behavior. The helper is exported for Vitest because jsdom does not reliably update `location.search` after `history.replaceState`; test the helper directly instead of assuming `replaceState` changes the search string.
- Multi-step fetch flows (`query-row` expand → try config + search) and `executeSearch` are covered with mocked `fetch`; keep one happy path per seam rather than duplicating engine-specific edge cases in controller tests. `executeSearch` sets **`renderedTemplate`** on each result (Solr: hydrated GET URL; ES/OS: pretty-printed JSON body) for **`query-explain-modal`**’s template tab—assert it when testing explain flows.
- Add Vitest coverage for new features and controllers.
