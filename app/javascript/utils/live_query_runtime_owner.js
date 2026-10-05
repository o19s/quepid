import { isEsLikeEngine } from "utils/search_engines"
import {
  buildRatedDocsFilter,
  ratedDocIds,
  supportsRatedDocsLookup,
  supportsSearchApiRatedDocsLookup
} from "utils/rated_docs"
import { RatingsStore } from "utils/ratings_store"
import { createSnapshotSearcherFromRegistry } from "utils/snapshot_searcher"
import { parseResponseObject } from "utils/search_error"
import { createCaseScoringRuntime, scoreQuery } from "utils/query_scoring"
import { createQueryRuntime, createTargetedSearchAdapter } from "utils/query_runtime"
import { createQueryDiff } from "utils/diff_results"
import { createQueryModel } from "utils/query_model"
import { createBookSyncRuntime } from "utils/book_sync"
import { buildQueryDocumentsState } from "utils/query_documents"
import { createLiveQueryCollectionRuntime } from "utils/live_query_collection"
import { createLiveQueryDocumentsRuntime } from "utils/live_query_documents"
import { createLiveQueryFactory } from "utils/live_query_factory"
import { createLiveQueryCommandsRuntime } from "utils/live_query_commands"
import { createLiveQueryEventsRuntime } from "utils/live_query_events"
import { createLiveQueryLifecycleRuntime } from "utils/live_query_lifecycle"
import { buildDiffReadModel, createDocList, documentUrlFor } from "utils/live_query_read_models"
import {
  invalidateRatedDocsCache,
  orderedQueries,
  queryLifecycleState,
  ratingChangedQueryId
} from "utils/query_state"
import { fetchQueries } from "utils/query_lifecycle"
import { caseRuntime } from "utils/case_runtime"
import coreFlash from "utils/core_flash"
import { errorMessage } from "utils/error_message"
import { isSameId } from "utils/record_identity"
import {
  buildSearchApiRatedDocsQueryParams as buildSearchApiRatedDocsQueryParamsFor,
  createSearcherFromSettings as createSearcherFor,
  evaluateMapperFunctions as evaluateMapperFunctionsFor,
  matchFeaturesExplain,
  normalizeSearchResults,
  runSearchAll,
  settingsWithTryOverrides
} from "utils/query_service"

function copySettings(value) {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(copySettings)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copySettings(entry)]))
}

/**
 * Creates the live-query runtime from explicit dependencies and returns its capabilities.
 * The bootstrap boundary supplies the framework (scheduling, logging), the case
 * domain (settings, scorer, navigation), splainer-search, and the stores.
 *
 * Runtimes are built in dependency order. Closures that reach a runtime built
 * further down (`liveQueryCommandsRuntime`) only run after construction
 * finishes.
 */
export function createLiveQueryRuntimeOwner({
  framework,
  domain,
  splainerSearch,
  snapshotRegistry,
  store,
  eventTarget = document
}) {
  const { searchSvc, normalDocsSvc, esExplainExtractorSvc, solrExplainExtractorSvc } =
    splainerSearch
  const logger = framework.logger

  let caseNo = -1
  let currSettings = {}
  let showOnlyRated = false
  let isBootstrapping = false
  let displayOrder = []

  // Keyed by the mapper_code string itself, so a re-eval is only ever skipped for the
  // exact same code (editing a mapper - or switching to a different mapper-based try -
  // naturally busts the cache via a different key). See evaluateMapperFunctions() below.
  const mapperFunctionsCache = {}

  // The collection store owns the live Query objects, their snapshots, and
  // display order.
  const queryCollectionStore = store && store.queries
  const queryDocumentsStore = store && store.documents
  const diffStateStore = store && store.diff
  const bookSyncRuntime = createBookSyncRuntime({ logger })

  const getCaseNo = () => caseNo
  const getShowOnlyRated = () => showOnlyRated
  const getLiveQueries = () => queryCollectionStore.liveQueries()
  const getLiveQuery = (queryId) => queryCollectionStore.liveQuery(queryId)
  const getFieldSpec = () => currSettings.createFieldSpec()
  const getDiffSettings = () => (diffStateStore ? diffStateStore.selections() : [])
  const createNormalDoc = (spec, doc, explain) => normalDocsSvc.createNormalDoc(spec, doc, explain)
  const createRateableDoc = (query, doc) => query.ratingsStore.createRateableDoc(doc)

  function clearLiveQueries({ resetStore = false } = {}) {
    queryCollectionStore.clearLiveQueries()
    if (resetStore) queryCollectionStore.reset()
  }

  function registerQuery(queryId, query, { publish = true } = {}) {
    queryCollectionStore.upsert(query, { publish })
    return query
  }

  function removeQuery(queryId) {
    if (!getLiveQuery(queryId)) return false
    queryCollectionStore.remove(queryId)
    return true
  }

  function createDocListFor(docs, fieldSpec, ratingsStore, explain) {
    return createDocList({ docs, fieldSpec, ratingsStore, explain, createNormalDoc })
  }

  function normalizeDocuments(query, searcher, fieldSpec) {
    return normalizeSearchResults({
      searcher,
      fieldSpec,
      extractors: {
        es: (docs, spec) => esExplainExtractorSvc.docsWithExplainOther(docs, spec),
        solr: (docs, spec, othersExplained) =>
          solrExplainExtractorSvc.docsWithExplainOther(docs, spec, othersExplained)
      },
      createNormalDoc,
      createRateableDoc: (doc) => createRateableDoc(query, doc)
    })
  }

  function markRatingChanged(queryId) {
    store.scoring.markRatingChanged(queryId)
  }

  // Explicit adapter for the Stimulus query list. The runtime retains the live
  // Query objects, but the list no longer discovers them through a
  // compiled controller scope.
  function publishQueryListState() {
    document.dispatchEvent(new CustomEvent("queries-state:changed"))
  }

  const caseScoringRuntime = createCaseScoringRuntime({
    getScorables: getLiveQueries,
    logger: console,
    onComplete: function (scoreInfo, metadata) {
      // The score store replaces its complete query-score map. Partial
      // scoring (for example diff-only scoring) must not erase live
      // query badges from the store.
      if (metadata.isFullScoreAll) {
        store.scoring.setLatestScoreInfo(scoreInfo)
      }

      publishQueryListState()
    }
  })
  const scoreAll = (scorables) => caseScoringRuntime.scoreAll(scorables)

  const liveQueryDocumentsRuntime = createLiveQueryDocumentsRuntime({
    getFieldSpec,
    createDocList: createDocListFor,
    matchFeaturesExplain,
    publish: publishQueryDocuments
  })

  // A query's search runtime, bound to that query and the current settings.
  function runtimeFor(query) {
    return createQueryRuntime({
      query,
      getSettings: () => currSettings,
      copySettings,
      createSearcher: (options) => createSearcherFromSettings(currSettings, query, options),
      createRatedSearcher: (settings) =>
        createSearcherFromSettings(settings, query, { filterToRated: true }),
      searchApiRatedDocs,
      supportsSearchApiRatedDocsLookup,
      normalizeDocuments: (searcher, fieldSpec) => normalizeDocuments(query, searcher, fieldSpec),
      createDocList: createDocListFor,
      createRateableDoc: (doc) => createRateableDoc(query, doc),
      matchFeaturesExplain,
      setDocs: (docs, numFound) => liveQueryDocumentsRuntime.setDocs(query, docs, numFound),
      onError: (message) => liveQueryDocumentsRuntime.setError(query, message),
      parseError: (response, linkUrl) =>
        parseResponseObject(response, linkUrl, currSettings.searchEngine),
      publish: publishQueryDocuments,
      logger
    })
  }

  const liveQueryFactory = createLiveQueryFactory({
    getCaseNo,
    getShowOnlyRated,
    RatingsStore,
    onRatingChanged: markRatingChanged,
    getQueryState: (query) =>
      queryLifecycleState({
        errorText: query.errorText,
        resultsReturned: query.resultsReturned,
        docCount: query.docs.length
      }),
    createModel: ({ query, ratingsStore, getQueryState }) =>
      createQueryModel({
        query,
        ratingsStore,
        getDefaultScorer: () => domain.scorer.getDefault(),
        scoreQuery,
        getFieldSpec,
        getQueryState,
        buildRatingsFilter: buildRatedDocsFilter,
        ratedDocIds,
        publish: publishQueryDocuments
      })
  })

  const liveQueryCollectionRuntime = createLiveQueryCollectionRuntime({
    fetchQueries,
    createQuery: (queryData) => liveQueryFactory.create(queryData),
    createDiff,
    clearQueries: () => clearLiveQueries(),
    registerQuery: (queryId, query) => registerQuery(queryId, query, { publish: false }),
    applyDisplayOrder,
    replaceStore: (collectionCaseId, data) =>
      queryCollectionStore.replaceFromResponse(collectionCaseId, data),
    beginStoreBootstrap: (caseId) => queryCollectionStore.beginBootstrap(caseId),
    markStoreError: (response) => queryCollectionStore.markError(response),
    setBootstrapping: (value) => {
      isBootstrapping = value
    },
    publishState: publishQueryListState,
    logger
  })

  const liveQueryCommandsRuntime = createLiveQueryCommandsRuntime({
    getQuery: getLiveQuery,
    getShowOnlyRated,
    runtimeFor,
    schedule: framework.schedule
  })

  const liveQueryLifecycleRuntime = createLiveQueryLifecycleRuntime({
    createQuery,
    reset,
    bootstrapQueries: liveQueryCollectionRuntime.bootstrapQueries,
    searchAll,
    clearQueries: () => clearLiveQueries({ resetStore: true }),
    addQueriesFromResponse: liveQueryCollectionRuntime.addQueriesFromResponse,
    getCaseNo,
    applyDisplayOrder,
    setQueryId: (query, queryId) => query.ratingsStore.setQueryId(queryId),
    registerQuery,
    removeQuery,
    searchAndScore,
    updateScores,
    logger
  })

  createLiveQueryEventsRuntime({
    eventTarget,
    scoringStore: store.scoring,
    getCaseNo,
    getQuery: getLiveQuery,
    getQueries: getLiveQueries,
    ratingChangedQueryId,
    invalidateRatedDocs: invalidateRatedDocsCache,
    publishQuery: publishQueryDocuments,
    scoreAll: () => scoreAll(),
    updateScores,
    setQueryOptions: (query, options) => {
      query.options = options
      query.setDirty()
    },
    setScorer: (scorerData) => domain.scorer.select(scorerData),
    reloadQueries: liveQueryLifecycleRuntime.refreshQueries,
    configureBook: ({ bookId, autoPopulate }) => {
      bookSyncRuntime.configure({ caseId: getCaseNo(), bookId, autoPopulate })
    },
    schedule: framework.schedule,
    onError: (message, error) => {
      console.error(`live-query-events: ${message}`, error)
      coreFlash.show("error", `${message}: ${errorMessage(error, "unexpected error")}`)
    }
  }).connect()

  function reset() {
    clearLiveQueries({ resetStore: true })
    showOnlyRated = false
    isBootstrapping = false
    if (queryDocumentsStore) {
      queryDocumentsStore.reset()
    }
    bookSyncRuntime.reset()
    publishQueryListState()
  }

  // Rating scale for a query's rating controls: the query's own scale, else its scorer's colors.
  function resolveQueryRatingScale(query) {
    let ratingScale = query.ratings && query.ratings.scale
    if (!ratingScale) {
      const effectiveScorer =
        typeof query.effectiveScorer === "function" ? query.effectiveScorer() : null
      if (effectiveScorer && typeof effectiveScorer.getColors === "function") {
        ratingScale = effectiveScorer.getColors()
      }
    }
    return ratingScale
  }

  // Temporary store-transition publisher: the runtime keeps the live Query objects, but
  // Stimulus receives a plain read model for expanded result rendering.
  function publishQueryDocuments(query) {
    if (!queryDocumentsStore || !query) {
      return
    }

    const ratingScale = resolveQueryRatingScale(query)
    const applicableSettings = domain.settings.applicable() || {}
    const readModel = buildQueryDocumentsState({
      query: query,
      settings: applicableSettings,
      selectedTry: applicableSettings.selectedTry || {},
      ratingScale: ratingScale || {},
      diffs: buildDiffReadModel(query, { showOnlyRated }),
      documentUrlFor: function (doc) {
        return documentUrlFor(doc, {
          settings: applicableSettings,
          proxyUrlFor: (searchEndpointId) => domain.navigation.proxyUrlFor(searchEndpointId)
        })
      }
    })
    queryDocumentsStore.replaceQuery(query.queryId, readModel)
    queryCollectionStore.upsert(query)
  }

  // Explicit command adapter for the Stimulus expanded-results renderer.
  // Query objects remain owned by the runtime, but the renderer does not discover
  // them through a compiled controller.
  function toggleQuery(queryId) {
    const query = getLiveQuery(queryId)
    if (!query) return false

    const currentQuery = queryCollectionStore.query(queryId)
    const expanded = !(currentQuery && currentQuery.expanded === true)
    queryCollectionStore.setExpanded(queryId, expanded)
    if (queryDocumentsStore) {
      queryDocumentsStore.updateQueryState(queryId, {
        expanded: expanded
      })
    }
    return true
  }

  /**
   * mapper_code (a try's JS source defining numberOfResultsMapper/docsMapper/
   * nextPageArgsMapper/ratedDocsQueryParamsMapper - see
   * db/mapper_based_search_engines/vespa.js) gets evaluated from two separate call sites
   * (createSearcherFromSettings below, and buildSearchApiRatedDocsQueryParams) that often
   * run back-to-back for the same try. Caching by the mapper_code string itself avoids
   * redundant `new Function` eval + window-global churn on every search/page/rated-lookup.
   *
   * The eval technique itself (Function constructor, called against `window`) only works
   * because mapper_code assigns to bare identifiers (`docsMapper = function...`, no `var`),
   * which in non-strict, non-module code are just `window.docsMapper` - so a mapper that
   * doesn't define one of these four functions would otherwise silently inherit whatever a
   * PREVIOUS, unrelated try's mapper_code last left on window. Clearing all four before
   * each eval (only reached on a cache miss) avoids that cross-contamination.
   */
  function evaluateMapperFunctions(mapperCode) {
    return evaluateMapperFunctionsFor(mapperCode, mapperFunctionsCache, window)
  }

  /**
   * Builds a splainer-search Searcher from the active try's settings and a `Query`, including
   * engine-specific behavior (proxy URL, static engine, searchapi mapper functions, rated-doc filters).
   */
  function createSearcherFromSettings(settings, query, options = {}) {
    return createSearcherFor({
      settings,
      query,
      options,
      proxyUrl:
        settings?.proxyRequests === true
          ? domain.navigation.proxyUrlFor(settings.searchEndpointId)
          : undefined,
      isEsOrOs: isEsLikeEngine(settings?.searchEngine),
      evaluateMapper: evaluateMapperFunctions,
      createSearcher: (...args) => searchSvc.createSearcher(...args)
    })
  }

  function createSearcherFromSnapshot(snapshotId, query, settings) {
    return createSnapshotSearcherFromRegistry({
      snapshotId: snapshotId,
      snapshots: snapshotRegistry,
      query: query,
      settings: settings,
      createRateableDoc: (doc) => createRateableDoc(query, doc),
      explainDoc: (doc) => normalDocsSvc.explainDoc(doc),
      log: logger.error
    })
  }

  /**
   * Shared "look up already-rated docs via the mapper" pipeline for a searchapi/mapper-based
   * engine - used by both docFinder.js's "Already Rated Documents" section and
   * the query runtime (Query's "Show only rated" toggle), which otherwise
   * duplicated this same build-query-params -> previewArgs -> search -> normalize sequence.
   *
   * There is no generic "just these doc IDs" query syntax for a searchapi engine (unlike
   * Solr's {!terms f=id} or ES's terms query), so the try's mapper_code builds it: if it
   * defines ratedDocsQueryParamsMapper(ratedIds, idField) (see
   * db/mapper_based_search_engines/vespa.js), that returns the query_params string. idField
   * is the case's own id field (fieldSpec.id), passed through since it's schema-specific and
   * user-editable per case.
   *
   * Callers are expected to have already checked supportsSearchApiRatedDocsLookup(); this
   * resolves to null when the mapper doesn't build a query (or previewArgs can't resolve it),
   * which callers should treat as "can't show rated docs, disable/message accordingly."
   */
  function searchApiRatedDocs(settings, query, ratedIds) {
    const ratedQueryParams = buildSearchApiRatedDocsQueryParamsFor(
      settings.selectedTry.mapperCode,
      ratedIds,
      settings.createFieldSpec().id,
      evaluateMapperFunctions
    )

    if (!ratedQueryParams) {
      return Promise.resolve(null)
    }

    return domain.settings
      .previewArgs(settings.selectedTry.tryNo, ratedQueryParams)
      .then(function (resolvedArgs) {
        if (resolvedArgs === null) {
          return null
        }

        const tempSettings = settingsWithTryOverrides(settings, { args: resolvedArgs })

        // Force POST regardless of the try's own apiMethod (which may be 'AUTO' for a
        // mapper-based search engine) - a rated-docs ID filter can grow arbitrarily long as
        // more docs get rated, so this always sends it as a body rather than gambling on it
        // fitting in a GET querystring.
        const searcher = createSearcherFromSettings(tempSettings, query, { forceApiMethod: "POST" })

        return searcher.search().then(function () {
          const normed = normalizeDocuments(query, searcher, settings.createFieldSpec())
          return { searcher: searcher, docs: normed }
        })
      })
  }

  function toggleShowOnlyRated() {
    showOnlyRated = !showOnlyRated

    if (queryDocumentsStore) {
      queryDocumentsStore.setShowOnlyRated(showOnlyRated)
    }

    if (showOnlyRated) {
      Object.values(getLiveQueries()).forEach(function (query) {
        if (!query.ratingsReady) {
          queryCapabilities.refreshRatedDocs(query.queryId)
        }
      })
    }
    publishQueryListState()
  }

  // Progress for the "Updating Queries" banner. A query whose search failed is
  // never scored, so it counts as settled once it has an error; otherwise the
  // banner would stall until a later search succeeds. Starting a search clears
  // both `hasBeenScored` and `errorText`, so a rerun counts as pending again.
  function isQuerySettled(query) {
    return query.hasBeenScored || Boolean(query.errorText)
  }

  function hasPendingQueries() {
    return Object.values(getLiveQueries()).some((q) => !isQuerySettled(q))
  }

  function settledQueryCount() {
    return Object.values(getLiveQueries()).filter(isQuerySettled).length
  }

  function queryCount() {
    if (queryCollectionStore.status !== "idle") {
      return queryCollectionStore.size
    }
    return Object.keys(getLiveQueries()).length
  }

  // Clears the query's previous results before a fresh search.
  function resetQuery(query) {
    liveQueryDocumentsRuntime.reset(query)
    liveQueryDocumentsRuntime.publish(query)
  }

  function searchAndScore(query) {
    resetQuery(query)
    return runtimeFor(query)
      .search()
      .then(() => query.score())
      .then(() => bookSyncRuntime.sync(queryArray()))
  }

  function searchAll() {
    const searchAllPromise = runSearchAll({
      queries: getLiveQueries(),
      search: (query) => {
        resetQuery(query)
        return runtimeFor(query).search()
      },
      score: (query) => query.score(),
      requestsPerMinute: currSettings.selectedTry.requestsPerMinute,
      scoreAll: () => scoreAll(),
      syncToBook: () => bookSyncRuntime.sync(queryArray()),
      onSearchStarted: () => queryCollectionStore.beginSearch(),
      onSearchCompleted: (generation) => queryCollectionStore.finishSearch(generation),
      onSearchFailed: (error, generation) => queryCollectionStore.failSearch(error, generation),
      logger
    })
    searchAllPromise.catch(() => {})
    return searchAllPromise
  }

  function createDiff(query) {
    return createQueryDiff({
      query,
      diffSettings: getDiffSettings(),
      settings: domain.settings.editable(),
      createSearcherFromSnapshot
    })
  }

  function refreshAllDiffs() {
    const notify = (detail) =>
      document.dispatchEvent(new CustomEvent("query-diffs:refreshed", { detail }))
    const refreshes = Object.values(getLiveQueries()).map((query) => {
      const refresh = createDiff(query)
      publishQueryDocuments(query)
      return refresh
    })

    return Promise.all(refreshes).then(
      () => {
        Object.values(getLiveQueries()).forEach((query) => publishQueryDocuments(query))
        notify({ success: true })
      },
      (error) => {
        notify({ success: false })
        return Promise.reject(error)
      }
    )
  }

  function createQuery(queryText) {
    const newQuery = liveQueryFactory.create({ query_text: queryText, queryId: -1 })
    createDiff(newQuery)
    return newQuery
  }

  // get the full list of queries sorted by create/manual order
  // only call this when our version() changes
  function queryArray() {
    if (queryCollectionStore.status === "ready") {
      // Keep the existing defaultCaseOrder contract while taking the order
      // itself from the store. The existing orderBy contract and any other
      // consumers still rely on this field being refreshed on each read.
      return orderedQueries(queryCollectionStore.orderedQueryIds(), getLiveQueries())
    }
    return orderedQueries(displayOrder, getLiveQueries())
  }

  // Temporary adapter for the Stimulus reorder controller. The controller
  // owns the PUT; the runtime keeps the live display order in sync until the
  // query store becomes authoritative.
  function applyDisplayOrder(nextDisplayOrder) {
    displayOrder = nextDisplayOrder
    queryCollectionStore.setDisplayOrder(nextDisplayOrder)
  }

  function updateScores() {
    Object.values(getLiveQueries()).forEach((query) => query.setDirty())
    return Promise.resolve(scoreAll())
  }

  function configureBook(newCaseNo) {
    const selected = caseRuntime.selected()
    if (!isSameId(selected?.caseNo, newCaseNo)) return
    bookSyncRuntime.configure({
      caseId: newCaseNo,
      bookId: selected.bookId,
      autoPopulate: selected.autoPopulateBookPairs
    })
  }

  function changeSettings(newCaseNo, newSettings) {
    currSettings = newSettings

    if (!isSameId(caseNo, newCaseNo)) {
      domain.scorer.bootstrap(newCaseNo)
      // A failure reaches the caller through searchablePromise(), returned
      // below; this copy is only silenced so it isn't reported as an
      // unhandled rejection.
      liveQueryCollectionRuntime.bootstrapQueries(newCaseNo).catch(() => {})
      configureBook(newCaseNo)
    } else {
      Object.values(getLiveQueries()).forEach((query) => {
        if (query.diff !== null) query.diff.fetch()
      })
      liveQueryCollectionRuntime.resolveSearchPromise()
    }

    caseNo = newCaseNo
    return liveQueryCollectionRuntime.searchablePromise()
  }

  const queryCapabilities = {
    getListState: function () {
      const selectedTry = domain.settings.applicable() || {}
      return {
        canAddQueries: selectedTry.searchEngine !== "static",
        addQueryMessage:
          selectedTry.searchEngine === "static"
            ? "Adding queries is not supported"
            : "Add a query to this case",
        showOnlyRated,
        // Match the query-list controller's showOnlyRatedUnsupported state: while the case is
        // still loading, no selected try means the capability is unknown,
        // not unsupported.
        showOnlyRatedUnsupported: domain.settings.isTrySelected()
          ? !supportsRatedDocsLookup(selectedTry)
          : false,
        isBootstrapping,
        searching: hasPendingQueries(),
        batchPosition: settledQueryCount(),
        batchSize: queryCount()
      }
    },
    setDisplayOrder: applyDisplayOrder,
    getQuery: getLiveQuery,
    getQueries: getLiveQueries,
    getCaseNo,
    resetQueryState: reset,
    resetSearchPromise: liveQueryCollectionRuntime.resetSearchPromise,
    getQueryArray: queryArray,
    changeSettings,
    refreshRatedDocs: liveQueryCommandsRuntime.refreshRatedDocs,
    reconcileQueryRemoval: function (queryId, rescore) {
      if (queryId === undefined || queryId === null) return false
      return liveQueryLifecycleRuntime.reconcileQueryRemoval(queryId, rescore)
    },
    // Scheduled so a diff refresh never runs inside the caller's own update.
    refreshAllDiffs: function () {
      return new Promise(function (resolve, reject) {
        framework.schedule(function () {
          refreshAllDiffs().then(resolve, reject)
        })
      })
    }
  }
  const queryCommands = {
    rateDocument: liveQueryCommandsRuntime.rateDocument,
    rateAll: liveQueryCommandsRuntime.rateAll,
    toggleQuery,
    paginateQuery: liveQueryCommandsRuntime.paginateQuery,
    toggleShowOnlyRated,
    searchAll,
    collapseAll: function () {
      if (queryDocumentsStore) queryDocumentsStore.collapseAll()
    }
  }
  const queryLifecycle = {
    prepareQueries: liveQueryLifecycleRuntime.prepareQueries,
    commitQueries: liveQueryLifecycleRuntime.commitQueries,
    commitPersistedQueries: liveQueryLifecycleRuntime.commitPersistedQueries,
    refreshQueries: liveQueryLifecycleRuntime.refreshQueries
  }
  function targetedSearch(queryId) {
    const query = getLiveQuery(queryId)
    if (!query) return null

    const settings = domain.settings.editable()
    return createTargetedSearchAdapter({
      query: query,
      queryId: queryId,
      settings: settings,
      selectedTry: settings.selectedTry,
      supportedEngines: ["solr", "es", "os", "searchapi"],
      previewArgs: function (tryNo, queryParams) {
        return domain.settings.previewArgs(tryNo, queryParams)
      },
      settingsWithTryOverrides: settingsWithTryOverrides,
      createSearcherFromSettings: createSearcherFromSettings,
      normalizeDocExplains: normalizeDocuments,
      searchApiRatedDocs: searchApiRatedDocs,
      supportsRatedDocsLookup: supportsRatedDocsLookup,
      ratingScale: resolveQueryRatingScale(query)
    })
  }

  return { queryCapabilities, queryCommands, queryLifecycle, targetedSearch }
}
