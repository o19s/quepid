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
    this.element.removeEventListener("add-query:complete", this.onComplete)
  }

  submit(event) {
    event.preventDefault()
    if (this.loading || !this.canAddQueriesValue) return

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
    this.submitTarget.disabled = !this.canAddQueriesValue || empty || this.loading
    this.submitTarget.value = this.inputTarget.value.includes(";") ? "Add queries" : "Add query"
    this.inputTarget.placeholder = this.placeholderValue
    this.spinnerTarget.classList.toggle("d-none", !this.loading)
  }
}
