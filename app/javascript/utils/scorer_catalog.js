/**
 * Scorer catalog lifecycle.
 *
 * The custom scorer object is still supplied by the legacy factory because its
 * user-code execution contract has not moved yet. Catalog loading, default
 * selection, and case bootstrap do not need query state, so keep those
 * responsibilities here while that last factory seam is being retired.
 */
export function createScorerCatalog({
  request,
  constructFromData,
  initialDefault,
  promiseApi = Promise
}) {
  let defaultScorer = initialDefault

  return {
    getDefault() {
      return defaultScorer
    },

    constructFromData(data) {
      return constructFromData(data)
    },

    setDefault(scorer) {
      defaultScorer = scorer
      return promiseApi.resolve()
    },

    bootstrap(caseNo) {
      return request({ method: "GET", url: `api/cases/${caseNo}/scorers` }).then((response) => {
        const data = response.data || {}
        defaultScorer = data.default ? constructFromData(data.default) : constructFromData()
        return data
      })
    }
  }
}
