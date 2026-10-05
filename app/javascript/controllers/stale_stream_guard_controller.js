import { Controller } from "@hotwired/stimulus"

/**
 * Drops a Turbo Stream "replace" that is older than what the page already
 * shows. Turbo renders each stream after the next repaint -- an animation
 * frame while the page is visible, an event-loop tick while it is hidden --
 * so when visibility changes mid-run a late "Running 199/200" can land after
 * "Done". Elements that opt in carry data-rendered-at (server time in ms);
 * the check runs when Turbo renders, not when the stream arrives, since the
 * reordering happens in between.
 */
export default class extends Controller {
  connect() {
    this.guard = this.guard.bind(this)
    document.addEventListener("turbo:before-stream-render", this.guard)
  }

  disconnect() {
    document.removeEventListener("turbo:before-stream-render", this.guard)
  }

  guard(event) {
    const stream = event.target
    if (stream.getAttribute("action") !== "replace") return

    const render = event.detail.render
    event.detail.render = async (streamElement) => {
      if (this.stale(streamElement)) return
      await render(streamElement)
    }
  }

  stale(stream) {
    const current = document.getElementById(stream.getAttribute("target"))
    const incoming = stream.templateContent?.firstElementChild
    const shown = Number(current?.dataset.renderedAt)
    const arriving = Number(incoming?.dataset.renderedAt)
    return Boolean(shown && arriving && arriving < shown)
  }
}
