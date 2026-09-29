/**
 * Search-engine capability checks shared across the case UI. Engine ids are
 * the `search_engine` values stored on tries and search endpoints.
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
