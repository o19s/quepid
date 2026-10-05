import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal, showBsModal } from "utils/bs_modal"
import { prettyPrintJson } from "utils/json_format"

export default class extends Controller {
  static targets = ["queryText", "docId", "content", "modal"]

  show(event) {
    event.preventDefault()
    
    const link = event.currentTarget
    const documentFields = link.dataset.documentFields
    const queryText = link.dataset.queryText
    const docId = link.dataset.docId

    this.queryTextTarget.textContent = queryText
    this.docIdTarget.textContent = docId

    try {
      this.contentTarget.textContent = prettyPrintJson(documentFields)
    } catch (e) {
      // Fallback: show raw content if JSON parsing fails
      this.contentTarget.textContent = documentFields
    }

    // Show the Bootstrap modal using the global bootstrap object
    showBsModal(getOrCreateBsModal(this.modalTarget))
  }
}
