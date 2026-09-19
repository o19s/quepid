import { Controller } from "@hotwired/stimulus"

/**
 * Renders one flash box on the core case page. Angular controllers (still on
 * `/case/:id`) trigger it via `document`-level `flash:show` / `flash:hide`
 * CustomEvents dispatched from `utils/flash.js`, since they can't reach a
 * Stimulus controller's own actions directly. Each box picks its events out
 * of the shared events by `channelValue` ("main" or "search-error").
 */
export default class extends Controller {
  static targets = ["message"]
  static values = {
    channel: { type: String, default: "main" },
    duration: { type: Number, default: 5000 }
  }

  connect() {
    this.onDocumentShow = this.onDocumentShow.bind(this)
    this.onDocumentHide = this.onDocumentHide.bind(this)
    document.addEventListener("flash:show", this.onDocumentShow)
    document.addEventListener("flash:hide", this.onDocumentHide)
  }

  disconnect() {
    document.removeEventListener("flash:show", this.onDocumentShow)
    document.removeEventListener("flash:hide", this.onDocumentHide)
    clearTimeout(this.timer)
  }

  onDocumentShow(event) {
    if (!this.isMyChannel(event.detail.target)) return
    this.show(event.detail.type, event.detail.message, event.detail.html)
  }

  onDocumentHide(event) {
    if (!this.isMyChannel(event.detail && event.detail.target)) return
    this.hide()
  }

  isMyChannel(target) {
    return (target || "main") === this.channelValue
  }

  show(type, message, html) {
    if (!message) {
      this.hide()
      return
    }

    clearTimeout(this.timer)
    if (html) {
      this.messageTarget.innerHTML = message
    } else {
      this.messageTarget.textContent = message
    }
    this.element.classList.remove("alert-success", "alert-danger", "alert-warning", "alert-info")
    const alertClass = {
      success: "alert-success",
      error: "alert-danger",
      warn: "alert-warning",
      info: "alert-info"
    }[type]
    if (alertClass) this.element.classList.add(alertClass)
    this.element.classList.add("show", "alert")

    if (this.durationValue > 0) {
      this.timer = setTimeout(() => this.hide(), this.durationValue)
    }
  }

  hide() {
    clearTimeout(this.timer)
    this.element.classList.remove(
      "show",
      "alert",
      "alert-success",
      "alert-danger",
      "alert-warning",
      "alert-info"
    )
  }
}
