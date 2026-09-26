/**
 * Framework-free ratings state and transport adapter.
 *
 * The Angular ratingsStoreSvc used to own both the ratings dictionary and the
 * HTTP calls that mutate it. This class keeps the same public contract while
 * receiving transport and change notification as dependencies, so query
 * scoring can use it without Angular during the case-workspace migration.
 */
export class RatingsStore {
  constructor({ caseNo, queryId, ratingsDict = {}, request, onChanged = () => {} }) {
    this.caseNo = caseNo
    this.queryId = queryId
    this.ratingsDict = ratingsDict
    this.request = request
    this.onChanged = onChanged
    this.changeVersion = 0
  }

  setQueryId(queryId) {
    this.queryId = queryId
  }

  rateDocument(docId, rating) {
    return this.request({
      method: "PUT",
      url: this.basePath("ratings"),
      data: { rating: { doc_id: docId, rating } }
    }).then(() => {
      this.ratingsDict[docId] = rating
      this.markDirty()
    })
  }

  rateBulkDocuments(docIds, rating) {
    return this.request({
      method: "PUT",
      url: this.basePath("bulk/ratings"),
      data: { doc_ids: docIds, rating }
    }).then(() => {
      docIds.forEach((docId) => {
        this.ratingsDict[docId] = rating
      })
      this.markDirty()
    })
  }

  resetRating(docId) {
    return this.request({
      method: "DELETE",
      url: this.basePath("ratings"),
      data: JSON.stringify({ rating: { doc_id: docId } }),
      headers: { "Content-Type": "application/json;charset=UTF-8" }
    }).then(() => {
      delete this.ratingsDict[docId]
      this.markDirty()
    })
  }

  resetBulkRatings(docIds) {
    return this.request({
      method: "POST",
      url: this.basePath("bulk/ratings/delete"),
      data: { doc_ids: docIds }
    }).then(() => {
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
