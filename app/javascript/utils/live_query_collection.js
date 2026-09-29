/**
 * Orchestration for the live query collection boundary.
 *
 * The service graph provides the live Query implementation and HTTP adapter, but
 * collection bootstrap, stale-request handling, and store publication live in
 * this runtime so they remain independent from transport details.
 */
export function createLiveQueryCollectionRuntime({
  request,
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
  onVersion,
  defer,
  logger = console
}) {
  let generation = 0
  let searchableDeferred = defer()

  function addQueriesFromResponse(data = {}, caseId) {
    const newQueries = []
    if (Array.isArray(data.display_order)) {
      applyDisplayOrder(data.display_order)
    } else {
      onVersion()
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
    searchableDeferred = defer()
  }

  function bootstrapQueries(caseId) {
    const requestGeneration = ++generation
    setBootstrapping(true)
    publishState()
    beginStoreBootstrap(caseId)

    const requestDeferred = defer()
    searchableDeferred = requestDeferred

    request(caseId)
      .then(
        (response) => {
          if (requestGeneration !== generation) {
            requestDeferred.reject({ status: 0, statusText: "Stale bootstrap request" })
            return response
          }

          clearQueries()
          addQueriesFromResponse(response.data, caseId)
          setBootstrapping(false)
          publishState()
          requestDeferred.resolve()
          return response
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
        if (requestGeneration !== generation) return response
        logger.debug?.("Failed to bootstrap queries")
        setBootstrapping(false)
        publishState()
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
