function documentFields(doc) {
  const fields = {}

  Object.values(doc.subsList || {}).forEach((field) => {
    fields[field.field] = field.value
  })

  return fields
}

function snapshotDocument(doc, ratedOnly, recordDocumentFields) {
  const payload = {
    id: doc.id,
    explain: doc.explain().rawStr(),
    rated_only: ratedOnly
  }

  if (recordDocumentFields) {
    payload.fields = documentFields(doc)
    if (!ratedOnly) payload.fields[doc.titleField] = doc.title
  }

  return payload
}

export function buildSnapshotPayload(name, recordDocumentFields, queries) {
  const docs = {}
  const queriesPayload = {}

  queries.forEach((query) => {
    const currentScore = query.currentScore || {}
    const score =
      currentScore.score === undefined || currentScore.score === "--" ? null : currentScore.score

    queriesPayload[query.queryId] = {
      score,
      all_rated: currentScore.allRated || false,
      number_of_results: query.numFound
    }

    docs[query.queryId] = [
      ...(query.docs || []).map((doc) => snapshotDocument(doc, false, recordDocumentFields)),
      ...(query.ratedDocs || []).map((doc) => snapshotDocument(doc, true, recordDocumentFields))
    ]
  })

  return { snapshot: { name, docs, queries: queriesPayload } }
}
