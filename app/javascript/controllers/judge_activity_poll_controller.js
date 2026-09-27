import { Controller } from "@hotwired/stimulus"

// Fallback safety net for BroadcastJudgeActivityJob's live Turbo Stream
// push.   We are seeing that often it looses it's connection if the job runs and finishes queickly, and then it just pulses forever.
// if that broadcast is ever missed (a dropped ActionCable connection,
// a broadcast that fires before this page's subscription is ready, etc.), a
// row could be left showing as "actively judging" forever with nothing to
// correct it. While at least one row is actively judging, poll the server
// periodically and swap in its response - cheap self-healing that doesn't
// depend on the broadcast arriving at all.
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
    const response = await fetch(this.urlValue, { headers: { Accept: "text/html" } })
    if (!response.ok) return

    // Setting innerHTML triggers the observer above, which re-schedules (or
    // stops) polling based on the freshly-fetched content.
    this.element.innerHTML = await response.text()
  }
}
