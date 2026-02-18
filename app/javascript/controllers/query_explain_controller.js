import { Controller } from "@hotwired/stimulus"

// Opens the "Explain Query" modal and handles copying tab content to clipboard.
// Used by QueryExplainComponent (replaces the Angular query_explain directive).
export default class extends Controller {
  static targets = ["modal", "trigger", "paramsPre", "parsingPre", "templatePre"]

  open(event) {
    event.preventDefault()
    if (!this._modal && this.hasModalTarget) {
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(this.modalTarget) ?? new window.bootstrap.Modal(this.modalTarget)
    }
    this._modal?.show()
  }

  copyParams(event) {
    event.preventDefault()
    if (this.hasParamsPreTarget) this._copyText(this.paramsPreTarget.textContent)
  }

  copyParsing(event) {
    event.preventDefault()
    if (this.hasParsingPreTarget) this._copyText(this.parsingPreTarget.textContent)
  }

  copyTemplate(event) {
    event.preventDefault()
    if (this.hasTemplatePreTarget) this._copyText(this.templatePreTarget.textContent)
  }

  _copyText(text) {
    if (!text) return
    navigator.clipboard?.writeText(text).then(() => {
      if (window.flash) window.flash.success = "Copied to clipboard."
    }).catch(() => {})
  }
}
