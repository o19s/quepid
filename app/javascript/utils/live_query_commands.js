import { isSameId } from "utils/record_identity"

/**
 * Command orchestration for live Query objects: lookup, scheduling, and
 * command sequencing. `runtimeFor(query)` supplies the query's search runtime.
 */
export function createLiveQueryCommandsRuntime({
  getQuery,
  getShowOnlyRated,
  runtimeFor,
  schedule
}) {
  function refreshRatedDocs(queryId, pageSize) {
    const query = getQuery(queryId)
    if (!query) return Promise.reject(`Query not found: ${queryId}`)
    return runtimeFor(query).refreshRatedDocs(pageSize)
  }

  function paginateQuery(queryId, ratedOnly) {
    const query = getQuery(queryId)
    if (!query) return false

    schedule(() => {
      const runtime = runtimeFor(query)
      return ratedOnly ? runtime.ratedPaginate() : runtime.paginate()
    })
    return true
  }

  function rateDocument(queryId, docId, rating) {
    const query = getQuery(queryId)
    if (!query) return false

    const docs = (query.docs || []).concat(query.ratedDocs || [])
    const doc = docs.find((candidate) => isSameId(candidate.id, docId))
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
    const query = getQuery(queryId)
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

  return { refreshRatedDocs, paginateQuery, rateDocument, rateAll }
}
