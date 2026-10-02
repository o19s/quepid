import { apiFetch } from "api/fetch"
import { requestJson } from "api/json"

export function buildQueryDocPairsPayload(queries) {
  return queries.flatMap((query) =>
    (query.docs || []).map((doc, index) => {
      const fields = Object.values(doc.subsList || {}).reduce(
        (result, field) => {
          result[field.field] = field.value
          return result
        },
        { ...(doc.rawFields || {}) }
      )

      fields.title = doc.title

      const rawTitle = doc.rawFields?.title ?? doc.doc?.title ?? doc.doc?.origin?.()?.title
      if (rawTitle !== undefined && rawTitle !== doc.title) {
        fields.title_field = rawTitle
      }

      const hasThumb = typeof doc.hasThumb === "function" ? doc.hasThumb() : doc.hasThumb
      const hasImage = typeof doc.hasImage === "function" ? doc.hasImage() : doc.hasImage

      if (hasThumb) {
        fields.thumb = doc.thumb_options?.prefix
          ? `${doc.thumb_options.prefix}${doc.thumb}`
          : doc.thumb
      }

      if (hasImage) {
        fields.image = doc.image_options?.prefix
          ? `${doc.image_options.prefix}${doc.image}`
          : doc.image
      }

      return {
        query_text: query.queryText,
        doc_id: doc.id,
        position: index + 1,
        document_fields: fields
      }
    })
  )
}

export async function populateBook({ bookId, caseId, queries, fetcher = apiFetch }) {
  return requestJson(
    `api/books/${bookId}/populate`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        case_id: caseId,
        query_doc_pairs: buildQueryDocPairsPayload(queries)
      })
    },
    fetcher
  )
}

export function createBookSyncRuntime({ fetcher = apiFetch, logger = console } = {}) {
  let caseId = null
  let bookId = null
  let autoPopulate = false
  let syncedPairs = {}

  const configure = ({
    caseId: nextCaseId,
    bookId: nextBookId,
    autoPopulate: nextAutoPopulate
  }) => {
    if (String(caseId) !== String(nextCaseId) || String(bookId) !== String(nextBookId))
      syncedPairs = {}
    caseId = nextCaseId
    bookId = nextBookId
    autoPopulate = nextAutoPopulate === true
  }

  const reset = () => {
    syncedPairs = {}
  }

  const getSyncCacheStats = (targetBookId = bookId) => ({
    bookId: targetBookId,
    syncedPairsCount: Object.keys(syncedPairs[targetBookId] || {}).length
  })

  const sync = async (queries) => {
    if (caseId == null || bookId == null || !autoPopulate) return

    const cache = (syncedPairs[bookId] ||= {})
    const queriesToSync = queries.flatMap((query) => {
      const docs = (query.docs || []).filter((doc) => {
        const key = `${query.queryText}:${doc.id}`
        if (cache[key]) return false
        cache[key] = true
        return true
      })
      return docs.length > 0 ? [{ ...query, docs }] : []
    })
    const batches = []
    for (let index = 0; index < queriesToSync.length; index += 100) {
      batches.push(queriesToSync.slice(index, index + 100))
    }

    await Promise.all(
      batches.map(async (batch) => {
        try {
          await populateBook({ bookId, caseId, queries: batch, fetcher })
        } catch (error) {
          batch.forEach((query) =>
            query.docs.forEach((doc) => {
              delete cache[`${query.queryText}:${doc.id}`]
            })
          )
          logger.error("Failed to sync book query_doc_pairs batch:", error)
        }
      })
    )
  }

  return { configure, getSyncCacheStats, reset, sync }
}
