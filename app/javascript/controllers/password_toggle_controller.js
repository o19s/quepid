import { Controller } from "@hotwired/stimulus"

// Toggles a field between masked and plaintext, swapping the eye icon to
// match. Generic/reusable - not tied to any one form. Masks via a CSS class
// (-webkit-text-security) rather than type="password": a real password
// input makes mobile browsers treat it as a login credential, prompting
// their OS-level password AutoFill/Keychain UI on unrelated secret fields.
export default class extends Controller {
  static targets = ["input", "icon"]

  toggle() {
    const showing = this.inputTarget.classList.toggle("masked-field") === false
    this.iconTarget.classList.toggle("bi-eye", !showing)
    this.iconTarget.classList.toggle("bi-eye-slash", showing)
  }
}
