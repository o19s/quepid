import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["all", "score", "delete"]

  connect() {
    this.sync()
  }

  toggleAll() {
    this.scoreTargets.forEach(score => { score.checked = this.allTarget.checked })
    this.sync()
  }

  sync() {
    const selected = this.scoreTargets.filter(score => score.checked).length
    this.allTarget.checked = this.scoreTargets.length > 0 && selected === this.scoreTargets.length
    this.deleteTarget.disabled = selected === 0
  }
}
