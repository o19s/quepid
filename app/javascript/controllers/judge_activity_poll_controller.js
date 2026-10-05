import { Controller } from "@hotwired/stimulus"

// Fallback safety net for BroadcastJudgeActivityJob's live Turbo Stream
// push: if a broadcast is ever missed (a dropped ActionCable connection, one
// that fires before this page's subscription is ready, etc.), a row could be
// left showing as "actively judging" forever with nothing to correct it.
// While at least one row is actively judging, poll the server periodically
// and apply its response - cheap self-healing that doesn't depend on the
// broadcast arriving at all.
//
// The poll response is real Turbo Stream HTML (see
// BooksController#judge_activity), applied via Turbo's own
// renderStreamMessage - the same per-cell replace targets the live
// broadcast uses, so polling can never redraw a judge's sparkline chart
// any more than a broadcast can.
//
// A MutationObserver (rather than only checking on connect) means polling
// also kicks in if a row becomes active later via a live broadcast, and
// stops itself as soon as the fetched (or broadcast) content shows nothing
// active anymore - no separate bookkeeping needed to stay in sync with
// content that can also change out from under this controller.
export default class extends Controller {
  static values = { url: String, intervalMs: { type: Number, default: 5000 } }

  connect() {
    this.observer = new MutationObserver(() => this.scheduleIfNeeded())
    this.observer.observe(this.element, { childList: true, subtree: true, attributes: true })
    this.scheduleIfNeeded()
  }

  disconnect() {
    this.observer?.disconnect()
    this.stopPolling()
  }

  scheduleIfNeeded() {
    if (this.hasActiveRow()) {
      this.startPolling()
    } else {
      this.stopPolling()
    }
  }

  hasActiveRow() {
    return this.element.querySelector('[data-actively-judging="true"]') !== null
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
    const url = `${this.urlValue}?known_judge_ids=${knownJudgeIds}`

    const response = await fetch(url, { headers: { Accept: "text/vnd.turbo-stream.html" } })
    if (!response.ok) return

    Turbo.renderStreamMessage(await response.text())
  }
}
