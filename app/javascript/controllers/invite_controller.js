import { Controller } from "@hotwired/stimulus"
import { copyText } from "utils/clipboard"

/**
 * Copies a team invite link from a `link` Stimulus value.
 * Uses `utils/clipboard` so HTTPS and plain-HTTP pages share one fallback path.
 */
export default class extends Controller {
  static values = { link: String }

  copy(event) {
    event.preventDefault()
    const link = this.linkValue
    const btn = event.currentTarget
    if (!link) {
      alert("No invite link available")
      return
    }

    const setCopied = (text) => {
      const prev = btn.innerHTML
      btn.innerHTML = text
      setTimeout(() => {
        btn.innerHTML = prev
      }, 1500)
    }

    copyText(link).then(
      () => setCopied("Copied"),
      () => alert("Copy failed")
    )
  }
}
