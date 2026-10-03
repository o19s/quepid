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
  schedule
}) {
  function currentCase(detail) {
    return !Number(detail.caseId) || Number(detail.caseId) === Number(getCaseNo())
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
    if (Number(detail.caseId) !== Number(getCaseNo()) || !detail.scorer) return
    schedule(() => setScorer(detail.scorer).then(updateScores))
  }

  function queriesNeedReload(event) {
    const detail = event.detail || {}
    if (Number(detail.caseId) !== Number(getCaseNo())) return
    schedule(() => reloadQueries(detail.caseId))
  }

  function bookSettingsSaved(event) {
    const detail = event.detail || {}
    if (Number(detail.caseId) !== Number(getCaseNo())) return
    configureBook({
      bookId: detail.bookId ?? null,
      autoPopulate: detail.autoPopulateBookPairs === true
    })
  }

  function connect() {
    const ratingSource = scoringStore || eventTarget
    const ratingEvent = scoringStore ? "rating-changed" : "ratings:changed"
    ratingSource.addEventListener(ratingEvent, ratingChanged)
    eventTarget.addEventListener("query-options:saved", optionsSaved)
    eventTarget.addEventListener("pick-scorer:selected", scorerSelected)
    eventTarget.addEventListener("judgements:queries-need-reload", queriesNeedReload)
    eventTarget.addEventListener("imports:queries-need-reload", queriesNeedReload)
    eventTarget.addEventListener("judgements:book-settings-saved", bookSettingsSaved)
  }

  return { connect }
}
