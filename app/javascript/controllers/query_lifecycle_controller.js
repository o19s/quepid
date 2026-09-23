import { Controller } from "@hotwired/stimulus"

/**
 * Owns query lifecycle orchestration while the search/scoring implementation
 * remains in the temporary Angular service adapter.
 */
export default class extends Controller {
  connect() {
    this.onAddQueries = event => this.addQueries(event.detail?.queryTexts || [])
    this.element.addEventListener("add-query:submit", this.onAddQueries)
  }

  disconnect() {
    this.element.removeEventListener("add-query:submit", this.onAddQueries)
  }

  async addQueries(queryTexts) {
    const addQueryTexts = window.quepidSearch?.queryLifecycle?.addQueries
    if (queryTexts.length === 0) return
    if (!addQueryTexts) {
      window.quepidDom?.flash?.show("error", "Unable to add queries.")
      this.complete(false)
      return
    }

    try {
      const result = await addQueryTexts(queryTexts)
      if (result.searchError) {
        const message = result.searchError.message || result.searchError
        window.quepidDom.flash.show("error", queryTexts.length === 1
          ? "Your new query had an error!"
          : "One (or many) of your new queries had an error!")
        window.quepidDom.flash.show("error", message, "search-error")
      } else {
        window.quepidDom.flash.show("success", queryTexts.length === 1
          ? "Query added successfully."
          : "Queries added successfully.")
      }
      this.complete(true)
    } catch (error) {
      const message = error?.error || error?.message || JSON.stringify(error)
      window.quepidDom.flash.show("error", message || (queryTexts.length === 1
        ? "Unable to add query."
        : "Unable to add queries."))
      this.complete(false)
    }
  }

  complete(success) {
    this.element.querySelector('[data-controller="add-query"]')?.dispatchEvent(
      new CustomEvent("add-query:complete", { detail: { success } })
    )
  }
}
