import { Controller } from "@hotwired/stimulus"

// A box for editing a JSON definition: says whether it is valid as it is typed, keeps the Create button off
// until it is, can tidy it up, and can put the proposed definition back.
export default class extends Controller {
  static targets = ["input", "name", "status", "submit"]
  static values = { original: String, originalName: String }

  connect() {
    this.check()
  }

  check() {
    try {
      const parsed = JSON.parse(this.inputTarget.value)
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("it must be a JSON object, like { ... }")
      }
      this.show(true, "Valid JSON")
    } catch (error) {
      this.show(false, `Not valid JSON: ${error.message}`)
    }
  }

  format() {
    try {
      this.inputTarget.value = JSON.stringify(JSON.parse(this.inputTarget.value), null, 2)
    } catch {
      // Not valid yet: check() says why, and there is nothing to tidy.
    }
    this.check()
  }

  reset() {
    this.inputTarget.value = this.originalValue
    if (this.hasNameTarget) this.nameTarget.value = this.originalNameValue
    this.check()
  }

  show(valid, message) {
    this.statusTarget.textContent = message
    this.statusTarget.classList.toggle("text-success", valid)
    this.statusTarget.classList.toggle("text-danger", !valid)
    if (this.hasSubmitTarget) this.submitTarget.disabled = !valid
  }
}
