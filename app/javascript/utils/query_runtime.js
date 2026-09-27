import { paginateQuery, runSearchAll, searchQuery } from "utils/query_service"

/**
 * Framework-free runtime for the live query/search result lifecycle.
 *
 * The Angular service supplies searcher construction, document factories, and
 * compatibility callbacks. Keeping those dependencies injected makes this
 * usable by the future case-workspace entry bundle without moving search or
 * scoring to the server.
 */
export function createQueryRuntime({
  query,
  getSettings,
  copySettings = (settings) => ({ ...settings }),
  createSearcher,
  createRatedSearcher,
  searchApiRatedDocs,
  supportsSearchApiRatedDocsLookup,
  ratedDocIds = (ratings) => Object.keys(ratings || {}),
  createSnapshotSearcher,
  normalizeDocuments,
  createDocList,
  createRateableDoc = (doc) => doc,
  matchFeaturesExplain,
  setDocs,
  onError,
  parseError,
  publish,
  promiseApi = Promise,
  logger = console
}) {
  const runtime = {
    search() {
      return searchQuery({
        query,
        createSearcher: () => createSearcher(),
        createRatedSearcher: () => createSearcher({ filterToRated: true }),
        setDocs,
        onError,
        parseError,
        logDebug: (...args) => logger.debug(...args),
        promiseApi
      })
    },

    searchFromSnapshot(snapshotId) {
      try {
        query.hasBeenScored = false
        query.searcher = createSnapshotSearcher(snapshotId)

        if (!query.searcher) {
          const message = `Snapshot not found: ${snapshotId}`
          onError(message)
          return promiseApi.reject(message)
        }

        return query.searcher.search().then(
          () => {
            query.linkUrl = query.searcher.linkUrl

            if (query.searcher.inError) {
              const message = query.searcher.searchError || "Error loading snapshot results"
              setDocs([], 0)
              onError(message)
              return promiseApi.reject(message)
            }

            const error = setDocs(query.searcher.docs, query.searcher.numFound)
            if (error) {
              onError(error)
              return promiseApi.reject(error)
            }

            return undefined
          },
          () => {
            const message = `Failed to load snapshot: ${snapshotId}`
            onError(message)
            return promiseApi.reject(message)
          }
        )
      } catch (error) {
        return promiseApi.reject(error)
      }
    },

    refreshRatedDocs(pageSize) {
      if (query.ratingsPromise) return query.ratingsPromise

      const requestGeneration = query.ratingsGeneration
      const settings = copySettings(getSettings())

      if (pageSize) settings.numberOfRows = pageSize

      const resetRatedDocsToEmpty = () => {
        query.ratedSearcher = null
        query.ratedDocs = []
        query.ratedDocsFound = 0
        query.ratingsReady = true
        publish(query)
        query.ratingsPromise = null
        return promiseApi.resolve()
      }

      const refreshSearchApiRatedDocs = () => {
        query.ratedDocsUnsupported = !supportsSearchApiRatedDocsLookup(settings.selectedTry)

        if (query.ratedDocsUnsupported) return resetRatedDocsToEmpty()

        const ratedIds = ratedDocIds(query.ratings).filter((id) => id.length > 0)
        if (ratedIds.length === 0) return resetRatedDocsToEmpty()

        return searchApiRatedDocs(settings, query, ratedIds).then((result) => {
          if (requestGeneration !== query.ratingsGeneration) {
            query.ratingsPromise = null
            return runtime.refreshRatedDocs(settings.numberOfRows)
          }

          if (result === null) {
            query.ratedDocsUnsupported = true
            return resetRatedDocsToEmpty()
          }

          query.ratedSearcher = result.searcher
          query.ratedUrl = result.searcher.linkUrl
          query.ratedDocs = result.docs.map(createRateableDoc)
          query.ratedDocsFound = result.searcher.numFound
          query.ratingsReady = true
          publish(query)
          query.ratingsPromise = null
        })
      }

      let request
      if (settings.searchEngine === "searchapi") {
        request = refreshSearchApiRatedDocs()
      } else {
        query.ratedSearcher = createRatedSearcher(settings)
        let ratedDocsStaging = []
        request = query.ratedSearcher.search().then(() => {
          if (requestGeneration !== query.ratingsGeneration) {
            query.ratingsPromise = null
            return runtime.refreshRatedDocs(pageSize)
          }

          query.ratedUrl = query.ratedSearcher.linkUrl
          const normalized = normalizeDocuments(query.ratedSearcher, settings.createFieldSpec())
          ratedDocsStaging = normalized.map(createRateableDoc)
          query.ratedDocs = ratedDocsStaging
          query.ratedDocsFound = normalized.length
          query.ratingsReady = true
          publish(query)
          query.ratingsPromise = null
        })
      }

      query.ratingsPromise = request.catch((error) => {
        query.ratingsPromise = null
        return promiseApi.reject(error)
      })
      return query.ratingsPromise
    },

    paginate() {
      if (query.searcher === null) return undefined

      return paginateQuery({
        searcher: query.searcher,
        pager: (searcher) => {
          query.searcher = searcher.pager()
          return query.searcher
        },
        search: (searcher) => searcher.search(),
        appendDocs: (searcher) => {
          const docList = createDocList(
            searcher.docs,
            getSettings().createFieldSpec(),
            query.ratingsStore,
            matchFeaturesExplain
          )
          query.docs = query.docs.concat(docList.list())
          publish(query)
        },
        logDebug: (...args) => logger.debug(...args)
      })
    },

    ratedPaginate() {
      if (query.ratedSearcher === null) return undefined

      query.ratedSearcher = query.ratedSearcher.pager()
      if (query.ratedSearcher === null) return undefined

      return query.ratedSearcher.search().then(() => {
        const docs = normalizeDocuments(query.ratedSearcher, getSettings().createFieldSpec())
        query.ratedDocs = query.ratedDocs.concat(docs)
        publish(query)
      })
    }
  }

  return runtime
}

/**
 * Framework-free orchestration for the case-wide search lifecycle.
 * Query objects and scoring remain injected so this preserves the current
 * browser-to-engine and client-side scoring behavior while removing the queue
 * policy from the Angular service.
 */
export function createSearchAllRuntime({
  queries,
  search,
  score,
  requestsPerMinute,
  scoreAll,
  syncToBook,
  onSearchStarted,
  onSearchCompleted,
  onSearchFailed,
  promiseApi = Promise,
  logger = console
}) {
  return {
    run() {
      return runSearchAll({
        queries,
        search,
        score,
        requestsPerMinute,
        scoreAll,
        syncToBook,
        onSearchStarted,
        onSearchCompleted,
        onSearchFailed,
        promiseApi,
        logger
      })
    }
  }
}

export function createTargetedSearchAdapter({
  query,
  queryId,
  settings,
  selectedTry,
  engineNames,
  supportedEngines,
  previewArgs,
  settingsWithTryOverrides,
  createSearcherFromSettings,
  normalizeDocExplains,
  searchApiRatedDocs,
  supportsRatedDocsLookup,
  promiseApi = Promise
}) {
  const adapter = {
    queryId,
    query,
    queryText: query.queryText,
    settings,
    engineName:
      engineNames[selectedTry.mapperBasedSearchEngineName || settings.searchEngine] ||
      selectedTry.mapperBasedSearchEngineName ||
      settings.searchEngine,
    usesQueryParamsEditor: supportedEngines.includes(settings.searchEngine),
    docs: [],
    searcher: null,
    defaultList: false,
    lastQuery: "",
    parseError: false,
    searching: false,
    paging: false,
    ratedDocsLookupUnsupported: false,
    totalRatings: 0,
    numFound: 0,
    ratingScale: query.ratings?.scale || {}
  }

  adapter.initialQueryParams = () =>
    selectedTry.queryParams
      ? selectedTry.queryParams.replace(/#\$query##/g, () => query.queryText)
      : selectedTry.queryParams

  adapter.search = (queryParams) => {
    const fieldSpec = settings.createFieldSpec()
    adapter.defaultList = false
    adapter.searching = true
    return previewArgs(selectedTry.tryNo, queryParams).then((resolvedArgs) => {
      adapter.searching = false
      adapter.lastQuery = queryParams
      if (resolvedArgs === null) {
        adapter.numFound = 0
        adapter.docs = []
        adapter.parseError = true
        return adapter
      }

      adapter.parseError = false
      const tempSettings = settingsWithTryOverrides(settings, {
        args: resolvedArgs,
        queryParams
      })
      adapter.searcher = createSearcherFromSettings(tempSettings, query)
      return adapter.searcher.search().then(() => {
        adapter.numFound = adapter.searcher.numFound
        adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec)
        return adapter
      })
    })
  }

  adapter.resetToRated = () => {
    adapter.docs = []
    adapter.lastQuery = ""
    adapter.parseError = false
    adapter.defaultList = true
    adapter.ratedDocsLookupUnsupported = false

    const fieldSpec = settings.createFieldSpec()
    const ratedIds = Object.keys(query.ratings || {}).filter((id) => id.length > 0)
    adapter.totalRatings = ratedIds.length
    adapter.numFound = ratedIds.length
    if (!adapter.usesQueryParamsEditor || ratedIds.length === 0) return promiseApi.resolve(adapter)

    adapter.searcher = createSearcherFromSettings(settings, query)
    if (!supportsRatedDocsLookup(selectedTry)) {
      adapter.ratedDocsLookupUnsupported = true
      adapter.numFound = 0
      return promiseApi.resolve(adapter)
    }

    if (adapter.searcher.type === "searchapi") {
      return searchApiRatedDocs(settings, query, ratedIds).then((result) => {
        if (result) {
          adapter.searcher = result.searcher
          adapter.docs = result.docs
        }
        return adapter
      })
    }

    if (adapter.searcher.type === "es" || adapter.searcher.type === "os") {
      const filter = { query: query.filterToRatings(settings, adapter.docs.length) }
      if (adapter.searcher.isTemplateCall(adapter.searcher.args)) {
        delete adapter.searcher.args.id
        delete adapter.searcher.args.params
        adapter.searcher.queryDsl = filter
        return adapter.searcher.search(filter).then(() => {
          adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec)
          return adapter
        })
      }
      adapter.searcher.queryDsl = filter
      return adapter.searcher.search().then(() => {
        adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec)
        return adapter
      })
    }

    if (adapter.searcher.type === "solr") {
      delete adapter.searcher.args.start
      return adapter.searcher
        .explainOther(query.filterToRatings(settings, adapter.docs.length), fieldSpec, "lucene")
        .then(() => {
          adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec)
          return adapter
        })
    }

    return promiseApi.resolve(adapter)
  }

  adapter.paginate = () => {
    if (!adapter.searcher) return promiseApi.resolve(adapter)
    adapter.paging = true

    if (adapter.defaultList && ["solr", "es", "os"].includes(adapter.searcher.type)) {
      const ratedFieldSpec = settings.createFieldSpec()
      adapter.searcher = createSearcherFromSettings(settings, query, { filterToRated: true })
      if (adapter.searcher.type === "es" || adapter.searcher.type === "os") {
        const ratedFilter = { query: query.filterToRatings(settings, adapter.docs.length) }
        if (adapter.searcher.isTemplateCall(adapter.searcher.args)) {
          delete adapter.searcher.args.id
          delete adapter.searcher.args.params
          adapter.searcher.queryDsl = ratedFilter
          return adapter.searcher.search(ratedFilter).then(() => {
            adapter.docs = adapter.docs.concat(
              normalizeDocExplains(query, adapter.searcher, ratedFieldSpec)
            )
            adapter.paging = false
            return adapter
          })
        }
        adapter.searcher.queryDsl = ratedFilter
        return adapter.searcher.search().then(() => {
          adapter.docs = adapter.docs.concat(
            normalizeDocExplains(query, adapter.searcher, ratedFieldSpec)
          )
          adapter.paging = false
          return adapter
        })
      }
      delete adapter.searcher.args.start
      return adapter.searcher
        .explainOther(
          query.filterToRatings(settings, adapter.docs.length),
          ratedFieldSpec,
          "lucene"
        )
        .then(() => {
          adapter.docs = adapter.docs.concat(
            normalizeDocExplains(query, adapter.searcher, ratedFieldSpec)
          )
          adapter.paging = false
          return adapter
        })
    }

    adapter.searcher = adapter.searcher.pager()
    if (!adapter.searcher) {
      adapter.paging = false
      return promiseApi.resolve(adapter)
    }
    return adapter.searcher.search().then(() => {
      const fieldSpec = settings.createFieldSpec()
      adapter.numFound = adapter.searcher.numFound
      adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, fieldSpec))
      adapter.paging = false
      return adapter
    })
  }

  adapter.rate = (docId, rating) => {
    const doc = adapter.docs.find((candidate) => String(candidate.id) === String(docId))
    if (!doc) return false
    if (rating == null) doc.resetRating()
    else doc.rate(parseInt(rating, 10))
    query.touchModifiedAt()
    return true
  }

  adapter.rateAll = (rating) => {
    if (adapter.docs.length === 0) return true
    const ids = adapter.docs.map((doc) => doc.id)
    if (rating == null) adapter.docs[0].resetBulkRatings(ids)
    else adapter.docs[0].rateBulk(ids, parseInt(rating, 10))
    query.touchModifiedAt()
    return true
  }

  return adapter
}
