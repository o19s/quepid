import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"

export default class extends Controller {
  async unarchive(event) {
    event.preventDefault()

    const caseId = document.body.dataset.caseId
    const token = csrfToken()

    try {
      const response = await fetch(apiUrl(`cases/${caseId}/unarchive`), {
        method: "POST",
        headers: {
          "X-CSRF-Token": token,
          Accept: "text/html",
        },
      })

      if (!response.ok && !response.redirected) {
        throw new Error(`Failed to unarchive case (${response.status})`)
      }

      // Reload the page — the ARCHIVED badge will be gone
      window.location.reload()
    } catch (error) {
      showFlash(error.message, "danger")
    }
  }
}
