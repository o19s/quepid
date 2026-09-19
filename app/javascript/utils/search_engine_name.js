/**
 * Display names for search-engine ids — port of the Angular
 * `searchEngineName` filter used by the take-snapshot modal copy.
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
 * Engines that cannot look a doc up by id — snapshots must store document
 * fields. Matches `settingsSvc.supportLookupById`.
 */
const NO_LOOKUP_BY_ID = new Set(["vectara", "searchapi"])

/**
 * @param {string | null | undefined} engineId
 * @returns {string}
 */
export function searchEngineDisplayName(engineId) {
  if (!engineId) return ""
  return SEARCH_ENGINE_NAMES[engineId] || engineId
}

/**
 * @param {string | null | undefined} engineId
 * @returns {boolean}
 */
export function supportLookupById(engineId) {
  if (!engineId) return true
  return !NO_LOOKUP_BY_ID.has(engineId)
}
