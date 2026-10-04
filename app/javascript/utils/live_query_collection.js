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
    if (Array.isArray(data.display_order)) {
      applyDisplayOrder(data.display_order)
    }

    ;(data.queries || []).forEach((queryWithRatings) => {
      if (queryWithRatings.deleted === "true") return

      const queryId = queryWithRatings.query_id
      const query = createQuery({ ...queryWithRatings, queryId })
      createDiff(query)
      registerQuery(queryId, query)
      newQueries.push(queryId)
    })

    replaceStore(caseId, data)
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

    fetchQueries(caseId)
      .then(
        (data) => {
          if (requestGeneration !== generation) {
            requestDeferred.reject({ status: 0, statusText: "Stale bootstrap request" })
            return data
          }

          clearQueries()
          addQueriesFromResponse(data, caseId)
          setBootstrapping(false)
          publishState()
          requestDeferred.resolve()
          return data
        },
        (response) => {
          if (requestGeneration !== generation) {
            requestDeferred.reject({ status: 0, statusText: "Stale bootstrap request" })
            return response
          }

          logger.debug?.("Failed to bootstrap queries: ", response)
          setBootstrapping(false)
          publishState()
          markStoreError(response)
          requestDeferred.reject(response)
          return response
        }
      )
      .catch((response) => {
        if (requestGeneration !== generation) {
          requestDeferred.reject({ status: 0, statusText: "Stale bootstrap request" })
          return response
        }
        logger.debug?.("Failed to bootstrap queries")
        setBootstrapping(false)
        publishState()
        // A handler above threw before settling; reject so callers waiting on
        // the bootstrap (and the searchable promise) don't hang forever.
        requestDeferred.reject(response)
        return response
      })

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
