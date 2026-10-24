import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { buildBrowseCurlCommand } from "utils/browse_query"
import { openDynamicModal } from "utils/dynamic_modal"
import { createTemporaryFeedback } from "utils/temporary_feedback"

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
    this.copyFeedback = createTemporaryFeedback(2000)
    this.originalCopyIcon = this.copyIconTarget.className
    this.originalCopyLabel = this.copyLabelTarget.textContent
    this.modalElement = this.element.closest(".modal")
    this.onHide = () => {
      this.lifecycle = null
      this.copyFeedback.cancel()
      this.restoreCopyFeedback()
    }
    this.modalElement.addEventListener("hide.bs.modal", this.onHide)
  }

  disconnect() {
    this.lifecycle = null
    this.copyFeedback?.cancel()
    if (this.copyFeedback) this.restoreCopyFeedback()
    this.modalElement?.removeEventListener("hide.bs.modal", this.onHide)
  }

  async copy() {
    const lifecycle = this.lifecycle
    try {
      await copyText(this.commandValue, this.element)
      if (!lifecycle || lifecycle !== this.lifecycle) return
      this.showCopyFeedback("bi bi-check-lg", "Copied!")
    } catch {
      if (!lifecycle || lifecycle !== this.lifecycle) return
      this.showCopyFeedback("bi bi-exclamation-triangle", "Copy failed")
    }
  }

  showCopyFeedback(icon, label) {
    this.copyFeedback.show(() => {
      this.copyIconTarget.className = icon
      this.copyLabelTarget.textContent = label
    }, () => this.restoreCopyFeedback())
  }

  restoreCopyFeedback() {
    this.copyIconTarget.className = this.originalCopyIcon
    this.copyLabelTarget.textContent = this.originalCopyLabel
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
