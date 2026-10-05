import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["allFields", "toggle"]
  static values = { linkUrl: String }

  view() {
    if (this.linkUrlValue) window.open(this.linkUrlValue, "_blank", "noopener,noreferrer")
  }

  toggleFields(event) {
    event.preventDefault()
    const showing = this.allFieldsTarget.style.display !== "none"
    this.allFieldsTarget.style.display = showing ? "none" : ""
    this.toggleTarget.textContent = showing ? "View All Fields" : "Hide All Fields"
  }
}
