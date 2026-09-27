import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["linkTheCase", "synchronizationOption"]

  connect() {
    this.toggleOptions()
  }

  toggleOptions() {
    const enabled = this.linkTheCaseTarget.checked
    this.synchronizationOptionTargets.forEach((option) => {
      option.disabled = !enabled
    })
  }
}
