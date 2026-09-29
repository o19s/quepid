/**
 * Display names for search-engine ids used by the take-snapshot modal.
 */

const SEARCH_ENGINE_NAMES = {
  solr: "Solr",
  es: "Elasticsearch",
  os: "OpenSearch",
  vectara: "Vectara",
  algolia: "Algolia",
  static: "Static File",
  searchapi: "Search API"
}

/**
 * @param {string | null | undefined} engineId
 * @returns {string}
 */
export function searchEngineDisplayName(engineId) {
  if (!engineId) return ""
  return SEARCH_ENGINE_NAMES[engineId] || engineId
}
