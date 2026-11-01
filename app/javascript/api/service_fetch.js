/**
 * Fetch for a search service the browser reaches directly (Elasticsearch, Solr...), the way the case's own searches do.
 * It is not Quepid, so unlike apiFetch it sends no CSRF token and no cookies. Quepid's own addresses use api/json or apiFetch.
 */
export function serviceFetch(input, init = {}) {
  return fetch(input, { credentials: "omit", ...init })
}
