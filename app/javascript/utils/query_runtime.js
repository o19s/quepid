import { paginateQuery, searchQuery } from "utils/query_service"

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
        query.ratedDocsUnsupported = !supportsSearchApiRatedDocsLookup(
          settings.selectedTry
        )

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
          const normalized = normalizeDocuments(
            query.ratedSearcher,
            settings.createFieldSpec()
          )
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
