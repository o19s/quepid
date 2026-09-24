import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"
import { buildBrowseCurlCommand } from "utils/browse_query"
import { openDynamicModal } from "utils/dynamic_modal"

export default class extends Controller {
  static values = {
    url: String,
    engineName: String,
    headers: Object
  }

  open(event) {
    event.preventDefault()

    const curlCommand = buildBrowseCurlCommand({
      url: this.urlValue,
      headers: this.headersValue
    })
    const hasHeaders = Object.keys(this.headersValue || {}).length > 0
    const modal = openDynamicModal({
      templateId: "browse-query-modal-template",
      size: "lg",
      ariaLabelledBy: "browse-query-modal-title"
    })

    const element = modal.element
    element.querySelectorAll("[data-modal-target='engineName']").forEach((node) => { node.textContent = this.engineNameValue })
    element.querySelector("[data-modal-target='curl']").textContent = curlCommand
    element.querySelector("[data-modal-target='headersNotice']").classList.toggle("d-none", !hasHeaders)
    element.querySelector("[data-modal-target='noHeadersNotice']").classList.toggle("d-none", hasHeaders)
    if (!hasHeaders) {
      const directLink = document.createElement("a")
      directLink.className = "btn btn-outline-secondary float-start me-2"
      directLink.href = this.urlValue
      directLink.target = "_blank"
      directLink.rel = "noopener noreferrer"
      const icon = document.createElement("i")
      icon.className = "bi bi-box-arrow-up-right"
      directLink.append(icon, " Open URL directly")
      element.querySelector(".modal-footer").insertBefore(directLink, element.querySelector(".btn-primary"))
    }
      element.querySelector("[data-modal-target='copy']").addEventListener("click", () => {
      copyText(curlCommand).then(() => {
        element.querySelector("[data-modal-target='copyIcon']").className = "bi bi-check-lg"
        element.querySelector("[data-modal-target='copyLabel']").textContent = "Copied!"
      }).catch(() => {})
    })
  }
}
