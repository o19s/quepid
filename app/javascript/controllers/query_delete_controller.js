import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

/**
 * Owns query-delete confirmation and persistence.
 *
 * The query-command bridge only reconciles the deleted live Query object;
 * persistence and rendered collection state stay Stimulus/store-owned.
 */
export default class extends Controller {
  static values = { queryId: Number, deleteUrl: String }

  remove(event) {
    event.preventDefault()

    if (!window.confirm("Are you absolutely sure you want to delete?")) return

    return this.deleteQuery()
  }

  async deleteQuery() {
    if (!this.hasDeleteUrlValue || !this.deleteUrlValue) {
      window.quepidDom?.flash?.show("error", "Unable to delete query.")
      return
    }

    this.element.disabled = true

    try {
      const response = await apiFetch(this.deleteUrlValue, { method: "DELETE" })
      if (!response.ok) throw new Error(`Delete failed (${response.status})`)

      document.dispatchEvent(new CustomEvent("query-command:delete-completed", {
        detail: { queryId: this.queryIdValue }
      }))
      this.dispatch("completed", { detail: { queryId: this.queryIdValue } })
    } catch (error) {
      console.error("query-delete: delete failed", error)
      this.element.disabled = false
      window.quepidDom?.flash?.show("error", "Unable to delete query.")
    }
  }
}
