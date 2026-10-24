import { Controller } from "@hotwired/stimulus"
import { withStatusMessages } from "controllers/status_message_behavior"

export default class extends withStatusMessages(Controller) {
  setLoading(isLoading) {
    this.submitButtonTarget.disabled = isLoading
    this.submitTextTarget.textContent = isLoading ? "Importing..." : "Import"
    this.spinnerTarget.classList.toggle("d-none", !isLoading)
  }

  showAlert(message, type) {
    this.showStatusMessage(this.alertTarget, { message, className: `alert alert-${type}` })
  }

  hideAlert() {
    this.alertTarget.classList.add("d-none")
  }
}
