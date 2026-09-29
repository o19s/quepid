/**
 * Framework-free snapshot data model.
 *
 * The case workspace still supplies the document cache and explanation
 * normalizer while snapshot fetching is being moved into this runtime. Keeping
 * those as callbacks makes the snapshot contract testable independently.
 */
export function createSnapshotModel({
  params,
  getDoc,
  explainDoc,
  parseExplain = (explain) => (typeof explain === "string" ? JSON.parse(explain) : explain),
  formatDate = (time) => new Date(time).toLocaleDateString(),
  log = () => {}
}) {
  const snapshot = {
    id: params.id,
    time: params.time,
    hasSnapshotFile: params.has_snapshot_file,
    docs: params.docs,
    queries: normalizeQueries(params.queries),
    scores: params.scores,
    name: () => `(${formatDate(params.time)}) ${params.name}`,
    allDocIds,
    getSearchResults,
    getQueryError
  }

  snapshot.docIdsPerQuery = {}
  Object.entries(snapshot.docs || {}).forEach(([queryId, docs]) => {
    snapshot.docIdsPerQuery[queryId] = (docs || []).map((doc) => doc.id)
  })

  return snapshot

  function allDocIds() {
    const docIds = new Set()
    Object.values(snapshot.docIdsPerQuery).forEach((queryDocIds) => {
      queryDocIds.forEach((docId) => docIds.add(String(docId)))
    })
    return [...docIds]
  }

  function getSearchResults(queryId) {
    if (snapshot.docs == null) return undefined

    const searchResults = []
    ;(snapshot.docs[queryId] || []).forEach((savedDoc) => {
      if (savedDoc == null) {
        log("sDoc is null, and we do not expect it")
        return
      }

      const doc = getDoc(savedDoc.id)
      if (doc == null) {
        log(`Document with id ${savedDoc.id} is null`)
        return
      }

      const cachedDoc = clone(doc)
      cachedDoc.explain = savedDoc.explain
      cachedDoc.rated_only = savedDoc.rated_only
      searchResults.push(explainDoc(cachedDoc, parseExplain(cachedDoc.explain)))
    })

    return searchResults
  }

  function getQueryError(queryId) {
    const score = (snapshot.scores || []).find(
      (entry) => String(entry.query_id) === String(queryId)
    )
    return score?.error || null
  }
}

function normalizeQueries(queries) {
  if (Array.isArray(queries)) return queries.map(normalizeQuery)
  return Object.fromEntries(
    Object.entries(queries || {}).map(([key, query]) => [key, normalizeQuery(query)])
  )
}

function normalizeQuery(query) {
  const normalized = { ...query }
  if (normalized.query_id !== undefined) {
    normalized.queryId = normalized.query_id
    delete normalized.query_id
  }
  if (normalized.query_text !== undefined) {
    normalized.queryText = normalized.query_text
    delete normalized.query_text
  }
  return normalized
}

function clone(value) {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(clone)

  const copy = Object.create(Object.getPrototypeOf(value))
  Object.keys(value).forEach((key) => {
    copy[key] = clone(value[key])
  })
  return copy
}
