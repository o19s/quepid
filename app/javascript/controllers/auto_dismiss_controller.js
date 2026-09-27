import { Controller } from "@hotwired/stimulus"

// Auto-dismisses an alert after a delay, mirroring Bootstrap 5 Toast's
// autohide behavior - the plain Alert component has no such option built in.
// Pauses while hovered or focused so a message being read doesn't disappear
// mid-read; the existing manual close button keeps working regardless.
export default class extends Controller {
  static values = { delay: { type: Number, default: 5000 } }

  connect() {
    this.dismiss = this.dismiss.bind(this)
    this.schedule = this.schedule.bind(this)
    this.pause = this.pause.bind(this)

    this.schedule()
    this.element.addEventListener("mouseenter", this.pause)
    this.element.addEventListener("mouseleave", this.schedule)
    this.element.addEventListener("focusin", this.pause)
    this.element.addEventListener("focusout", this.schedule)
  }

  disconnect() {
    this.pause()
  }

  schedule() {
    this.pause()
    this.timeout = setTimeout(this.dismiss, this.delayValue)
  }

  pause() {
    if (this.timeout) clearTimeout(this.timeout)
  }

  dismiss() {
    if (!this.element.isConnected) return

    const alert = window.bootstrap?.Alert?.getOrCreateInstance(this.element)
    if (alert) {
      alert.close()
    } else {
      this.element.remove()
    }
  }
}
