import { Controller } from "@hotwired/stimulus"

/**
 * Owns the query-delete confirmation and intent event.
 *
 * SearchResultsCtrl remains the temporary Angular adapter for the DELETE
 * request and score refresh while the query store is migrated.
 */
export default class extends Controller {
  static values = { queryId: Number }

  remove(event) {
    event.preventDefault()

    if (!window.confirm("Are you absolutely sure you want to delete?")) return

    this.dispatch("submit", { detail: { queryId: this.queryIdValue } })
  }
}
