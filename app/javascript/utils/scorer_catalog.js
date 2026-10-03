/** Scorer loading and default selection with injected scorer construction. */
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
