/**
 * Searcher-compatible access to results captured in a snapshot.
 *
 * Snapshot data is already hydrated by querySnapshotSvc, so this utility only
 * adapts it to the small searcher interface used by Query. Angular supplies
 * the document factory and promise implementation while it remains the
 * compatibility owner of the live Query objects.
 */
export function createSnapshotSearcher({
  snapshot,
  query,
  fieldSpec,
  createRateableDoc,
  explainDoc,
  promiseApi = Promise
}) {
  const searcher = {
    snapshot,
    query,
    fieldSpec,
    type: "snapshot",
    docs: [],
    numFound: 0,
    linkUrl: null,
    inError: false,
    searchError: null,
    lastResponse: null,
    search() {
      return promiseApi.resolve()
    },
    pager() {
      return null
    },
    explainOther() {
      return promiseApi.reject("ExplainOther not supported for snapshots")
    },
    name() {
      return snapshot.name()
    },
    version() {
      return query.version()
    },
    getFilteredDocs(onlyRated = false) {
      return searcher.docs.filter((doc) => doc.ratedOnly === onlyRated)
    }
  }

  const queryError =
    typeof snapshot.getQueryError === "function" ? snapshot.getQueryError(query.queryId) : null
  if (queryError) {
    searcher.inError = true
    searcher.searchError = queryError
  }

  const savedSearchResults = snapshot.getSearchResults(query.queryId)
  if (!savedSearchResults) return searcher

  searcher.numFound = savedSearchResults.length
  savedSearchResults.forEach((doc) => {
    if (doc === undefined || doc === null) return

    const rateableDoc = createRateableDoc(doc)
    rateableDoc.ratedOnly = doc.rated_only ? doc.rated_only : false
    const explain = typeof doc.explain === "string" ? JSON.parse(doc.explain) : doc.explain
    searcher.docs.push(explainDoc(rateableDoc, explain))
  })

  return searcher
}
