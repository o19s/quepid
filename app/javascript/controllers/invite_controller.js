import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"

const FEEDBACK_MS = 1500

/**
 * Copies a team invite link from a `link` Stimulus value.
 * Uses `utils/clipboard` so HTTPS and plain-HTTP pages share one fallback path.
 * Success and failure show briefly on the button itself, like other copy controls.
 */
export default class extends Controller {
  static values = { link: String }

  disconnect() {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
  }

  copy(event) {
    event.preventDefault()
    const link = this.linkValue
    const btn = event.currentTarget
    if (!link) {
      this.showFeedback(btn, "No invite link")
      return
    }

    copyText(link).then(
      () => this.showFeedback(btn, "Copied"),
      () => this.showFeedback(btn, "Copy failed")
    )
  }

  // Remembers the original label once, so repeated clicks still restore it.
  showFeedback(btn, text) {
    this.originalLabel ??= btn.innerHTML
    btn.textContent = text
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = setTimeout(() => {
      btn.innerHTML = this.originalLabel
      this.feedbackTimer = null
    }, FEEDBACK_MS)
  }
}
