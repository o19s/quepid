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
      html: `
        <div class="modal-header">
          <h3 class="modal-title" id="browse-query-modal-title">Browse Results on <span class="browse-query-engine-name"></span></h3>
          <button type="button" class="btn-core-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p>Run this in a terminal, or paste it into a tool like Postman, to see the raw response from <span class="browse-query-engine-name"></span> for this query.</p>
          <pre class="p-2 bg-light border rounded browse-query-curl"></pre>
          <p class="text-muted mb-0 ${hasHeaders ? "" : "d-none"}">
            <i class="bi bi-info-circle" aria-hidden="true"></i>
            This includes the endpoint's configured headers/credentials — treat it like a secret.
          </p>
          <p class="text-muted mb-0 ${hasHeaders ? "d-none" : ""}">
            <i class="bi bi-info-circle" aria-hidden="true"></i>
            No headers or credentials are configured for this endpoint, so you can also open the URL directly below.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary float-start me-auto browse-query-copy">
            <i class="bi bi-copy browse-query-copy-icon"></i> <span class="browse-query-copy-label">Copy curl command</span>
          </button>
          <button class="btn btn-primary" data-bs-dismiss="modal">Close</button>
        </div>
      `,
      size: "lg",
      ariaLabelledBy: "browse-query-modal-title"
    })

    const element = modal.element
    element.querySelectorAll(".browse-query-engine-name").forEach((node) => { node.textContent = this.engineNameValue })
    element.querySelector(".browse-query-curl").textContent = curlCommand
    if (!hasHeaders) {
      const directLink = document.createElement("a")
      directLink.className = "btn btn-outline-secondary float-start me-2"
      directLink.href = this.urlValue
      directLink.target = "_blank"
      directLink.rel = "noopener noreferrer"
      directLink.innerHTML = '<i class="bi bi-box-arrow-up-right"></i> Open URL directly'
      element.querySelector(".modal-footer").insertBefore(directLink, element.querySelector(".btn-primary"))
    }
    element.querySelector(".browse-query-copy").addEventListener("click", () => {
      copyText(curlCommand).then(() => {
        element.querySelector(".browse-query-copy-icon").className = "bi bi-check-lg browse-query-copy-icon"
        element.querySelector(".browse-query-copy-label").textContent = "Copied!"
      }).catch(() => {})
    })
  }
}
