import { deleteJson, postJson, putJson } from "api/json"

/**
 * A query's ratings and the API calls that change them. Change notification
 * is a dependency, so query scoring can use it without coupling to the case
 * workspace UI.
 */
export class RatingsStore {
  constructor({ caseNo, queryId, ratingsDict = {}, onChanged = () => {} }) {
    this.caseNo = caseNo
    this.queryId = queryId
    this.ratingsDict = ratingsDict
    this.onChanged = onChanged
    this.changeVersion = 0
  }

  setQueryId(queryId) {
    this.queryId = queryId
  }

  rateDocument(docId, rating) {
    return putJson(this.basePath("ratings"), { rating: { doc_id: docId, rating } }).then(() => {
      this.ratingsDict[docId] = rating
      this.markDirty()
    })
  }

  rateBulkDocuments(docIds, rating) {
    return putJson(this.basePath("bulk/ratings"), { doc_ids: docIds, rating }).then(() => {
      docIds.forEach((docId) => {
        this.ratingsDict[docId] = rating
      })
      this.markDirty()
    })
  }

  resetRating(docId) {
    return deleteJson(this.basePath("ratings"), { rating: { doc_id: docId } }).then(() => {
      delete this.ratingsDict[docId]
      this.markDirty()
    })
  }

  resetBulkRatings(docIds) {
    return postJson(this.basePath("bulk/ratings/delete"), { doc_ids: docIds }).then(() => {
      docIds.forEach((docId) => {
        delete this.ratingsDict[docId]
      })
      this.markDirty()
    })
  }

  hasRating(docId) {
    return Object.prototype.hasOwnProperty.call(this.ratingsDict, docId)
  }

  getRating(docId) {
    if (!this.hasRating(docId)) return null

    const rating = this.ratingsDict[docId]
    return typeof rating === "string" ? parseInt(rating, 10) : rating
  }

  version() {
    return this.changeVersion
  }

  bestDocs() {
    return Object.entries(this.ratingsDict)
      .map(([id, rating]) => ({ id, rating: parseInt(rating, 10) }))
      .sort((first, second) => second.rating - first.rating)
  }

  createRateableDoc(normalDoc) {
    const store = this
    return Object.assign(normalDoc, {
      rate(rating) {
        return store.rateDocument(this.id, rating)
      },
      rateBulk(ids, rating) {
        return store.rateBulkDocuments(ids, rating)
      },
      hasRating() {
        return store.hasRating(this.id)
      },
      resetRating() {
        return store.resetRating(this.id)
      },
      resetBulkRatings(ids) {
        return store.resetBulkRatings(ids)
      },
      getRating() {
        return store.getRating(this.id)
      }
    })
  }

  basePath(resource) {
    return `api/cases/${this.caseNo}/queries/${this.queryId}/${resource}`
  }

  markDirty() {
    this.changeVersion += 1
    this.onChanged(this.queryId)
  }
}
