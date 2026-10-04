import { createSearchAllRuntime } from "utils/query_runtime"

/**
 * Transport orchestration for live queries.
 *
 * Searchers and Query objects remain injected adapters while this runtime owns
 * the single-query and batch search policy. That keeps persistence commits and
 * search execution on the same seam during the store transition.
 */
export function createLiveQueryTransportRuntime({
  runtimeFor,
  getQueries,
  getRequestsPerMinute,
  resetQuery = () => {},
  scoreAll,
  syncToBook,
  onSearchStarted,
  onSearchCompleted,
  onSearchFailed,
  logger = console
}) {
  function searchAndScore(query) {
    resetQuery(query)
    return runtimeFor(query)
      .search()
      .then(() => query.score())
      .then(() => syncToBook())
  }

  function searchAll() {
    return createSearchAllRuntime({
      queries: getQueries(),
      search: (query) => {
        resetQuery(query)
        return runtimeFor(query).search()
      },
      score: (query) => query.score(),
      requestsPerMinute: getRequestsPerMinute(),
      scoreAll,
      syncToBook,
      onSearchStarted,
      onSearchCompleted,
      onSearchFailed,
      logger
    }).run()
  }

  return { searchAndScore, searchAll }
}
