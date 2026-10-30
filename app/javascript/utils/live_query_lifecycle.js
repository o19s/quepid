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
  syncToBook,
  updateScores,
  logger = console
}) {
  function commitSingleQuery(query, persisted) {
    if (persisted.status !== 204) {
      const saved = persisted.data.query
      applyDisplayOrder(persisted.data.display_order)
      query.queryId = saved.query_id
      // The server may already have vectorised it (options.query_vec), and the first
      // search runs right below.
      if (saved.options) query.options = saved.options
      query.vectorStatus = saved.vector_status || "none"
      query.vectorStatusReason = saved.vector_status_reason || null
      setQueryId(query, query.queryId)
      registerQuery(query.queryId, query)
    }

    return searchAndScore(query)
      .then(() => {
        logger.info("rescoring queries after adding query")
        updateScores()
        return syncToBook()
      })
      .then(
        () => ({}),
        (searchError) => ({ searchError })
      )
  }

  function commitPersistedQueries(persisted) {
    clearQueries()
    addQueriesFromResponse(persisted.data, getCaseNo())
    return {}
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

      commitPersistedQueries(persisted)
      return searchAll().then(
        () => ({}),
        (searchError) => ({ searchError })
      )
    },

    commitPersistedQueries,

    reconcileQueryRemoval(queryId, rescore = false) {
      if (!removeQuery(queryId)) return false
      if (rescore) updateScores()
      return true
    }
  }
}
