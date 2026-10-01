import { Controller } from "@hotwired/stimulus"
import { errorMessage } from "utils/error_message"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"

/**
 * Owns query lifecycle orchestration while the search/scoring implementation
 * remains in the temporary live-query service adapter.
 */
export default class extends Controller {
  static values = { caseId: Number }

  static targets = ["addQuery"]

  handleAddQueries(event) {
    return this.addQueries(event.detail?.queryTexts || [])
  }

  async addQueries(queryTexts) {
    if (queryTexts.length === 0) return
    const lifecycle = getCoreCapabilities().queryLifecycle
    if (!lifecycle?.prepareQueries || !lifecycle?.commitQueries) {
      coreFlash.show("error", "Unable to add queries.")
      this.complete(false)
      return
    }

    try {
      const prepared = lifecycle.prepareQueries(queryTexts)
      const caseId = this.caseIdValue || lifecycle.caseId
      const persisted = queryTexts.length === 1
        ? await lifecycle.persistQuery(caseId, queryTexts[0])
        : await lifecycle.persistQueries(caseId, queryTexts)
      const result = await lifecycle.commitQueries(prepared, persisted)
      if (result.searchError) {
        coreFlash.show("error", queryTexts.length === 1
          ? "Your new query had an error!"
          : "One (or many) of your new queries had an error!")
        // A single query's error comes from searchAndScore(), which never
        // touches the query collection store — flash it here. A bulk add's
        // error comes from searchAll(), which already reports through the
        // store's search-failed event (queries_list_controller.js); flashing
        // it here too would just be a redundant, race-prone second write to
        // the same sticky channel.
        if (queryTexts.length === 1) {
          // Unlike the generic fallbacks below, preserve the raw rejection text
          // here rather than a fixed message — this channel is meant to show
          // search-engine detail, not just "something went wrong."
        coreFlash.show("error", errorMessage(result.searchError, String(result.searchError)), "search-error")
        }
      } else {
        coreFlash.show("success", queryTexts.length === 1
          ? "Query added successfully."
          : "Queries added successfully.")
      }
      this.complete(true)
    } catch (error) {
      const fallback = queryTexts.length === 1 ? "Unable to add query." : "Unable to add queries."
      coreFlash.show("error", errorMessage(error, fallback))
      this.complete(false)
    }
  }

  complete(success) {
    if (!this.hasAddQueryTarget) return
    this.addQueryTarget.dispatchEvent(
      new CustomEvent("add-query:complete", { detail: { success } })
    )
  }
}
