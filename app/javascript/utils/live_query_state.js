/**
 * Orchestration for the remaining live Query state transitions.
 * The service graph supplies the live objects and query callbacks;
 * this runtime owns score refresh and case/try settings policy.
 */
export function createLiveQueryStateRuntime({
  getQueries,
  scoreAll,
  applySettings,
  setLifecycleCaseId,
  getCurrentCaseNo,
  setCurrentCaseNo,
  bootstrapScorer,
  bootstrapQueries,
  configureBook,
  refreshQueryDiff,
  queryReady,
  onVersion,
  promiseApi = Promise
}) {
  return {
    updateScores() {
      Object.values(getQueries()).forEach((query) => query.setDirty())
      return promiseApi.resolve(scoreAll()).then(() => {
        onVersion()
      })
    },

    scoreAllDiffs() {
      const diffs = Object.values(getQueries())
        .filter((query) => query.diff !== null)
        .map((query) => query.diff)
      return scoreAll(diffs)
    },

    changeSettings(newCaseNo, newSettings) {
      applySettings(newSettings)
      setLifecycleCaseId(newCaseNo)

      if (getCurrentCaseNo() !== newCaseNo) {
        bootstrapScorer(newCaseNo)
        bootstrapQueries(newCaseNo)
        configureBook(newCaseNo)
      } else {
        Object.values(getQueries()).forEach((query) => {
          if (query.diff !== null) refreshQueryDiff(query)
        })
        queryReady.resolve()
      }

      setCurrentCaseNo(newCaseNo)
      return queryReady.promise()
    }
  }
}
