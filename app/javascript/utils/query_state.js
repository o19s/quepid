/**
 * Framework-free query-row and query-list rules shared by the Angular bridge
 * and the eventual Stimulus query workspace.
 */

export function querqyRuleTriggered(parsedQueryDetails) {
  if (!parsedQueryDetails) return false

  return (
    parsedQueryDetails.querqy?.rewrite !== undefined ||
    Object.prototype.hasOwnProperty.call(parsedQueryDetails, "querqy.infoLog")
  )
}

export function queryResultCount(query, showOnlyRated) {
  return showOnlyRated ? (query?.ratedDocsFound ?? 0) : (query?.numFound ?? 0)
}

export function queryLifecycleState({ errorText = "", resultsReturned = false, docCount = 0 } = {}) {
  if (errorText.length > 0) return "error"
  if (!resultsReturned) return "loading"
  if (docCount === 0) return "noResults"
  return "loaded"
}

export function queryStateClass(state) {
  return `queryHeader_${state}`
}

export function isImageUrl(url) {
  return typeof url === "string" && /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url)
}

export function invalidateRatedDocsCache(query) {
  if (!query) return
  query.ratingsReady = false
  // Keep an in-flight lookup attached. Clearing it here allows a second
  // lookup to start and lets the older response win the race.
  query.ratingsGeneration = (query.ratingsGeneration ?? 0) + 1
}

export function ratingChangedQueryId(event, legacyQueryId) {
  return event?.detail?.queryId ?? legacyQueryId
}

export function orderedQueries(displayOrder = [], queries = {}) {
  return displayOrder.reduce((result, queryId, index) => {
    if (!Object.prototype.hasOwnProperty.call(queries, queryId)) return result

    const query = queries[queryId]
    query.defaultCaseOrder = index
    result.push(query)
    return result
  }, [])
}

export function matchesQueryFilter(query, filterText) {
  if (filterText === undefined || filterText === null || filterText === "") return true
  return String(query?.queryText ?? "")
    .toLowerCase()
    .includes(String(filterText).toLowerCase())
}

export function paginate(items = [], page, pageSize) {
  const currentPage = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Number(pageSize) || items.length || 1)
  const start = (currentPage - 1) * size
  return items.slice(start, start + size)
}

export function queryDisplayPositions({ oldIndex, newIndex, currentPage = 1, pageSize = 1, reverse = false } = {}) {
  const pageOffset = (Math.max(1, Number(currentPage) || 1) - 1) * (Number(pageSize) || 0)
  const fromIndex = oldIndex + pageOffset
  const toIndex = newIndex + pageOffset

  return {
    fromIndex,
    toIndex,
    reverse: toIndex < fromIndex ? !reverse : reverse
  }
}
