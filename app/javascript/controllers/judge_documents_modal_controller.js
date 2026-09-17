import { Controller } from "@hotwired/stimulus"

/**
 * "Judge Documents" modal (Judgement Stats and Book Overview): flips the submit
 * button's label between "Judge Documents" and "Unleash the Kraken!!" as the
 * "Judge All Pairs" checkbox is toggled.
 */
export default class extends Controller {
  static targets = ["judgeAll", "submitButton"]

  connect() {
    this.updateLabel()
  }

  updateLabel() {
    this.submitButtonTarget.value = this.judgeAllTarget.checked
      ? "Unleash the Kraken!!"
      : "Judge Documents"
  }
}
