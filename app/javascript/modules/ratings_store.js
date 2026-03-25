// Manages ratings state for a single query.
// Mirrors Angular ratingsStoreSvc but as a plain ES module class.

import { apiUrl } from "modules/api_url"
import { jsonFetch } from "modules/json_fetch"

export class RatingsStore {
  /**
   * @param {number} caseId
   * @param {number} queryId
   * @param {Object} initialRatings - { docId: ratingValue, ... } from server bootstrap
   */
  constructor(caseId, queryId, initialRatings = {}) {
    this.caseId = caseId
    this.queryId = queryId
    // Store as { "docId": integerRating }
    this.ratings = {}
    for (const [docId, value] of Object.entries(initialRatings)) {
      const parsed = parseInt(value, 10)
      if (!isNaN(parsed)) {
        this.ratings[docId] = parsed
      }
    }
  }

  /**
   * Get the rating for a doc, or null if unrated.
   */
  getRating(docId) {
    const val = this.ratings[docId]
    return val !== undefined ? val : null
  }

  /**
   * Check if a doc has a rating.
   */
  hasRating(docId) {
    return this.ratings[docId] !== undefined
  }

  /**
   * Rate a document. Persists to backend via PUT.
   * Returns the response JSON on success.
   */
  async rate(docId, rating) {
    const url = apiUrl(`api/cases/${this.caseId}/queries/${this.queryId}/ratings`)

    const response = await jsonFetch(url, {
      method: "PUT",
      body: JSON.stringify({
        rating: { doc_id: docId, rating: rating },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save rating (${response.status})`)
    }

    // Update local cache
    this.ratings[docId] = parseInt(rating, 10)

    return response.json()
  }

  /**
   * Remove a rating from a document. Persists to backend via DELETE.
   */
  async unrate(docId) {
    const url = apiUrl(`api/cases/${this.caseId}/queries/${this.queryId}/ratings`)

    const response = await jsonFetch(url, {
      method: "DELETE",
      body: JSON.stringify({
        rating: { doc_id: docId },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete rating (${response.status})`)
    }

    delete this.ratings[docId]
  }

  /**
   * Bulk-rate multiple documents at once. Persists via PUT to bulk ratings endpoint.
   */
  async rateBulk(docIds, rating) {
    const url = apiUrl(`api/cases/${this.caseId}/queries/${this.queryId}/bulk/ratings`)

    const response = await jsonFetch(url, {
      method: "PUT",
      body: JSON.stringify({ doc_ids: docIds, rating: rating }),
    })

    if (!response.ok) {
      throw new Error(`Failed to bulk rate (${response.status})`)
    }

    // Update local cache
    const ratingInt = parseInt(rating, 10)
    for (const docId of docIds) {
      this.ratings[docId] = ratingInt
    }
  }

  /**
   * Bulk-unrate multiple documents. Persists via POST to the bulk delete endpoint.
   */
  async unrateBulk(docIds) {
    const url = apiUrl(`api/cases/${this.caseId}/queries/${this.queryId}/bulk/ratings/delete`)

    const response = await jsonFetch(url, {
      method: "POST",
      body: JSON.stringify({ doc_ids: docIds }),
    })

    if (!response.ok) {
      throw new Error(`Failed to bulk unrate (${response.status})`)
    }

    for (const docId of docIds) {
      delete this.ratings[docId]
    }
  }

  /**
   * Return all rated docs as an array of { docId, rating } sorted by rating desc.
   * Equivalent to Angular ratingsStoreSvc.bestDocs().
   */
  bestDocs() {
    return Object.entries(this.ratings)
      .map(([docId, rating]) => ({ docId, rating }))
      .sort((a, b) => b.rating - a.rating)
  }

  /**
   * Count of rated documents.
   */
  ratedCount() {
    return Object.keys(this.ratings).length
  }
}
