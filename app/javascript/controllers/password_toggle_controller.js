import { Controller } from "@hotwired/stimulus"

// Masks a field with a dot overlay (toggled via an eye icon) instead of
// type="password" or -webkit-text-security - both get treated by iOS/
// WebKit as a secure-entry field, triggering the native Passwords AutoFill
// sheet even on fields that aren't a login credential. The real input's
// `.value` is left untouched throughout (only its text color and a sibling
// overlay change), so anything else reading the field live, or the form
// submission itself, keeps working unchanged. Generic/reusable - not tied
// to any one form.
export default class extends Controller {
  static targets = ["wrapper", "input", "overlay", "icon"]

  connect() {
    this.renderOverlay()
  }

  renderOverlay() {
    this.overlayTarget.textContent = "•".repeat(this.inputTarget.value.length)
  }

  toggle() {
    const nowMasked = this.wrapperTarget.classList.toggle("is-masked")
    this.iconTarget.classList.toggle("bi-eye", nowMasked)
    this.iconTarget.classList.toggle("bi-eye-slash", !nowMasked)
  }
}
