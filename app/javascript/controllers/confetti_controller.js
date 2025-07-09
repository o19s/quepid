import { Controller } from "@hotwired/stimulus"
import party from "party-js"

// Connects to data-controller="confetti"
export default class extends Controller {
  connect() {
    // Trigger confetti when the controller connects
    party.confetti(this.element, {
      count: party.variation.range(40, 60),
      size: party.variation.range(1, 1.5),
      spread: party.variation.range(40, 55)
    })
  }
}