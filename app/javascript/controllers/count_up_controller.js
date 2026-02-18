import { Controller } from "@hotwired/stimulus"

// Animates a number from 0 to final value over ~500ms.
// Usage: <span data-controller="count-up" data-count-up-end-value="1234">1234</span>
export default class extends Controller {
  static values = { end: Number }

  connect() {
    const target = this.endValue
    if (!target || target <= 0) return

    const steps = 5
    const duration = 500
    const interval = duration / steps
    let current = 0
    const increment = target / steps

    this.element.textContent = "0"

    this._timer = setInterval(() => {
      current += increment
      if (current >= target) {
        current = target
        clearInterval(this._timer)
      }
      this.element.textContent = Math.round(current).toLocaleString()
    }, interval)
  }

  disconnect() {
    if (this._timer) clearInterval(this._timer)
  }
}
