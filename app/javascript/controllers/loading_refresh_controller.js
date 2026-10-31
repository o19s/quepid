import { Controller } from "@hotwired/stimulus"

// Reloads the page every few seconds while something on it is still loading in the background.
// It leaves an open dialog alone, so a form being filled in is not wiped by the refresh. Once the user
// sets off somewhere (a link, a form such as Uninstall: turbo:visit and turbo:submit-start call stop) it
// stops, so a refresh cannot cancel that on its way; the page it lands on starts its own if it needs one.
export default class extends Controller {
  static values = { intervalMs: { type: Number, default: 5000 } }

  connect() {
    this.timer = setInterval(() => this.refresh(), this.intervalMsValue)
  }

  disconnect() {
    this.stop()
  }

  stop() {
    clearInterval(this.timer)
  }

  refresh() {
    if (document.querySelector(".modal.show")) return
    window.Turbo.visit(window.location.href, { action: "replace" })
  }
}
