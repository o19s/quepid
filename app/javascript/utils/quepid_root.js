/**
 * Quepid root URL for API and navigation. Use this instead of hardcoding "/"
 * so deployment under a subpath (e.g. RAILS_RELATIVE_URL_ROOT) works.
 *
 * The layout core_modern.html.erb sets data-quepid-root-url on <body> via the
 * Rails helper quepid_root_url. When that is missing (e.g. wrong layout),
 * we warn once and return ""; callers may then fall back to relative paths
 * so the app still works under subpath deployments.
 *
 * @returns {string} Root URL with no trailing slash, or "" if not set.
 */
let _warnedEmpty = false;

export function getQuepidRootUrl() {
  const root = document.body?.dataset?.quepidRootUrl ?? '';
  if (!root && !_warnedEmpty) {
    _warnedEmpty = true;
    console.warn(
      '[Quepid] data-quepid-root-url is empty. Set it on <body> (e.g. via core_modern layout). ' +
        'URLs may fall back to relative paths; see docs/app_structure.md.'
    );
  }
  return root;
}

/**
 * Builds the URL for case queries (Turbo Stream create/destroy).
 * When root is set, returns absolute URL. When root is empty, returns a
 * relative path so subpath deployments work (e.g. from /quepid/case/1/try/2,
 * "../queries" resolves to /quepid/case/1/queries).
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @param {number} [queryId] - Query id for destroy; omit for create
 * @returns {string} Full URL or relative path
 */
export function buildCaseQueriesUrl(root, caseId, queryId = null) {
  const base = root ? root.replace(/\/$/, '') : '';
  if (base) {
    const suffix = queryId ? `/${queryId}` : '';
    return `${base}/case/${caseId}/queries${suffix}`;
  }
  const hasTryInPath =
    typeof window !== 'undefined' && window.location?.pathname?.includes('/try/');
  const rel = hasTryInPath ? '../queries' : 'queries';
  return queryId ? `${rel}/${queryId}` : rel;
}

/**
 * Builds the URL for case queries API (JSON create/destroy, used when Turbo Stream unavailable).
 * When root is set, returns absolute URL. When root is empty, returns absolute path /api/...
 * so fetch resolves against the origin.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @param {number} [queryId] - Query id for destroy; omit for create
 * @returns {string} Full URL or absolute path
 */
export function buildApiCaseQueriesUrl(root, caseId, queryId = null) {
  const base = root ? root.replace(/\/$/, '') : '';
  const suffix = queryId ? `/${queryId}` : '';
  if (base) return `${base}/api/cases/${caseId}/queries${suffix}`;
  return `/api/cases/${caseId}/queries${suffix}`;
}

/**
 * Builds a page URL (no api/ prefix). Use for navigation to pages like /cases, /teams.
 * When root is set, returns absolute URL. When root is empty, returns a relative path
 * for subpath deployments.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {...string} pathSegments - Path parts (e.g. "cases", "teams")
 * @returns {string} Full URL or relative path
 * @example
 *   buildPageUrl(root, "cases")  // /cases or ../../cases
 *   buildPageUrl(root, "teams")  // /teams or ../../teams
 *   // When root is empty: uses ../../../ for deep paths (/try/, /judge/) else ../../
 */
export function buildPageUrl(root, ...pathSegments) {
  const path = pathSegments.filter((s) => s !== undefined && s !== null).join('/');
  const base = root ? root.replace(/\/$/, '') : '';
  if (base) return path ? `${base}/${path}` : base;
  const pathname = typeof window !== 'undefined' ? (window.location?.pathname ?? '') : '';
  const needsThreeLevels = pathname.includes('/try/') || pathname.includes('/judge/');
  const prefix = needsThreeLevels ? '../../../' : '../../';
  return path ? `${prefix}${path}` : prefix.replace(/\/$/, '');
}

/**
 * Builds a generic API URL. Use for endpoints that don't have a dedicated helper.
 * Prefer data-* attributes from the server when the URL is known at render time.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {...string|number} pathSegments - Path parts (e.g. "cases", 1, "annotations")
 * @returns {string} Full URL (when root set), absolute path /api/... (when root empty), or relative path
 * @example
 *   buildApiUrl(root, "cases", caseId)           // /api/cases/123 or {root}/api/cases/123
 *   buildApiUrl(root, "teams", teamId, "books")  // /api/teams/5/books
 *
 * When root is empty, returns an absolute path (e.g. /api/bulk/cases/1/queries/delete) so fetch
 * resolves against the origin, not the current path. A relative path like "api/..." would resolve
 * against the current path (e.g. case/1/try/2/api/...) and hit the wrong endpoint.
 */
export function buildApiUrl(root, ...pathSegments) {
  const path = pathSegments.filter((s) => s !== undefined && s !== null).join('/');
  const apiPath = `api/${path}`;
  const base = root ? root.replace(/\/$/, '') : '';
  if (base) return `${base}/${apiPath}`;
  return `/${apiPath}`;
}

/**
 * Builds the URL for bulk case queries API.
 * When root is empty, returns absolute path /api/... so fetch resolves against the origin.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @returns {string} Full URL or absolute path
 */
export function buildApiBulkCaseQueriesUrl(root, caseId) {
  const base = root ? root.replace(/\/$/, '') : '';
  if (base) return `${base}/api/bulk/cases/${caseId}/queries`;
  return `/api/bulk/cases/${caseId}/queries`;
}

/**
 * Builds the URL for case import ratings (POST). Page URL, not under /api/.
 * Used by the Import modal for CSV, RRE, and LTR ratings.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @returns {string} Full URL or relative path
 */
export function buildCaseImportRatingsUrl(root, caseId) {
  return buildPageUrl(root, 'case', caseId, 'import', 'ratings');
}

/**
 * Builds the URL for case import information needs (POST). Page URL, not under /api/.
 * Used by the Import modal for CSV information needs.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @returns {string} Full URL or relative path
 */
export function buildCaseImportInformationNeedsUrl(root, caseId) {
  return buildPageUrl(root, 'case', caseId, 'import', 'information_needs');
}

/**
 * Builds the URL for query search execution API (GET). Returns docs and ratings
 * for the selected query against the try's search endpoint.
 *
 * @param {string} root - From getQuepidRootUrl(); may be ""
 * @param {number} caseId - Case id
 * @param {number} tryNumber - Try number
 * @param {number} queryId - Query id
 * @param {string} [queryTextOverride] - Optional. Custom query text for DocFinder/targeted search.
 * @param {number} [rows] - Optional. Number of documents to return (pagination).
 * @param {number} [start] - Optional. Offset for pagination.
 * @returns {string} Full URL or relative path
 */
export function buildApiQuerySearchUrl(
  root,
  caseId,
  tryNumber,
  queryId,
  queryTextOverride = null,
  rows = null,
  start = null
) {
  const base = buildApiUrl(root, 'cases', caseId, 'tries', tryNumber, 'queries', queryId, 'search');
  const params = new URLSearchParams();
  if (queryTextOverride && String(queryTextOverride).trim()) {
    params.set('q', queryTextOverride.trim());
  }
  if (rows != null && rows > 0) params.set('rows', String(rows));
  if (start != null && start > 0) params.set('start', String(start));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Builds the current page URL with modified query parameters.
 * Use for history.replaceState or navigation when staying on the current path
 * with modified params. Subpath-safe: preserves the full path from window.location.
 *
 * @param {Object} paramOverrides - { key: value } to set. Use null/undefined to delete a param.
 *   Other existing params are preserved.
 * @returns {string} Full URL string
 * @example
 *   buildCurrentPageUrlWithParams({ startTour: null })     // remove startTour
 *   buildCurrentPageUrlWithParams({ sort: 'name' })       // set sort, preserve others
 *   buildCurrentPageUrlWithParams({ sort: null, page: 1 }) // delete sort, set page
 */
export function buildCurrentPageUrlWithParams(paramOverrides = {}) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(paramOverrides)) {
    if (value === undefined || value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Returns the search params of the current page URL.
 * Use for reading query params. Subpath-safe.
 *
 * @returns {URLSearchParams}
 */
export function getCurrentPageSearchParams() {
  return new URL(window.location.href).searchParams;
}

/**
 * Refreshes the current page. Prefers Turbo.visit when available for SPA-style
 * navigation; falls back to window.location.reload(). Subpath-safe because
 * window.location.href already contains the full path.
 */
export function reloadOrTurboVisit() {
  if (typeof window !== 'undefined' && window.Turbo?.visit) {
    window.Turbo.visit(window.location.href, { action: 'replace' });
  } else {
    window.location.reload();
  }
}
