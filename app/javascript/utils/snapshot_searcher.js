import { parseExplain } from "utils/parse_explain"

/**
 * Searcher-compatible access to results captured in a snapshot.
 *
 * Snapshot data is hydrated by the snapshot registry, then
 * adapted here to the small searcher interface used by Query. The live-query
 * runtime supplies the document factory and promise implementation while it
 * owns the live Query objects.
 */
export function createSnapshotSearcher({
  snapshot,
  query,
  fieldSpec,
  createRateableDoc,
  explainDoc
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
      return Promise.resolve()
    },
    pager() {
      return null
    },
    explainOther() {
      return Promise.reject("ExplainOther not supported for snapshots")
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
    const explain = parseExplain(doc.explain)
    searcher.docs.push(explainDoc(rateableDoc, explain))
  })

  return searcher
}

export function createSnapshotSearcherFromRegistry({
  snapshotId,
  snapshots,
  query,
  settings,
  createRateableDoc,
  explainDoc,
  log = () => {}
}) {
  const snapshot = snapshots[snapshotId]

  if (!snapshot) {
    log(`Snapshot not found: ${snapshotId}`)
    return null
  }

  return createSnapshotSearcher({
    snapshot,
    query,
    fieldSpec: settings ? settings.createFieldSpec() : null,
    createRateableDoc,
    explainDoc
  })
}
