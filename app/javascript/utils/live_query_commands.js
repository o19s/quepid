/**
 * Framework-free command orchestration for live Query objects.
 *
 * The runtime owns lookup, scheduling, and command sequencing. The case
 * service injects the compatibility-backed execution and document/rating adapters
 * until those dependencies can move out of the compatibility layer.
 */
export function createLiveQueryCommandsRuntime({
  getQuery,
  getShowOnlyRated,
  queryRuntime,
  documentRuntime,
  schedule,
  reject = (message) => Promise.reject(message)
}) {
  function findQuery(queryId) {
    return getQuery(queryId)
  }

  function searchQuery(queryId) {
    const query = findQuery(queryId)
    if (!query) return reject(`Query not found: ${queryId}`)
    documentRuntime.reset(query)
    documentRuntime.publish(query)
    return queryRuntime.create(query).search()
  }

  function refreshRatedDocs(queryId, pageSize) {
    const query = findQuery(queryId)
    if (!query) return reject(`Query not found: ${queryId}`)
    return queryRuntime.create(query).refreshRatedDocs(pageSize)
  }

  function paginateQuery(queryId, ratedOnly) {
    const query = findQuery(queryId)
    if (!query) return false

    schedule(() => {
      const runtime = queryRuntime.create(query)
      return ratedOnly ? runtime.ratedPaginate() : runtime.paginate()
    })
    return true
  }

  function rateDocument(queryId, docId, rating) {
    const query = findQuery(queryId)
    if (!query) return false

    const docs = (query.docs || []).concat(query.ratedDocs || [])
    const doc = docs.find((candidate) => String(candidate.id) === String(docId))
    if (!doc) return false

    schedule(() => {
      const request =
        rating == null
          ? query.ratingsStore.resetRating(doc.id)
          : query.ratingsStore.rateDocument(doc.id, parseInt(rating, 10))
      return request.then(() => query.touchModifiedAt())
    })
    return true
  }

  function rateAll(queryId, rating) {
    const query = findQuery(queryId)
    if (!query) return false

    const docs = getShowOnlyRated() ? query.ratedDocs : query.docs
    if (!docs || docs.length === 0) return true

    const ids = docs.map((doc) => doc.id)
    schedule(() => {
      const request =
        rating == null
          ? query.ratingsStore.resetBulkRatings(ids).then(() => {
              query.rating = "--"
            })
          : query.ratingsStore.rateBulkDocuments(ids, parseInt(rating, 10)).then(() => {
              query.rating = parseInt(rating, 10)
            })
      return request.then(() => query.touchModifiedAt())
    })
    return true
  }

  return { searchQuery, refreshRatedDocs, paginateQuery, rateDocument, rateAll }
}
