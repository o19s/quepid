/**
 * Orchestration for the live Query persistence lifecycle.
 *
 * The service graph supplies state registration and search callbacks while
 * this runtime owns the single/bulk commit policy used by Stimulus callers.
 */
export function createLiveQueryLifecycleRuntime({
  createQuery,
  reset,
  bootstrapQueries,
  searchAll,
  clearQueries,
  addQueriesFromResponse,
  getCaseNo,
  applyDisplayOrder,
  setQueryId,
  registerQuery,
  removeQuery,
  searchAndScore,
  updateScores,
  logger = console
}) {
  function commitSingleQuery(query, persisted) {
    if (persisted.status !== 204) {
      applyDisplayOrder(persisted.data.display_order)
      query.queryId = persisted.data.query.query_id
      setQueryId(query, query.queryId)
      registerQuery(query.queryId, query)
    }

    return searchAndScore(query).then(
      () => {
        logger.info("rescoring queries after adding query")
        updateScores()
        return {}
      },
      (searchError) => ({ searchError })
    )
  }

  return {
    prepareQueries(queryTexts) {
      if (queryTexts.length === 1) {
        return { query: createQuery(queryTexts[0]) }
      }

      return { queries: queryTexts.map((queryText) => createQuery(queryText)) }
    },

    refreshQueries(caseId) {
      reset()
      return bootstrapQueries(caseId).then(() => searchAll())
    },

    commitQueries(prepared, persisted) {
      if (prepared.query) {
        return commitSingleQuery(prepared.query, persisted)
      }

      clearQueries()
      addQueriesFromResponse(persisted.data, getCaseNo())
      return searchAll().then(
        () => ({}),
        (searchError) => ({ searchError })
      )
    },

    commitPersistedQueries(persisted) {
      clearQueries()
      addQueriesFromResponse(persisted.data, getCaseNo())
      return {}
    },

    reconcileQueryRemoval(queryId, rescore = false) {
      if (!removeQuery(queryId)) return false
      if (rescore) updateScores()
      return true
    }
  }
}
