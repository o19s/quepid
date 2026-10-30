/**
 * Search-engine capability checks shared across the case UI. Engine ids are
 * the `search_engine` values stored on tries and search endpoints. Display
 * labels come from the server's `SearchEngine::LABELS`, passed to controllers
 * as an `engineLabels` Stimulus value.
 */

// WarpSearch is a hosted engine queried through its OpenSearch-compatible API.
const ES_LIKE_ENGINES = new Set(["es", "os", "warpsearch"])

/** Engines splainer-search doesn't know by name, mapped to the engine whose API they speak. */
const SEARCHER_ENGINE_ALIASES = { warpsearch: "os" }

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
 * The engine id splainer-search should build its searcher, validator or doc
 * resolver for. Use it only at that boundary: the stored engine (e.g. `warpsearch`)
 * must stay on the settings that get saved back to the try.
 *
 * @param {string | null | undefined} engineId
 * @returns {string | null | undefined}
 */
export function searcherEngine(engineId) {
  const engine = normalizeSearchEngine(engineId)
  return SEARCHER_ENGINE_ALIASES[engine] || engine
}

/**
 * A copy of `settings` whose `searchEngine` is the one splainer-search understands.
 *
 * @template {{ searchEngine?: string | null } | null | undefined} T
 * @param {T} settings
 * @returns {T}
 */
export function withSearcherEngine(settings) {
  if (!settings) return settings
  const engine = searcherEngine(settings.searchEngine)
  return engine === settings.searchEngine ? settings : { ...settings, searchEngine: engine }
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
