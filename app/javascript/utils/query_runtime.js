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
  createSearcher,
  createSnapshotSearcher,
  normalizeDocuments,
  createDocList,
  matchFeaturesExplain,
  setDocs,
  onError,
  parseError,
  publish,
  promiseApi = Promise,
  logger = console
}) {
  return {
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
          }, () => {
            const message = `Failed to load snapshot: ${snapshotId}`
            onError(message)
            return promiseApi.reject(message)
          }
        )
      } catch (error) {
        return promiseApi.reject(error)
      }
    },

    paginate() {
      if (query.searcher === null) return undefined

      return paginateQuery({
        searcher: query.searcher,
        pager: searcher => {
          query.searcher = searcher.pager()
          return query.searcher
        },
        search: searcher => searcher.search(),
        appendDocs: searcher => {
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
}
