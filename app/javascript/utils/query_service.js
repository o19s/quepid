import { isEsLikeEngine, normalizeSearchEngine } from "utils/search_engines"

/**
 * Helpers extracted from the live-query runtime.
 *
 * These functions deliberately know nothing about framework internals, async
 * implementation details, or the case
 * workspace. The runtime owner imports them directly while it manages the
 * live Query objects.
 */

export function settingsWithTryOverrides(settings, tryOverrides) {
  return {
    ...settings,
    selectedTry: {
      ...settings.selectedTry,
      ...tryOverrides
    }
  }
}

/**
 * Prepare the engine-specific arguments passed to splainer-search.
 *
 * This is deliberately independent of application services. The caller supplies
 * the small engine predicates and the query's ratings filter, while this
 * helper owns the mutation-prone Solr/ES/Search API argument rules that used
 * to live inside the query runtime initializer.
 */
export function buildSearcherRequest({
  settings,
  queryText,
  queryOptions = {},
  options = {},
  mapperFunctions = {},
  proxyUrl,
  isEsOrOs = false,
  ratingsFilter
}) {
  const selectedTry = settings?.selectedTry
  if (!selectedTry) return undefined

  const args = JSON.parse(JSON.stringify(selectedTry.args || {}))
  const searchEngine = normalizeSearchEngine(settings.searchEngine)
  const searcherOptions = {
    customHeaders:
      typeof settings.customHeaders === "object" && settings.customHeaders !== null
        ? JSON.stringify(settings.customHeaders)
        : settings.customHeaders,
    escapeQuery: settings.escapeQuery,
    numberOfRows: settings.numberOfRows,
    basicAuthCredential: settings.basicAuthCredential,
    qOption: { ...(settings.options || {}), ...queryOptions }
  }

  if (settings.apiMethod !== undefined) searcherOptions.apiMethod = settings.apiMethod
  if (options.forceApiMethod !== undefined) searcherOptions.apiMethod = options.forceApiMethod
  if (settings.proxyRequests === true) searcherOptions.proxyUrl = proxyUrl

  if (searchEngine === "searchapi") {
    if (mapperFunctions.docsMapper) searcherOptions.docsMapper = mapperFunctions.docsMapper
    if (mapperFunctions.numberOfResultsMapper)
      searcherOptions.numberOfResultsMapper = mapperFunctions.numberOfResultsMapper
    if (mapperFunctions.nextPageArgsMapper)
      searcherOptions.nextPageArgsMapper = mapperFunctions.nextPageArgsMapper
    searcherOptions.paginationHitsParam = selectedTry.mapperBasedSearchEnginePaginationHitsParam
    searcherOptions.paginationOffsetParam = selectedTry.mapperBasedSearchEnginePaginationOffsetParam
  }

  let solrQueryParamsIsJson = false
  if (searchEngine === "solr") {
    solrQueryParamsIsJson = selectedTry.jsonQueryParams
    if (solrQueryParamsIsJson === undefined) {
      solrQueryParamsIsJson = !Object.keys(args).every((key) => Array.isArray(args[key]))
    }
    searcherOptions.jsonQueryDsl = solrQueryParamsIsJson
    const target = solrQueryParamsIsJson ? (args.params ||= {}) : args
    if (target.echoParams === undefined) target.echoParams = "all"
  }

  if (options.filterToRated && ratingsFilter) {
    if (isEsOrOs) {
      args.query = {
        bool: {
          should: args.query,
          filter: ratingsFilter
        }
      }
    } else if (searchEngine === "solr") {
      const filterKey = solrQueryParamsIsJson ? "filter" : "fq"
      if (args[filterKey] === undefined) args[filterKey] = []
      else if (!Array.isArray(args[filterKey])) args[filterKey] = [args[filterKey]]
      args[filterKey].push(ratingsFilter)
    }
  }

  return { args, queryText, searchEngine, searcherOptions, solrQueryParamsIsJson }
}

/**
 * Create a splainer-search searcher without coupling the construction rules to
 * application services. The caller injects the searcher factory and the
 * small environment-specific predicates; the settings/query contract stays
 * independent of the case-workspace entry bundle.
 */
export function createSearcherFromSettings({
  settings,
  query,
  options = {},
  evaluateMapper,
  proxyUrl,
  isEsOrOs = false,
  createSearcher
}) {
  if (!settings?.selectedTry) return undefined
  options = options == null ? {} : options

  const mapperFunctions =
    settings.searchEngine === "searchapi" ? evaluateMapper(settings.mapperCode) : {}
  const request = buildSearcherRequest({
    settings,
    queryText: query.queryText,
    queryOptions: query.options,
    options,
    mapperFunctions,
    proxyUrl,
    isEsOrOs,
    ratingsFilter: options.filterToRated ? query.filterToRatings(settings) : undefined
  })

  // Normalize arguments because later Query methods read the
  // active settings object when constructing rated-doc searchers.
  settings.searchEngine = request.searchEngine
  return createSearcher(
    settings.createFieldSpec(),
    settings.selectedTry.searchUrl,
    request.args,
    request.queryText,
    request.searcherOptions,
    request.searchEngine
  )
}

const MAPPER_FUNCTION_NAMES = [
  "numberOfResultsMapper",
  "docsMapper",
  "nextPageArgsMapper",
  "ratedDocsQueryParamsMapper"
]

/**
 * Evaluate a mapper-code string once per cache key and return only the mapper
 * functions that Quepid recognizes. The explicit global object keeps this
 * utility testable without relying on the browser global.
 */
export function evaluateMapperFunctions(mapperCode, cache = {}, globalObject = window) {
  if (Object.hasOwn(cache, mapperCode)) return cache[mapperCode]

  MAPPER_FUNCTION_NAMES.forEach((name) => {
    delete globalObject[name]
  })

  // Mapper code is user-provided JavaScript by design; this preserves the
  // existing behavior while moving the seam out of the service.
  const mapperFunction = new Function(mapperCode)
  mapperFunction.call(globalObject)

  const functions = Object.fromEntries(
    MAPPER_FUNCTION_NAMES.map((name) => [
      name,
      typeof globalObject[name] === "function" ? globalObject[name] : undefined
    ])
  )
  cache[mapperCode] = functions
  return functions
}

/**
 * A mapper (e.g. db/mapper_based_search_engines/vespa.js) may spread a per-field score
 * breakdown onto each doc as matchfeatures (Vespa's convention, e.g. {"bm25(overview)":
 * 5.07, "bm25(title)": 2.64}). The generic searchapi engine has no explain concept of
 * its own (SearchApiDocFactory#explain always returns {}), so build a synthetic explain
 * tree in the same {description, value, details} shape Solr/ES explains use — the
 * engine-agnostic bar rendering (explainSvc/normalDocsSvc) picks it up identically to
 * how it already does for Solr's real explain output. Returns undefined (falling back to
 * splainer-search's empty-explain placeholder - doc.explain().children.length === 0 - which
 * the match-explain Stimulus controller (app/javascript/controllers/match_explain_controller.js)
 * renders as "no per-term score breakdown for doc" when a doc has no matchfeatures to show.
 */
export function matchFeaturesExplain(doc) {
  const matchFeatures = doc?.matchfeatures
  if (!matchFeatures || Object.keys(matchFeatures).length === 0) return undefined

  return {
    description: "sum of matched fields:",
    value: doc.fields ? doc.fields.score : undefined,
    details: Object.keys(matchFeatures).map((fieldName) => ({
      description: fieldName,
      value: matchFeatures[fieldName],
      details: []
    }))
  }
}

/**
 * Convert a splainer-search response into Quepid's rateable document shape.
 * Engine-specific explain extraction and the rateable-doc factory are injected
 * so this helper remains independent of application services.
 */
export function normalizeSearchResults({
  searcher,
  fieldSpec,
  extractors,
  createNormalDoc,
  createRateableDoc
}) {
  let normalized

  if (isEsLikeEngine(searcher.type)) {
    normalized = extractors.es(searcher.docs, fieldSpec)
  } else if (searcher.type === "solr") {
    normalized = extractors.solr(searcher.docs, fieldSpec, searcher.othersExplained)
  } else if (searcher.type === "searchapi") {
    normalized = searcher.docs.map((doc) =>
      createNormalDoc(fieldSpec, doc, matchFeaturesExplain(doc))
    )
  } else {
    normalized = searcher.docs.map((doc) => createNormalDoc(fieldSpec, doc))
  }

  return normalized.map(createRateableDoc)
}

export function buildSearchApiRatedDocsQueryParams(mapperCode, ratedIds, idField, evaluateMapper) {
  const mapper = evaluateMapper(mapperCode).ratedDocsQueryParamsMapper
  return typeof mapper === "function" ? mapper(ratedIds, idField) : null
}

export async function pAll(queue, requestsPerMinute) {
  const results = []
  let failed = false
  let firstError
  const run = async (index) => {
    try {
      results[index] = await queue[index]()
    } catch (error) {
      if (!failed) firstError = error
      failed = true
    }
  }

  if (requestsPerMinute && requestsPerMinute > 0) {
    const minDelayMs = 60000 / requestsPerMinute

    for (let index = 0; index < queue.length; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, minDelayMs))
      await run(index)
    }

    if (failed) throw firstError
    return results
  }

  const concurrency = 10
  let index = 0
  const worker = async () => {
    while (index < queue.length) {
      const currentIndex = index++
      await run(currentIndex)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  if (failed) throw firstError
  return results
}

/**
 * Run the case's live search-and-score batch without owning UI state.
 *
 * The callbacks deliberately keep Query construction, scoring, book sync, and
 * the read-model publication outside this orchestration seam. That keeps the
 * batch lifecycle independent from the Stimulus controllers.
 */
export function runSearchAll({
  queries,
  search,
  score,
  requestsPerMinute,
  scoreAll,
  syncToBook,
  onSearchStarted,
  onSearchCompleted,
  onSearchFailed,
  logger = console
}) {
  const searchPromises = []
  const generation = onSearchStarted?.()
  let failureReported = false

  const rejectAfterFailure = (error) => {
    if (!failureReported) {
      failureReported = true
      onSearchFailed?.(error, generation)
    }
    return Promise.reject(error)
  }

  const searchQueue = Object.values(queries).map((query) => () => {
    const searchPromise = search(query).then(() => {
      searchPromises.push(score(query))
    })

    searchPromise.catch(() => undefined)
    return searchPromise
  })

  if (requestsPerMinute > 0) {
    logger.info(`Rate limited to ${requestsPerMinute} requests per minute.`)
  }

  return pAll(searchQueue, requestsPerMinute)
    .then(() => Promise.all(searchPromises), rejectAfterFailure)
    .then(() => scoreAll(), rejectAfterFailure)
    .then(async (scoreInfo) => {
      try {
        await syncToBook()
      } catch (error) {
        return rejectAfterFailure(error)
      }

      onSearchCompleted?.(generation)
      return scoreInfo
    }, rejectAfterFailure)
}
