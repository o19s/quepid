import { Controller } from "@hotwired/stimulus"

// Reloads the page every few seconds while something on it is still loading in the background.
// It leaves an open dialog alone, so a form being filled in is not wiped by the refresh.
export default class extends Controller {
  static values = { intervalMs: { type: Number, default: 5000 } }

  connect() {
    this.timer = setInterval(() => this.refresh(), this.intervalMsValue)
  }

  disconnect() {
    clearInterval(this.timer)
  }

  refresh() {
    if (document.querySelector(".modal.show")) return
    window.Turbo.visit(window.location.href, { action: "replace" })
  }
}
