import { apiFetch } from "api/fetch"
import { Controller } from "@hotwired/stimulus"

// Periodic reconciliation also recovers a missed first-row broadcast on an idle
// book. Cell updates preserve mounted sparklines while adding/removing rows.
export default class extends Controller {
  static values = { url: String, intervalMs: { type: Number, default: 5000 } }

  connect() {
    this.startPolling()
  }

  disconnect() {
    this.stopPolling()
  }

  startPolling() {
    if (this.timer) return
    this.timer = setInterval(() => this.poll(), this.intervalMsValue)
  }

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async poll() {
    const knownJudgeIds = [...this.element.querySelectorAll('[id^="judge-row-"]')]
      .map((row) => row.id.replace("judge-row-", ""))
      .join(",")
    const url = new URL(this.urlValue, window.location.href)
    url.searchParams.set("known_judge_ids", knownJudgeIds)

    if (this.inFlight) return
    this.inFlight = true
    try {
      const response = await apiFetch(url, { headers: { Accept: "text/vnd.turbo-stream.html" } })
      if (!response.ok || !this.element.isConnected) return
      const html = await response.text()
      if (this.element.isConnected) Turbo.renderStreamMessage(html)
    } catch {
      // A disconnected cable or failed poll recovers on the next interval.
    } finally {
      this.inFlight = false
    }
  }
}
