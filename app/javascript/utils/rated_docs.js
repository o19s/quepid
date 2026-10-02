import { isEsLikeEngine, normalizeSearchEngine } from "utils/search_engines"

/**
 * Rated-document lookup rules — which engines can retrieve already-rated docs by
 * id, and the per-engine filter syntax for doing so. Extracted from the live-query
 * runtime so the rules are unit-testable and independent of the UI stack.
 */

const NATIVELY_RATED_DOCS_LOOKUP_ENGINES = new Set(["es", "os", "solr"])

/**
 * Can this searchapi try look up rated docs? Only true when its mapper defines a
 * `ratedDocsQueryParamsMapper` (surfaced by the server as
 * `mapperBasedSearchEngineSupportsRatedDocsLookup`).
 *
 * @param {{ searchEngine?: string, mapperBasedSearchEngineSupportsRatedDocsLookup?: boolean } | null | undefined} aTry
 * @returns {boolean}
 */
export function supportsSearchApiRatedDocsLookup(aTry) {
  if (!aTry || aTry.searchEngine !== "searchapi") return false
  return !!aTry.mapperBasedSearchEngineSupportsRatedDocsLookup
}

/**
 * Single source of truth for "does this try support rated-docs lookup at all" —
 * gates the "Show only rated" toggle and the Document Finder's "Already Rated
 * Documents" section so the two stay in sync. es/os/solr have a generic id-filter
 * syntax; searchapi is conditional on its mapper.
 *
 * @param {{ searchEngine?: string, mapperBasedSearchEngineSupportsRatedDocsLookup?: boolean } | null | undefined} aTry
 * @returns {boolean}
 */
export function supportsRatedDocsLookup(aTry) {
  if (!aTry) return false
  return (
    NATIVELY_RATED_DOCS_LOOKUP_ENGINES.has(aTry.searchEngine) ||
    supportsSearchApiRatedDocsLookup(aTry)
  )
}

/**
 * Builds the engine-specific "restrict to these doc ids" filter.
 *
 * Returns `undefined` for engines with no generic id-filter syntax (algolia, and
 * searchapi, whose filter is built by its mapper via
 * `buildSearchApiRatedDocsQueryParams` instead) — callers must treat that as "no
 * filter available" rather than appending it to a query.
 *
 * @param {object} params
 * @param {string} params.searchEngine Engine id; `static` is normalized to `solr`.
 * @param {string} params.idField Case's own id field, i.e. `fieldSpec.id`.
 * @param {string[]} params.ratedIds Document ids carrying a rating.
 * @returns {object | string | undefined}
 */
export function buildRatedDocsFilter({ searchEngine, idField, ratedIds }) {
  const engine = normalizeSearchEngine(searchEngine)
  const ids = ratedIds || []

  if (isEsLikeEngine(engine)) {
    return { terms: { [idField]: ids } }
  }

  if (engine === "solr") {
    return `{!terms f=${idField}}${ids.join(",")}`
  }

  if (engine === "vectara") {
    return ids.map((id) => `doc.id = '${id}'`).join(" OR ")
  }

  return undefined
}

/**
 * Rated ids for a query, in the order the ratings object lists them. `slice`
 * mirrors explain-other paging, which cannot page through results and
 * so asks for a window of ids instead.
 *
 * @param {object | null | undefined} ratings Map of docId -> rating.
 * @param {number} [slice] Offset into the id list.
 * @param {number} [pageSize] Window size, i.e. `settings.numberOfRows`.
 * @returns {string[]}
 */
export function ratedDocIds(ratings, slice, pageSize) {
  const ids = ratings ? Object.keys(ratings) : []
  if (slice === undefined) return ids
  return ids.slice(slice, pageSize + slice)
}
