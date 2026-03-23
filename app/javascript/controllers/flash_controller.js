import { Controller } from "@hotwired/stimulus"

/**
 * Centralized flash message controller.
 *
 * Lives on #main-content and listens for "flash:show" CustomEvents on
 * document. Any controller can fire:
 *
 *   import { showFlash } from "modules/flash_helper"
 *   showFlash("Saved!", "success")
 *
 * Also reads Rails flash messages from data attributes on connect.
 */
export default class extends Controller {
  static targets = ["container"]

  connect() {
    this._onFlash = (e) => this._show(e.detail)
    document.addEventListener("flash:show", this._onFlash)

    // Render any server-side Rails flash passed via data attributes
    const railsFlash = this.element.dataset.railsFlash
    if (railsFlash) {
      try {
        const messages = JSON.parse(railsFlash)
        for (const [type, message] of Object.entries(messages)) {
          const bsType = type === "notice" ? "success" : type === "alert" ? "danger" : type
          this._show({ message, type: bsType, duration: 5000 })
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  disconnect() {
    document.removeEventListener("flash:show", this._onFlash)
  }

  _show({ message, type = "success", duration = 5000 }) {
    const container = this.hasContainerTarget ? this.containerTarget : this.element

    const alert = document.createElement("div")
    alert.className = `alert alert-${type} alert-dismissible fade show`
    alert.setAttribute("role", "alert")
    alert.textContent = message

    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "btn-close"
    closeBtn.setAttribute("data-bs-dismiss", "alert")
    closeBtn.setAttribute("aria-label", "Close")
    alert.appendChild(closeBtn)

    container.insertBefore(alert, container.firstChild)

    if (duration > 0) {
      setTimeout(() => {
        if (alert.parentNode) alert.remove()
      }, duration)
    }
  }
}
