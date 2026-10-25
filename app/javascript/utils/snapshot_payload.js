// Keyed by source field name so the snapshot /search endpoint can hand the
// fields back for a doc lookup. Thumb and image live outside subsList on a
// normal doc, so without them a snapshot column renders with no images.
function documentFields(doc, fieldSpec) {
  const fields = {}

  Object.values(doc.subsList || {}).forEach((field) => {
    fields[field.field] = field.value
  })
  fields[doc.titleField] = doc.title
  if (fieldSpec?.thumb && doc.hasThumb?.()) fields[fieldSpec.thumb] = doc.thumb
  if (fieldSpec?.image && doc.hasImage?.()) fields[fieldSpec.image] = doc.image

  return fields
}

function snapshotDocument(doc, ratedOnly, recordDocumentFields, fieldSpec) {
  const payload = {
    id: doc.id,
    explain: doc.explain().rawStr(),
    rated_only: ratedOnly
  }

  if (recordDocumentFields) payload.fields = documentFields(doc, fieldSpec)

  return payload
}

export function buildSnapshotPayload(name, recordDocumentFields, queries, fieldSpec = null) {
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
      ...(query.docs || []).map((doc) =>
        snapshotDocument(doc, false, recordDocumentFields, fieldSpec)
      ),
      ...(query.ratedDocs || []).map((doc) =>
        snapshotDocument(doc, true, recordDocumentFields, fieldSpec)
      )
    ]
  })

  return { snapshot: { name, docs, queries: queriesPayload } }
}
