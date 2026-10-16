import { Controller } from "@hotwired/stimulus"

// Rails notices restart their delay after the reader leaves the alert.
export default class extends Controller {
  static values = { delay: { type: Number, default: 5000 } }

  connect() {
    this.schedule()
  }

  disconnect() {
    this.pause()
  }

  schedule() {
    this.pause()
    if (this.element.matches(":hover") || this.element.contains(document.activeElement)) return
    this.timeout = setTimeout(() => this.dismiss(), this.delayValue)
  }

  pause() {
    clearTimeout(this.timeout)
    this.timeout = null
  }

  dismiss() {
    if (!this.element.isConnected) return
    const alert = window.bootstrap?.Alert?.getOrCreateInstance(this.element)
    if (alert) alert.close()
    else this.element.remove()
  }
}
