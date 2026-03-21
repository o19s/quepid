// Manages ratings state for a single query.
// Mirrors Angular ratingsStoreSvc but as a plain ES module class.

import { apiUrl, csrfToken } from "modules/api_url"

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
      this.ratings[docId] = parseInt(value, 10)
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

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(),
        Accept: "application/json",
      },
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

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(),
        Accept: "application/json",
      },
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
