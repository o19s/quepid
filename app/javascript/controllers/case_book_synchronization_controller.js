import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["linkTheCase", "synchronizationOption", "synchronizationFallback"]

  connect() {
    this.toggleOptions()
  }

  toggleOptions() {
    const enabled = this.linkTheCaseTarget.checked
    this.synchronizationOptionTargets.forEach((option) => {
      option.disabled = !enabled
      // Disabled checkboxes submit only their hidden fallback; retain their current choices.
      const fallback = this.synchronizationFallbackTargets.find((field) => field.name === option.name)
      fallback.value = !enabled && option.checked ? "1" : "0"
    })
  }
}
