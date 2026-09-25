import { Controller } from "@hotwired/stimulus"
import { attachTextPaste } from "utils/text_paste"

/**
 * Stimulus shell for the core add-query control.
 * Query creation/search remains behind the Angular queries service seam while
 * the live query state is migrated.
 */
export default class extends Controller {
  static targets = ["input", "submit", "spinner"]
  static values = {
    canAddQueries: Boolean,
    placeholder: String
  }

  connect() {
    this.queryState = window.quepidSearch?.queryState
    this.onQueryStateChange = () => {
      this.queryState = window.quepidSearch?.queryState
      this.render()
    }
    document.addEventListener("queries-state:changed", this.onQueryStateChange)
    this.onComplete = event => this.complete(event)
    this.element.addEventListener("add-query:complete", this.onComplete)
    this.detachPaste = attachTextPaste(this.inputTarget, text => {
      this.inputTarget.value = text.split("\n").join(";")
      this.render()
    })
    this.render()
  }

  disconnect() {
    this.detachPaste?.()
    document.removeEventListener("queries-state:changed", this.onQueryStateChange)
    this.element.removeEventListener("add-query:complete", this.onComplete)
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
    this.inputTarget.placeholder = this.queryState?.getListState?.()?.addQueryMessage || this.placeholderValue || "Add a query to this case"
    this.spinnerTarget.classList.toggle("d-none", !this.loading)
  }

  canAddQueries() {
    const state = this.queryState?.getListState?.()
    return state ? state.canAddQueries !== false : this.canAddQueriesValue
  }
}
