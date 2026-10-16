import { isEsLikeEngine } from "utils/search_engines"
import { isSameId } from "utils/record_identity"

/**
 * Live query/search lifecycle with injected searcher construction,
 * document factories, and publication callbacks.
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
  normalizeDocuments,
  createDocList,
  createRateableDoc = (doc) => doc,
  matchFeaturesExplain,
  setDocs,
  onError,
  parseError,
  publish,
  logger = console
}) {
  const runtime = {
    search() {
      const rejectPromise = (reason) => {
        const rejected = Promise.reject(reason)
        rejected.catch(() => undefined)
        return rejected
      }

      query.hasBeenScored = false
      query.searcher = createSearcher()

      if (!query.searcher) {
        const message =
          "No Search Endpoint configured. Please select a search endpoint in Settings."
        onError(message)
        return rejectPromise(message)
      }

      query.ratedSearcher = createSearcher({ filterToRated: true })
      let searchError

      return query.searcher
        .search()
        .then(
          () => undefined,
          (response) => {
            query.linkUrl = query.searcher.linkUrl || query.searcher.url
            setDocs([], 0)
            const message = parseError(response, query.linkUrl)
            onError(message)
            searchError = message
            return response
          }
        )
        .catch((response) => {
          logger.debug("Failed to load search results")
          return response
        })
        .then(() => {
          query.linkUrl = query.searcher.linkUrl || query.searcher.url

          if (query.searcher.inError) {
            setDocs([], 0)
            const message = "Please click browse to see the error"
            onError(message)
            return rejectPromise(searchError || message)
          }

          const error = setDocs(query.searcher.docs, query.searcher.numFound)
          if (error) {
            onError(error)
            return rejectPromise(error)
          }

          query.othersExplained = query.searcher.othersExplained
          if (searchError) return rejectPromise(searchError)
          return undefined
        })
    },

    refreshRatedDocs(pageSize) {
      if (query.ratingsPromise) return query.ratingsPromise

      const requestGeneration = query.ratingsGeneration
      const settings = copySettings(getSettings())

      if (pageSize) settings.numberOfRows = pageSize

      const resetRatedDocsToEmpty = () =>
        Promise.resolve().then(() => {
          query.ratedSearcher = null
          query.ratedDocs = []
          query.ratedDocsFound = 0
          query.ratingsReady = true
          publish(query)
          query.ratingsPromise = null
        })

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
          query.ratedDocsFound = query.ratedSearcher.numFound
          query.ratingsReady = true
          publish(query)
          query.ratingsPromise = null
        })
      }

      query.ratingsPromise = request.catch((error) => {
        query.ratingsPromise = null
        return Promise.reject(error)
      })
      return query.ratingsPromise
    },

    paginate() {
      if (query.searcher === null) return undefined

      const searcher = query.searcher.pager()
      query.searcher = searcher
      if (searcher === null) return undefined

      return searcher
        .search()
        .then(
          () => {
            const docList = createDocList(
              searcher.docs,
              getSettings().createFieldSpec(),
              query.ratingsStore,
              matchFeaturesExplain
            )
            query.docs = query.docs.concat(docList.list())
            publish(query)
          },
          (response) => {
            logger.debug("Failed to load search: ", response)
            return response
          }
        )
        .catch((response) => {
          logger.debug("Failed to load search")
          return response
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

export function createTargetedSearchAdapter({
  query,
  queryId,
  settings,
  selectedTry,
  supportedEngines,
  previewArgs,
  settingsWithTryOverrides,
  createSearcherFromSettings,
  normalizeDocExplains,
  searchApiRatedDocs,
  supportsRatedDocsLookup,
  ratingScale
}) {
  const adapter = {
    queryId,
    query,
    queryText: query.queryText,
    settings,
    engineName: selectedTry.mapperBasedSearchEngineName || settings.searchEngine,
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
    ratingScale: ratingScale || query.ratings?.scale || {}
  }

  adapter.initialQueryParams = () =>
    settings.searchEngine === "solr"
      ? ""
      : selectedTry.queryParams
        ? selectedTry.queryParams.replace(/#\$query##/g, () => query.queryText)
        : selectedTry.queryParams

  let solrFinderOffset = 0
  const solrJson =
    selectedTry.jsonQueryParams ??
    !Object.values(selectedTry.args || {}).every((value) => Array.isArray(value))
  const solrFinderRows = Number(
    (solrJson ? selectedTry.args?.limit : selectedTry.args?.rows) ?? settings.numberOfRows ?? 10
  )

  async function searchSolrFinder(offset) {
    const fieldSpec = settings.createFieldSpec()
    const args = structuredClone(selectedTry.args || {})
    if (solrJson) {
      args.params = { ...args.params, explainOther: [adapter.lastQuery] }
      args.offset = offset
    } else {
      args.explainOther = [adapter.lastQuery]
      args.start = [String(offset)]
    }
    const explanationSettings = settingsWithTryOverrides(settings, { args })
    const searcher = createSearcherFromSettings(explanationSettings, query)
    await searcher.search()

    // splainer's explainOther metadata search drops transport settings and
    // reads only classic rows/start. Build both requests through our factory.
    const documentSettings = settingsWithTryOverrides(settings, {
      jsonQueryParams: false,
      args: {
        q: [adapter.lastQuery],
        qf: [`${fieldSpec.title} ${fieldSpec.id}`],
        rows: [String(solrFinderRows)],
        start: [String(offset)]
      }
    })
    documentSettings.escapeQuery = false
    if (solrJson) documentSettings.apiMethod = "POST"
    const documents = createSearcherFromSettings(documentSettings, query)
    await documents.search()
    searcher.docs = documents.docs
    searcher.numFound = documents.numFound
    adapter.searcher = searcher
    adapter.numFound = searcher.numFound
    solrFinderOffset = offset
    return normalizeDocExplains(query, searcher, fieldSpec)
  }

  adapter.search = (queryParams) => {
    const fieldSpec = settings.createFieldSpec()
    adapter.defaultList = false
    adapter.searching = true
    if (settings.searchEngine === "solr") {
      adapter.lastQuery = queryParams
      adapter.parseError = false
      const offset = Number((solrJson ? selectedTry.args?.offset : selectedTry.args?.start) || 0)
      return searchSolrFinder(offset)
        .then((docs) => {
          adapter.docs = docs
          return adapter
        })
        .finally(() => {
          adapter.searching = false
        })
    }
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
    if (!adapter.usesQueryParamsEditor || ratedIds.length === 0) return Promise.resolve(adapter)

    adapter.searcher = createSearcherFromSettings(settings, query)
    if (!supportsRatedDocsLookup(selectedTry)) {
      adapter.ratedDocsLookupUnsupported = true
      adapter.numFound = 0
      return Promise.resolve(adapter)
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

    if (isEsLikeEngine(adapter.searcher.type)) {
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

    return Promise.resolve(adapter)
  }

  adapter.paginate = () => {
    if (!adapter.searcher) return Promise.resolve(adapter)
    adapter.paging = true

    if (adapter.defaultList && ["solr", "es", "os"].includes(adapter.searcher.type)) {
      const ratedFieldSpec = settings.createFieldSpec()
      adapter.searcher = createSearcherFromSettings(settings, query, { filterToRated: true })
      if (isEsLikeEngine(adapter.searcher.type)) {
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

    if (adapter.searcher.type === "solr") {
      const offset = solrFinderOffset + solrFinderRows
      if (offset >= adapter.numFound) {
        adapter.paging = false
        return Promise.resolve(adapter)
      }
      return searchSolrFinder(offset)
        .then((docs) => {
          adapter.docs = adapter.docs.concat(docs)
          return adapter
        })
        .finally(() => {
          adapter.paging = false
        })
    }

    adapter.searcher = adapter.searcher.pager()
    if (!adapter.searcher) {
      adapter.paging = false
      return Promise.resolve(adapter)
    }
    const fieldSpec = settings.createFieldSpec()
    return adapter.searcher.search().then(() => {
      adapter.numFound = adapter.searcher.numFound
      adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, fieldSpec))
      adapter.paging = false
      return adapter
    })
  }

  // Both resolve once the ratings store has applied the change, so callers
  // can re-render from the updated ratings rather than the pre-request state.
  adapter.rate = (docId, rating) => {
    const doc = adapter.docs.find((candidate) => isSameId(candidate.id, docId))
    if (!doc) return Promise.resolve(false)
    const request = rating == null ? doc.resetRating() : doc.rate(parseInt(rating, 10))
    return request.then(() => {
      query.touchModifiedAt()
      return true
    })
  }

  adapter.rateAll = (rating) => {
    if (adapter.docs.length === 0) return Promise.resolve(true)
    const ids = adapter.docs.map((doc) => doc.id)
    const request =
      rating == null
        ? adapter.docs[0].resetBulkRatings(ids)
        : adapter.docs[0].rateBulk(ids, parseInt(rating, 10))
    return request.then(() => {
      query.touchModifiedAt()
      return true
    })
  }

  return adapter
}
