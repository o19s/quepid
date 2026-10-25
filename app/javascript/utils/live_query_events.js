import { CORE_EVENTS } from "utils/core_events"
import { isSameId } from "utils/record_identity"

/**
 * Event bridge for live Query state owned by the runtime graph.
 *
 * Stimulus owns the initiating UI and API calls; this runtime keeps the
 * service-backed live query collection synchronized until that collection is
 * removed.
 */
export function createLiveQueryEventsRuntime({
  eventTarget = document,
  scoringStore,
  getCaseNo,
  getQuery,
  getQueries,
  ratingChangedQueryId,
  invalidateRatedDocs,
  publishQuery,
  scoreAll,
  updateScores = scoreAll,
  setQueryOptions,
  setScorer,
  reloadQueries,
  configureBook,
  schedule,
  onError = (message, error) => console.error(`live-query-events: ${message}`, error)
}) {
  function currentCase(detail) {
    return !Number(detail.caseId) || isSameId(detail.caseId, getCaseNo())
  }

  function ratingChanged(event) {
    const queryId = ratingChangedQueryId(event)
    const query = queryId !== undefined ? getQuery(queryId) : null
    if (query) {
      invalidateRatedDocs(query)
      publishQuery(query)
    } else {
      Object.values(getQueries()).forEach(publishQuery)
    }
    schedule(scoreAll)
  }

  function optionsSaved(event) {
    const detail = event.detail || {}
    const query = getQuery(detail.queryId)
    if (!currentCase(detail) || !query || detail.options === undefined) return
    schedule(() => {
      setQueryOptions(query, detail.options)
      updateScores()
    })
  }

  function scorerSelected(event) {
    const detail = event.detail || {}
    if (!isSameId(detail.caseId, getCaseNo()) || !detail.scorer) return
    schedule(() =>
      Promise.resolve(setScorer(detail.scorer))
        .then(updateScores)
        .catch((error) => onError("Could not apply the selected scorer", error))
    )
  }

  function queriesNeedReload(event) {
    const detail = event.detail || {}
    if (!isSameId(detail.caseId, getCaseNo())) return
    schedule(() =>
      Promise.resolve(reloadQueries(detail.caseId)).catch((error) =>
        onError("Could not reload queries", error)
      )
    )
  }

  function bookSettingsSaved(event) {
    const detail = event.detail || {}
    if (!isSameId(detail.caseId, getCaseNo())) return
    configureBook({
      bookId: detail.bookId ?? null,
      autoPopulate: detail.autoPopulateBookPairs === true
    })
  }

  let connected = false

  // Page-lifetime listeners; a second connect does not double-register them.
  function connect() {
    if (connected) return
    connected = true
    scoringStore.addEventListener("rating-changed", ratingChanged)
    eventTarget.addEventListener(CORE_EVENTS.QUERY_OPTIONS_SAVED, optionsSaved)
    eventTarget.addEventListener(CORE_EVENTS.PICK_SCORER_SELECTED, scorerSelected)
    eventTarget.addEventListener(CORE_EVENTS.JUDGEMENTS_QUERIES_NEED_RELOAD, queriesNeedReload)
    eventTarget.addEventListener(CORE_EVENTS.IMPORTS_QUERIES_NEED_RELOAD, queriesNeedReload)
    eventTarget.addEventListener(CORE_EVENTS.CASE_BOOK_UPDATED, bookSettingsSaved)
  }

  return { connect }
}
