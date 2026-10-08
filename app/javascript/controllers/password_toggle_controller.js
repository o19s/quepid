import { Controller } from "@hotwired/stimulus"

// Toggles a password-type input between masked and plaintext, swapping the
// eye icon to match. Generic/reusable - not tied to any one form.
export default class extends Controller {
  static targets = ["input", "icon"]

  toggle() {
    const showing = this.inputTarget.type === "text"
    this.inputTarget.type = showing ? "password" : "text"
    this.iconTarget.classList.toggle("bi-eye", showing)
    this.iconTarget.classList.toggle("bi-eye-slash", !showing)
  }
}
