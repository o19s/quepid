import { createScorer } from "utils/scorer_runtime"

/**
 * The case's default scorer: the one place the core UI loads, selects and
 * builds scorers. Every scorer it hands out comes from createScorer() with the
 * same `scorerOptions`, so callers never construct scorers themselves.
 *
 *   getDefault()     -> the current default scorer (a createScorer() object)
 *   select(data)     -> builds a scorer from API JSON and makes it the default
 *   bootstrap(caseNo)-> loads the case's default from GET api/cases/:id/scorers
 *
 * `scorerOptions` is passed straight to createScorer() (promiseApi, schedule,
 * refreshRatedDocs).
 */
export function createScorerCatalog({ request, scorerOptions = {}, promiseApi = Promise }) {
  const build = (data) => createScorer(data, { promiseApi, ...scorerOptions })
  let defaultScorer = build()

  return {
    getDefault() {
      return defaultScorer
    },

    select(data) {
      defaultScorer = build(data)
      return promiseApi.resolve(defaultScorer)
    },

    bootstrap(caseNo) {
      return request({ method: "GET", url: `api/cases/${caseNo}/scorers` }).then((response) => {
        const data = response.data || {}
        defaultScorer = build(data.default)
        return data
      })
    }
  }
}
