function createSearchPromise() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/**
 * Orchestration for the live query collection boundary.
 *
 * The service graph provides the live Query implementation and query loader, but
 * collection bootstrap, stale-request handling, and store publication live in
 * this runtime so they remain independent from transport details.
 */
export function createLiveQueryCollectionRuntime({
  fetchQueries,
  createQuery,
  createDiff,
  clearQueries,
  registerQuery,
  applyDisplayOrder = () => {},
  replaceStore,
  beginStoreBootstrap,
  markStoreError,
  setBootstrapping,
  publishState,
  logger = console
}) {
  let generation = 0
  let searchableDeferred = createSearchPromise()

  function addQueriesFromResponse(data = {}, caseId) {
    const newQueries = []
    const liveQueries = []
    if (Array.isArray(data.display_order)) {
      applyDisplayOrder(data.display_order)
    }

    ;(data.queries || []).forEach((queryWithRatings) => {
      if (queryWithRatings.deleted === "true" || queryWithRatings.deleted === true) return

      const query = createQuery(queryWithRatings)
      const queryId = query.queryId
      createDiff(query)
      registerQuery(queryId, query)
      newQueries.push(queryId)
      liveQueries.push(query)
    })

    replaceStore({ caseId, displayOrder: data.display_order, queries: liveQueries })
    return newQueries
  }

  function resetSearchPromise() {
    logger.debug?.("PROMISE reset...")
    searchableDeferred = createSearchPromise()
  }

  function bootstrapQueries(caseId) {
    const requestGeneration = ++generation
    setBootstrapping(true)
    publishState()
    beginStoreBootstrap(caseId)

    const requestDeferred = createSearchPromise()
    searchableDeferred = requestDeferred

    function rejectStaleRequest() {
      if (requestGeneration === generation) return false
      requestDeferred.reject({ status: 0, statusText: "Stale bootstrap request" })
      return true
    }

    function settle(callback) {
      if (rejectStaleRequest()) return
      setBootstrapping(false)
      publishState()
      callback()
    }

    fetchQueries(caseId)
      .then(
        (data) => {
          if (rejectStaleRequest()) return
          clearQueries()
          addQueriesFromResponse(data, caseId)
          settle(() => requestDeferred.resolve())
        },
        (response) =>
          settle(() => {
            logger.debug?.("Failed to bootstrap queries: ", response)
            markStoreError(response)
            requestDeferred.reject(response)
          })
      )
      .catch((response) =>
        settle(() => {
          logger.debug?.("Failed to bootstrap queries")
          // A response handler threw; settle both bootstrap and searchable callers.
          requestDeferred.reject(response)
        })
      )

    return requestDeferred.promise
  }

  return {
    addQueriesFromResponse,
    bootstrapQueries,
    resetSearchPromise,
    resolveSearchPromise: () => searchableDeferred.resolve(),
    searchablePromise: () => searchableDeferred.promise
  }
}
