import { isSameId } from "utils/record_identity"

/**
 * Orchestration for the remaining live Query state transitions.
 * The service graph supplies the live objects and query callbacks;
 * this runtime owns score refresh and case/try settings policy.
 */
export function createLiveQueryStateRuntime({
  getQueries,
  scoreAll,
  applySettings,
  getCurrentCaseNo,
  setCurrentCaseNo,
  bootstrapScorer,
  bootstrapQueries,
  configureBook,
  refreshQueryDiff,
  queryReady
}) {
  return {
    updateScores() {
      Object.values(getQueries()).forEach((query) => query.setDirty())
      return Promise.resolve(scoreAll())
    },

    changeSettings(newCaseNo, newSettings) {
      applySettings(newSettings)

      if (!isSameId(getCurrentCaseNo(), newCaseNo)) {
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
