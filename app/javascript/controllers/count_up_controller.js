import { Controller } from "@hotwired/stimulus"
import { animateCountUp, stopCountUp } from "utils/count_up"

/** Animates this.element's text content up/down whenever numberValue changes. */
export default class extends Controller {
  static values = { number: Number }

  connect() {
    this.displayedValue = this.numberValue
    this.element.textContent = this.numberValue
  }

  numberValueChanged(newValue, oldValue) {
    if (oldValue === undefined) return

    animateCountUp(this.element, this.displayedValue, newValue)
    this.displayedValue = newValue
  }

  disconnect() {
    stopCountUp(this.element)
  }
}
