// Fetch for the search service itself (Elasticsearch, Solr...), which the browser reaches directly, as the case's own
// searches do. It is not Quepid, so unlike apiFetch it sends no CSRF token. For Quepid's own addresses use apiFetch.
export function serviceFetch(input, init = {}) {
  // eslint-disable-next-line no-restricted-globals
  return fetch(input, { credentials: "omit", ...init })
}
