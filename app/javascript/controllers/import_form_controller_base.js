import { Controller } from "@hotwired/stimulus"
import { showStatusMessage } from "utils/status_message"

export default class extends Controller {
  setLoading(isLoading) {
    this.submitButtonTarget.disabled = isLoading
    this.submitTextTarget.textContent = isLoading ? "Importing..." : "Import"
    this.spinnerTarget.classList.toggle("d-none", !isLoading)
  }

  showAlert(message, type) {
    showStatusMessage(this.alertTarget, { message, className: `alert alert-${type}` })
  }

  hideAlert() {
    this.alertTarget.classList.add("d-none")
  }
}
