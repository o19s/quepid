import { Controller } from "@hotwired/stimulus"
import { deleteJson } from "api/json"
import coreFlash from "utils/core_flash"

/**
 * Owns query-delete confirmation and persistence.
 *
 * The query-command bridge outlet only reconciles the deleted live Query
 * object; `queries-list` updates the stores from `query-delete:completed`.
 * That goes on `document` because a list re-render during the request can
 * detach this button, and an event from a detached element reaches nobody.
 */
export default class extends Controller {
  static outlets = ["query-command-bridge"]
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
      await deleteJson(this.deleteUrlValue)
    } catch (error) {
      console.error("query-delete: delete failed", error)
      this.element.disabled = false
      coreFlash.show("error", "Unable to delete query.")
      return
    }

    this.queryCommandBridgeOutlet.queryRemoved({ queryId: this.queryIdValue })
    this.dispatch("completed", { target: document, detail: { queryId: this.queryIdValue } })
  }
}
