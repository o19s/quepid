import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

// One cell of the Connections list: asks Connections::StatusesController whether this saved
// connection answers, and shows a green plug if it does or a red one if it doesn't. Every row asks
// for itself, so a slow service only delays its own icon. Clicking the plug asks again.
export default class extends Controller {
  static values = { url: String }
  static targets = ["button"]

  connect() {
    this.check()
  }

  async check() {
    this.show("checking", "Checking...")

    try {
      const response = await apiFetch(this.urlValue, { headers: { Accept: "application/json" } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)

      const up = result.status === "ok" || result.status === "reachable"
      const timing = result.elapsed_ms === null ? "" : ` (${result.elapsed_ms} ms)`
      this.show(up ? "up" : "down", `${result.message}${timing}`)
    } catch (error) {
      this.show("down", error.message)
    }
  }

  show(state, message) {
    const colors = { checking: "text-muted", up: "text-success", down: "text-danger" }
    const names = {
      checking: "Checking connection",
      up: "Connection is up",
      down: "Connection is down"
    }
    const button = this.buttonTarget

    button.classList.remove(...Object.values(colors))
    button.classList.add(colors[state])
    button.title = message
    button.setAttribute("aria-label", `${names[state]}: ${message}`)
    button.dataset.state = state
  }
}
