import { Controller } from "@hotwired/stimulus"
import { requestJson } from "api/json"
import coreFlash from "utils/core_flash"

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
      coreFlash.show("error", "Unable to delete query.")
      return
    }

    this.element.disabled = true

    try {
      await requestJson(this.deleteUrlValue, { method: "DELETE" })

      document.dispatchEvent(new CustomEvent("query-command:delete-completed", {
        detail: { queryId: this.queryIdValue }
      }))
      this.dispatch("completed", { detail: { queryId: this.queryIdValue } })
    } catch (error) {
      console.error("query-delete: delete failed", error)
      this.element.disabled = false
      coreFlash.show("error", "Unable to delete query.")
    }
  }
}
