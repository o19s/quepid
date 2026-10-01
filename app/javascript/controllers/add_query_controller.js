import { Controller } from "@hotwired/stimulus"
import { attachTextPaste } from "utils/text_paste"
import { getCoreCapabilities } from "utils/core_capability_access"

/**
 * Stimulus shell for the core add-query control.
 * Query creation/search remains behind the live-query service seam while
 * the live query state is migrated.
 */
export default class extends Controller {
  static targets = ["input", "submit", "spinner"]
  static values = {
    canAddQueries: Boolean,
    placeholder: String
  }

  connect() {
    this.queryCapabilities = getCoreCapabilities().queryCapabilities
    this.detachPaste = attachTextPaste(this.inputTarget, text => {
      this.inputTarget.value = text.split("\n").join(";")
      this.render()
    })
    this.render()
  }

  disconnect() {
    this.detachPaste?.()
  }

  refreshQueryState() {
    this.queryCapabilities = getCoreCapabilities().queryCapabilities
    this.render()
  }

  submit(event) {
    event.preventDefault()
    if (this.loading || !this.canAddQueries()) return

    const queryTexts = this.inputTarget.value
      .split(";")
      .map(text => text.trim())
      .filter(Boolean)

    if (queryTexts.length === 0) return

    this.loading = true
    this.inputTarget.value = ""
    this.render()
    this.element.dispatchEvent(new CustomEvent("add-query:submit", {
      bubbles: true,
      detail: { queryTexts }
    }))
  }

  input() {
    this.render()
  }

  complete(event) {
    this.loading = false
    if (event.detail?.success === false) this.inputTarget.focus()
    this.render()
  }

  render() {
    const empty = !this.inputTarget.value.trim()
    const canAdd = this.canAddQueries()
    this.submitTarget.disabled = !canAdd || empty || this.loading
    this.submitTarget.value = this.inputTarget.value.includes(";") ? "Add queries" : "Add query"
    this.inputTarget.placeholder = this.queryCapabilities?.getListState?.()?.addQueryMessage || this.placeholderValue || "Add a query to this case"
    this.spinnerTarget.classList.toggle("d-none", !this.loading)
  }

  canAddQueries() {
    const state = this.queryCapabilities?.getListState?.()
    return state ? state.canAddQueries !== false : this.canAddQueriesValue
  }
}
