/**
 * Search-engine capability checks shared across the case UI. Engine ids are
 * the `search_engine` values stored on tries and search endpoints. Display
 * labels come from the server's `SearchEngine::LABELS`, passed to controllers
 * as an `engineLabels` Stimulus value.
 */

const ES_LIKE_ENGINES = new Set(["es", "os"])

/** Engines that cannot look a doc up by id — snapshots must store document fields. */
const NO_LOOKUP_BY_ID_ENGINES = new Set(["vectara", "searchapi"])

/**
 * Elasticsearch and OpenSearch share query DSL, explain, and JSON query params.
 * @param {string | null | undefined} engineId
 * @returns {boolean}
 */
export function isEsLikeEngine(engineId) {
  return ES_LIKE_ENGINES.has(engineId)
}

/**
 * @param {string | null | undefined} engineId
 * @returns {boolean}
 */
export function supportsLookupById(engineId) {
  return !NO_LOOKUP_BY_ID_ENGINES.has(engineId)
}

/**
 * A static (CSV-backed) case is served by a Solr-compatible endpoint, so searching
 * and filtering treat it as Solr. Capability checks that read the *try* (e.g. "Show
 * only rated") deliberately keep `static` as-is.
 *
 * @param {string | null | undefined} engineId
 * @returns {string | null | undefined}
 */
export function normalizeSearchEngine(engineId) {
  return engineId === "static" ? "solr" : engineId
}

/**
 * @param {Record<string, string> | null | undefined} labels `SearchEngine::LABELS` from the server
 * @param {string | null | undefined} engineId
 * @returns {string}
 */
export function searchEngineLabel(labels, engineId) {
  if (!engineId) return ""
  return labels?.[engineId] || engineId
}
