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

Same API as native `fetch`, but automatically adds the `X-CSRF-Token` header from the page's meta tag (set by Rails `csrf_meta_tags`). The CSRF token is merged into existing headers and won't overwrite an existing `X-CSRF-Token` header if one is already provided.

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

// PUT with JSON body
const res = await apiFetch(url, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(data)
})
```

### getCsrfToken()

Returns the CSRF token string from the page's meta tag. Use only when you need it outside `apiFetch` (e.g. for FormData with `authenticity_token`, or when using raw `fetch`).

```javascript
const token = getCsrfToken()
```

## URL Generation

**Never hardcode `/` or absolute paths.** Use one of the following approaches:

### 1. Data Attributes (Preferred for Known URLs)

When the URL is known at render time, pass it from the server using a Rails helper. This respects subpath deployments automatically.

**In ERB:**
```erb
<div data-controller="inline-edit"
     data-inline-edit-url-value="<%= api_v1_case_path(@case) %>"
     data-inline-edit-field-value="case_name"
     data-inline-edit-wrapper-value="case">
```

**In Stimulus Controller:**
```javascript
export default class extends Controller {
  static values = { url: String }

  async save() {
    const res = await apiFetch(this.urlValue, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
  }
}
```

### 2. buildApiUrl(root, ...pathSegments)

Builds API URLs (with `/api/` prefix). When `root` is empty, returns an absolute path starting with `/api/` so `fetch` resolves against the origin, not the current path.

**Location:** `app/javascript/utils/quepid_root.js`

```javascript
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

const root = getQuepidRootUrl()

// When root is set: {root}/api/cases/123
// When root is empty: /api/cases/123
const url = buildApiUrl(root, "cases", caseId)

// Multiple segments
const url = buildApiUrl(root, "teams", teamId, "books")           // /api/teams/5/books
const url = buildApiUrl(root, "cases", caseId, "annotations", id) // /api/cases/1/annotations/42
```

**Note:** `buildApiUrl` filters out `undefined` and `null` values from path segments automatically.

### 3. buildPageUrl(root, ...pathSegments)

Builds page URLs (no `api/` prefix) for navigation. When `root` is empty, returns relative paths for subpath deployments.

**Location:** `app/javascript/utils/quepid_root.js`

```javascript
import { getQuepidRootUrl, buildPageUrl } from "utils/quepid_root"

const root = getQuepidRootUrl()

// When root is set: {root}/cases
// When root is empty: ../../cases (relative path for subpath deployments)
buildPageUrl(root, "cases")
buildPageUrl(root, "teams")
buildPageUrl(root, "books", bookId, "judge")  // /books/123/judge
```

**Note:** `buildPageUrl` filters out `undefined` and `null` values from path segments automatically.

### 4. Dedicated URL Helpers

For common endpoints, `utils/quepid_root.js` exports specialized helpers:

#### buildCaseQueriesUrl(root, caseId, queryId)

Turbo Stream URL for case queries (create/destroy). Returns relative paths when root is empty.

```javascript
import { buildCaseQueriesUrl } from "utils/quepid_root"

// Create: {root}/case/1/queries or ../queries
buildCaseQueriesUrl(root, 1)

// Destroy: {root}/case/1/queries/42 or ../queries/42
buildCaseQueriesUrl(root, 1, 42)
```

#### buildApiCaseQueriesUrl(root, caseId, queryId)

API URL for case queries (JSON create/destroy). Returns absolute path `/api/...` when root is empty.

```javascript
import { buildApiCaseQueriesUrl } from "utils/quepid_root"

// Create: {root}/api/cases/1/queries or /api/cases/1/queries
buildApiCaseQueriesUrl(root, 1)

// Destroy: {root}/api/cases/1/queries/42 or /api/cases/1/queries/42
buildApiCaseQueriesUrl(root, 1, 42)
```

#### buildApiBulkCaseQueriesUrl(root, caseId)

Bulk query API endpoint. Returns absolute path `/api/...` when root is empty.

```javascript
import { buildApiBulkCaseQueriesUrl } from "utils/quepid_root"

// {root}/api/bulk/cases/1/queries or /api/bulk/cases/1/queries
buildApiBulkCaseQueriesUrl(root, 1)
```

#### buildApiQuerySearchUrl(root, caseId, tryNumber, queryId, queryTextOverride, rows, start)

Query search execution API with pagination support. Returns absolute path `/api/...` when root is empty.

```javascript
import { buildApiQuerySearchUrl } from "utils/quepid_root"

// Basic search
buildApiQuerySearchUrl(root, 1, 2, 3)

// With query text override
buildApiQuerySearchUrl(root, 1, 2, 3, "custom query")

// With pagination
buildApiQuerySearchUrl(root, 1, 2, 3, null, 20, 0)  // rows=20, start=0
```

#### buildCaseImportRatingsUrl(root, caseId)

Import ratings page URL (POST). Page URL, not under `/api/`.

```javascript
import { buildCaseImportRatingsUrl } from "utils/quepid_root"

// {root}/case/1/import/ratings or relative path
buildCaseImportRatingsUrl(root, 1)
```

#### buildCaseImportInformationNeedsUrl(root, caseId)

Import information needs page URL (POST). Page URL, not under `/api/`.

```javascript
import { buildCaseImportInformationNeedsUrl } from "utils/quepid_root"

// {root}/case/1/import/information_needs or relative path
buildCaseImportInformationNeedsUrl(root, 1)
```

### getQuepidRootUrl()

Returns the root URL from `data-quepid-root-url` on the `<body>` element (set by Rails `quepid_root_url` helper in the layout). Returns empty string if not set, which triggers fallback behavior in URL builders.

```javascript
import { getQuepidRootUrl } from "utils/quepid_root"

const root = getQuepidRootUrl()
// Returns: "" (empty) or "/quepid" (if deployed under subpath)
```

**Note:** The function warns once if `data-quepid-root-url` is missing, but continues to work by returning an empty string.

## Error Handling

Always check `res.ok` and handle errors appropriately:

```javascript
const res = await apiFetch(url, {
  method: "DELETE",
  headers: { Accept: "application/json" }
})

if (!res.ok) {
  const data = await res.json().catch(() => ({}))
  throw new Error(data.message || data.error || res.statusText)
}
```

## Complete Example

```javascript
import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl, buildPageUrl } from "utils/quepid_root"

export default class extends Controller {
  static values = { caseId: Number }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  async deleteCase() {
    const url = buildApiUrl(this.rootUrl, "cases", this.caseIdValue)
    
    try {
      const res = await apiFetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      if (window.flash) window.flash.success = "Case deleted successfully."
      window.location.href = buildPageUrl(this.rootUrl, "cases")
    } catch (err) {
      console.error("Delete case failed:", err)
      if (window.flash) window.flash.error = "Could not delete the case. " + (err.message || "")
    }
  }
}
```

## When to Use Each Approach

1. **Data attributes**: Use when the URL is known at render time (most common case)
2. **buildApiUrl/buildPageUrl**: Use when building URLs dynamically in JavaScript
3. **Dedicated helpers**: Use for specific endpoints that have helpers (queries, imports, search)
4. **getQuepidRootUrl()**: Always call this first when building URLs dynamically; it may return an empty string, which URL builders handle correctly
