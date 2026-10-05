import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { buildBrowseCurlCommand } from "utils/browse_query"
import { openDynamicModal } from "utils/dynamic_modal"

export default class extends Controller {
  static targets = ["engineName", "curl", "headersNotice", "noHeadersNotice", "directLink", "copyIcon", "copyLabel"]
  static values = {
    url: String,
    engineName: String,
    headers: Object,
    modalRoot: Boolean,
    command: String
  }

  connect() {
    if (!this.modalRootValue) return
    this.engineNameTargets.forEach(node => { node.textContent = this.engineNameValue })
    this.curlTarget.textContent = this.commandValue
    const hasHeaders = Object.keys(this.headersValue || {}).length > 0
    this.headersNoticeTarget.classList.toggle("d-none", !hasHeaders)
    this.noHeadersNoticeTarget.classList.toggle("d-none", hasHeaders)
    this.directLinkTarget.classList.toggle("d-none", hasHeaders)
    this.directLinkTarget.href = this.urlValue
    this.lifecycle = {}
    this.modalElement = this.element.closest(".modal")
    this.onHide = () => { this.lifecycle = null }
    this.modalElement.addEventListener("hide.bs.modal", this.onHide)
  }

  disconnect() {
    this.lifecycle = null
    this.modalElement?.removeEventListener("hide.bs.modal", this.onHide)
  }

  async copy() {
    const lifecycle = this.lifecycle
    try {
      await copyText(this.commandValue)
      if (!lifecycle || lifecycle !== this.lifecycle) return
      this.copyIconTarget.className = "bi bi-check-lg"
      this.copyLabelTarget.textContent = "Copied!"
    } catch {
      // Preserve the existing silent clipboard failure behavior.
    }
  }

  open(event) {
    event.preventDefault()

    const curlCommand = buildBrowseCurlCommand({
      url: this.urlValue,
      headers: this.headersValue
    })
    const modal = openDynamicModal({
      templateId: "browse-query-modal-template",
      size: "lg",
      ariaLabelledBy: "browse-query-modal-title"
    })

    const content = modal.element.querySelector(".modal-content")
    content.dataset.controller = "browse-query"
    content.dataset.browseQueryModalRootValue = "true"
    content.dataset.browseQueryCommandValue = curlCommand
    content.dataset.browseQueryUrlValue = this.urlValue
    content.dataset.browseQueryEngineNameValue = this.engineNameValue
    content.dataset.browseQueryHeadersValue = JSON.stringify(this.headersValue || {})
  }
}
