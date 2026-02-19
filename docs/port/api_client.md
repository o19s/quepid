# API Client Guide

Quepid uses a centralized fetch wrapper for client-side API calls. Use it instead of raw `fetch` or jQuery `$.ajax` for all new code.

**URL rules:** Never hardcode `/` or absolute paths. Use `getQuepidRootUrl()` (Stimulus) or `quepid_root_url` (Rails). See [URL Generation](#url-generation) below.

## Fetch Wrapper

**Location:** `app/javascript/api/fetch.js`

**Import:**
```javascript
import { apiFetch, getCsrfToken } from "api/fetch"
```

### apiFetch(url, init)

Same API as native `fetch`, but automatically adds the `X-CSRF-Token` header from the page's meta tag (set by Rails `csrf_meta_tags`).

```javascript
// GET
const res = await apiFetch(url, { headers: { Accept: "application/json" } })

// DELETE
const res = await apiFetch(url, { method: "DELETE", headers: { Accept: "application/json" } })

// POST with JSON body
const res = await apiFetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(data)
})
```

### getCsrfToken()

Returns the CSRF token string. Use only when you need it outside `apiFetch` (e.g. for FormData with `authenticity_token`).

## URL Generation

**Never hardcode `/` or absolute paths.** Use one of:

1. **`data-*` attributes** — When the URL is known at render time, pass it from the server using a Rails helper (respects subpath deployments):
   ```erb
   <div data-controller="my-controller"
        data-my-controller-delete-url-value="<%= api_case_path(@case) %>">
   ```

2. **`buildApiUrl(root, ...pathSegments)`** — From `utils/quepid_root.js`:
   ```javascript
   import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

   const root = getQuepidRootUrl()
   const url = buildApiUrl(root, "cases", caseId)                    // /api/cases/123
   const url = buildApiUrl(root, "teams", teamId, "books")           // /api/teams/5/books
   const url = buildApiUrl(root, "cases", caseId, "annotations", id) // /api/cases/1/annotations/42
   ```

3. **`buildPageUrl(root, ...pathSegments)`** — For page URLs (no `api/` prefix), e.g. `/cases`, `/teams`:
   ```javascript
   buildPageUrl(root, "cases")              // /cases or ../../cases
   buildPageUrl(root, "teams")              // /teams or ../../teams
   buildPageUrl(root, "books", bookId, "judge")  // /books/123/judge
   ```

4. **Dedicated helpers** — For common endpoints, `utils/quepid_root.js` exports:
   - `buildCaseQueriesUrl(root, caseId, queryId)` — Turbo Stream URL for case queries
   - `buildApiCaseQueriesUrl(root, caseId, queryId)` — API URL for case queries
   - `buildApiBulkCaseQueriesUrl(root, caseId)` — Bulk query API
   - `buildApiQuerySearchUrl(root, caseId, tryNumber, queryId, queryTextOverride, rows, start)` — Query search with pagination
   - `buildCaseImportRatingsUrl(root, caseId)` — Import ratings
   - `buildCaseImportInformationNeedsUrl(root, caseId)` — Import information needs

## Example

```javascript
import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

export default class extends Controller {
  static values = { caseId: Number }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  async deleteCase() {
    const url = buildApiUrl(this.rootUrl, "cases", this.caseIdValue)
    const res = await apiFetch(url, {
      method: "DELETE",
      headers: { Accept: "application/json" }
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || data.error || res.statusText)
    }
    // ...
  }
}
```
